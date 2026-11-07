import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const classes = ["healthy_rice", "rice_stem_borer", "rice_leaffolder", "unknown"];
const guides = [
  ["stem-borer", "Stem Borer"], ["rice-leaffolder", "Rice Leaffolder"],
  ["healthy-rice", "Healthy Rice"], ["unknown-damage", "Unknown (Other Damage)"],
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", route => route.fulfill({ json: {
    available: true, message: "Phase 7 navigation fixture", classes,
  } }));
});

async function settled(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator("main .motion-page").first()).toHaveCSS("transform", "none");
}

test("guide cards elevate, highlight, zoom and move arrows without resizing or moving neighbors", async ({ page }) => {
  await settled(page, "/pest-guide");
  const cards = page.locator(".guide-card");
  await expect(cards).toHaveCount(4);
  await expect(cards.locator("h2")).toHaveText(guides.map(([, name]) => name));
  await expect(cards.first()).toHaveCSS("transform", "none");
  const card = cards.first();
  const before = (await card.boundingBox())!;
  const neighbor = await cards.nth(1).boundingBox();
  await card.hover();
  await expect(card).toHaveCSS("translate", "0px -2px");
  await expect(card).toHaveCSS("border-top-color", "rgb(112, 168, 138)");
  await expect(card.locator("img")).toHaveCSS("transform", "matrix(1.025, 0, 0, 1.025, 0, 0)");
  await expect(card.locator(".detail-arrow")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 3, 0)");
  const after = (await card.boundingBox())!;
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  expect(after.y).toBeCloseTo(before.y - 2, 2);
  expect(await cards.nth(1).boundingBox()).toEqual(neighbor);
  expect(await card.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe("none");
  await page.screenshot({ path: "../.artifacts/phase7-guide-hover.png", fullPage: true });
  await page.mouse.move(0, 0);
  await expect(card).toHaveCSS("translate", "none");
  await expect(card.locator("img")).toHaveCSS("transform", "none");
  await expect(card.locator(".detail-arrow")).toHaveCSS("transform", "none");
  expect(await card.boundingBox()).toEqual(before);
  await card.getByRole("link", { name: "View Details" }).focus();
  await expect(card.getByRole("link")).toHaveCSS("outline-width", "3px");
  await expect(card).toHaveCSS("border-top-color", "rgb(112, 168, 138)");
});

test("all four View Details links reveal the matching image and headings with responsive navigation", async ({ page }) => {
  await settled(page, "/pest-guide");
  for (const [index, [slug, name]] of guides.entries()) {
    await page.locator(".guide-card").nth(index).getByRole("link", { name: "View Details" }).click();
    await expect(page).toHaveURL(new RegExp(`/pest-guide/${slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.locator("#main-content")).toBeFocused();
    await expect(page.locator(".detail-photo")).toHaveCSS("animation-name", "pp-fade-in");
    await expect(page.locator(".detail-copy > h1")).toHaveCSS("animation-name", "pp-fade-up");
    await expect.poll(() => page.locator(".detail-photo img").evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator("main")).not.toContainText(/Brown Planthopper|Nilaparvata|\bBPH\b/i);
    if (index === 0) {
      await expect(page.locator(".detail-page")).toHaveCSS("transform", "none");
      await page.screenshot({ path: "../.artifacts/phase7-detail-desktop.png", fullPage: true });
    }
    await page.getByRole("link", { name: "Back to Pest Guide" }).click();
    await expect(page.getByRole("link", { name: "View Details" })).toHaveCount(4);
  }
});

test("route entrances never wait for exit animation and upload state survives ordinary rerenders", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await settled(page, "/");
  // Freeze entrances from their first frame, even on a busy test machine.
  // Looking up a short animation after several assertions can miss it entirely.
  await page.addStyleTag({ content: ".motion-page.motion-fade-up { animation-play-state: paused; animation-delay: -70ms; }" });
  const nav = page.getByRole("navigation");
  for (const [label, selector] of [
    ["Analyze", ".analyze-page"], ["Pest Guide", ".guide-page"], ["About", ".about-page"], ["Home", ".home-page"],
  ]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    const root = page.locator(selector);
    await expect(root).toHaveClass(/motion-page/);
    await expect(page.locator("#main-content")).toBeFocused();
    expect(await root.evaluate(el => getComputedStyle(el).animationDuration)).toBe("0.25s");
    // The next navigation must replace this paused entrance immediately.
    const opacity = Number(await root.evaluate(el => getComputedStyle(el).opacity));
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
  }
  await nav.getByRole("link", { name: "Analyze", exact: true }).click();
  const root = await page.locator(".analyze-page").elementHandle();
  await page.getByLabel("Choose crop image").setInputFiles(path.resolve("public/images/rice-leaffolder.jpg"));
  const preview = await page.getByAltText("Selected rice crop preview").getAttribute("src");
  expect(await root!.evaluate(el => el.isConnected)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByAltText("Selected rice crop preview")).toHaveAttribute("src", preview!);
  expect(await root!.evaluate(el => el.isConnected)).toBe(true);
  await page.route("**/api/analyze", route => route.fulfill({ json: {
    prediction: "healthy_rice", confidence: 0.91,
    probabilities: { healthy_rice: 0.91, rice_stem_borer: 0.03, rice_leaffolder: 0.03, unknown: 0.03 },
    model: "Phase 7 result handoff fixture", unknown_method: "trained_class",
  } }));
  await page.locator(".analyze-button").click();
  await expect(page.getByRole("heading", { name: "Your Analysis Results" })).toBeFocused();
  await expect(page.locator(".results-panel")).toHaveClass(/motion-page/);
  await expect(page.locator(".confidence strong")).toHaveText("91.0%");
  await page.getByRole("button", { name: "Analyze Another Image" }).click();
  await expect(page.locator(".dropzone")).toBeVisible();
  await expect(page.locator(".analysis-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("scroll sections reveal once and stay visible when scrolling away and back", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await settled(page, "/about");
  const section = page.locator(".about-cta");
  await expect(section).toHaveClass(/motion-reveal-pending/);
  await section.evaluate(el => {
    el.setAttribute("data-reveal-count", "0");
    el.addEventListener("animationstart", () => {
      el.setAttribute("data-reveal-count", String(Number(el.getAttribute("data-reveal-count")) + 1));
    });
  });
  await section.scrollIntoViewIfNeeded();
  await expect(section).not.toHaveClass(/motion-reveal-pending/);
  await expect(section).toHaveCSS("opacity", "1");
  await expect(section).toHaveCSS("transform", "none");
  await expect(section).toHaveAttribute("data-reveal-count", "1");
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(section).toHaveCSS("opacity", "1");
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveCSS("opacity", "1");
  await expect(section).toHaveAttribute("data-reveal-count", "1");
});

test("keyboard focus exposes an offscreen pending section immediately", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await settled(page, "/about");
  const section = page.locator(".about-cta");
  await expect(section).toHaveClass(/motion-reveal-pending/);
  await section.getByRole("link", { name: "Analyze an Image" }).focus();
  await expect(section).not.toHaveClass(/motion-reveal-pending/);
  await expect(section).toHaveCSS("animation-name", "none");
  await expect(section).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/analyze$/);
});

test("live reduced motion shows pending sections immediately and disables guide movement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await settled(page, "/about");
  expect(await page.locator(".motion-reveal-pending").count()).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".motion-reveal-pending")).toHaveCount(0);
  for (const section of await page.locator(".motion-section").all()) await expect(section).toHaveCSS("opacity", "1");
  await page.goto("/pest-guide");
  const card = page.locator(".guide-card").first();
  await card.hover();
  await expect(page.locator(".guide-page")).toHaveCSS("animation-name", "none");
  await expect(card).toHaveCSS("translate", "none");
  await expect(card.locator("img")).toHaveCSS("transform", "none");
  await expect(card.locator(".detail-arrow")).toHaveCSS("transform", "none");
});

test("observer cleanup is balanced on navigation and missing observers leave content visible", async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.IntersectionObserver;
    if (!Native) return;
    const active = new Set<IntersectionObserver>();
    (window as unknown as { revealObservers: Set<IntersectionObserver> }).revealObservers = active;
    window.IntersectionObserver = class extends Native {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options);
        active.add(this);
      }
      observe(element: Element) { active.add(this); super.observe(element); }
      disconnect() { active.delete(this); super.disconnect(); }
    };
  });
  await page.setViewportSize({ width: 390, height: 600 });
  await settled(page, "/about");
  const active = () => page.evaluate(() => (window as unknown as { revealObservers: Set<IntersectionObserver> }).revealObservers.size);
  await expect.poll(active).toBe(1);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation").getByRole("link", { name: "Analyze", exact: true }).click();
  await expect.poll(active).toBe(0);
  // A separate reload exercises progressive enhancement without IntersectionObserver.
  await page.addInitScript(() => { Object.defineProperty(window, "IntersectionObserver", { value: undefined, configurable: true }); });
  await settled(page, "/about");
  await expect(page.locator(".motion-reveal-pending")).toHaveCount(0);
  for (const section of await page.locator(".motion-section").all()) await expect(section).toHaveCSS("opacity", "1");
});

test("touch navigation and guide details work at narrow mobile widths without sticky motion", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/health", route => route.fulfill({ json: { available: true, message: "Mobile fixture", classes } }));
  await page.goto("/");
  for (const label of ["Pest Guide", "About", "Analyze", "Home", "Pest Guide"]) {
    await page.getByRole("button", { name: "Open navigation" }).tap();
    await page.getByRole("navigation").getByRole("link", { name: label, exact: true }).tap();
    await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  for (const [index, [slug, name]] of guides.entries()) {
    const card = page.locator(".guide-card").nth(index);
    await card.scrollIntoViewIfNeeded();
    await expect(card).not.toHaveClass(/motion-reveal-pending/);
    await expect(card).toHaveCSS("translate", "none");
    await expect(card.locator("img")).toHaveCSS("transform", "none");
    await card.getByRole("link", { name: "View Details" }).tap();
    await expect(page).toHaveURL(new RegExp(`/pest-guide/${slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (slug === "unknown-damage") {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const section of await page.locator(".motion-section").all()) {
        await section.scrollIntoViewIfNeeded();
        await expect(section).not.toHaveClass(/motion-reveal-pending/);
        await expect(section).toHaveCSS("opacity", "1");
      }
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await expect(page.locator(".detail-page")).toHaveCSS("transform", "none");
      await page.screenshot({ path: "../.artifacts/phase7-detail-mobile.png", fullPage: true });
    }
    await page.getByRole("link", { name: "Back to Pest Guide" }).tap();
  }
  expect(errors).toEqual([]);
  await context.close();
});
