import { test, expect, type Page } from "@playwright/test";

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.locator(".home-page .feature-card").last()).toHaveCSS("transform", "none");
  await expect(page.locator(".hero-button")).toHaveCSS("transform", "none");
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", route => route.fulfill({ json: {
    available: false, classes: ["healthy_rice", "rice_leaffolder", "rice_stem_borer", "unknown"],
    message: "Frontend interaction test",
  } }));
});

test("desktop navigation animates underline and highlight, with keyboard focus and active routing", async ({ page }) => {
  await openHome(page);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const home = nav.getByRole("link", { name: "Home", exact: true });
  const about = nav.getByRole("link", { name: "About", exact: true });
  const underline = (link: typeof home) => link.evaluate(el => {
    const style = getComputedStyle(el, "::after");
    return { transform: style.transform, opacity: style.opacity, duration: style.transitionDuration };
  });
  await expect(home).toHaveAttribute("aria-current", "page");
  await expect.poll(async () => (await underline(home)).opacity).toBe("1");
  const bounds = await about.boundingBox();
  await about.hover();
  await expect.poll(async () => (await underline(about)).transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
  expect((await underline(about)).duration).toContain("0.25s");
  await expect.poll(() => about.evaluate(el => getComputedStyle(el, "::before").opacity)).toBe("1");
  expect(await about.boundingBox()).toEqual(bounds);
  await page.getByRole("link", { name: "PESTPRINT home" }).focus();
  await page.keyboard.press("Tab");
  await expect(home).toBeFocused();
  await expect(home).toHaveCSS("outline-style", "solid");
  await expect(home).toHaveCSS("outline-width", "3px");
  await about.click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(about).toHaveAttribute("aria-current", "page");
  await expect(home).not.toHaveAttribute("aria-current");
  await expect.poll(async () => (await underline(home)).opacity).toBe("0");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.screenshot({ path: "../.artifacts/phase3-navigation-desktop.png", fullPage: true });
});

test("Home cards stagger, lift three pixels, highlight icons and return without resizing", async ({ page }) => {
  await openHome(page);
  const cards = page.locator(".home-page .feature-card");
  await expect(cards).toHaveCount(4);
  expect(await cards.evaluateAll(elements => elements.map(el => getComputedStyle(el).animationDelay))).toEqual(["0s", "0.06s", "0.12s", "0.18s"]);
  const first = cards.first();
  const before = (await first.boundingBox())!;
  const neighbor = await cards.nth(1).boundingBox();
  const icon = first.locator(".feature-icon");
  const originalIcon = await icon.evaluate(el => getComputedStyle(el).backgroundColor);
  await first.hover();
  await expect(first).toHaveCSS("translate", "0px -3px");
  const hovered = (await first.boundingBox())!;
  expect(hovered.width).toEqual(before.width);
  expect(hovered.height).toEqual(before.height);
  expect(hovered.y).toBeCloseTo(before.y - 3, 2);
  expect(await cards.nth(1).boundingBox()).toEqual(neighbor);
  await expect(icon).not.toHaveCSS("background-color", originalIcon);
  expect(await first.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe("none");
  await page.screenshot({ path: "../.artifacts/phase3-card-hover.png", fullPage: true });
  await page.mouse.move(0, 0);
  await expect(first).toHaveCSS("translate", "none");
  await expect(icon).toHaveCSS("background-color", originalIcon);
  expect(await first.boundingBox()).toEqual(before);
  // Informational cards remain outside the tab order.
  expect(await cards.evaluateAll(elements => elements.every(el => !el.hasAttribute("tabindex") && !el.hasAttribute("role")))).toBe(true);
});

test("Home primary actions elevate, shift only the arrow and have a restrained pressed state", async ({ page }) => {
  await openHome(page);
  const action = page.locator(".hero-button");
  const arrow = action.locator(".button-arrow");
  const before = (await action.boundingBox())!;
  await action.hover();
  await expect(action).toHaveCSS("translate", "0px -2px");
  await expect(arrow).toHaveCSS("translate", "3px");
  const hover = (await action.boundingBox())!;
  expect(hover.width).toEqual(before.width);
  expect(hover.height).toEqual(before.height);
  await page.mouse.down();
  await expect(action).toHaveCSS("translate", "0px");
  await expect.poll(() => action.evaluate(el => getComputedStyle(el).boxShadow)).toContain("inset");
  // Release outside the link so this check does not navigate.
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await expect(action).toHaveCSS("translate", "none");
  await expect(arrow).toHaveCSS("translate", "none");
  expect(await action.boundingBox()).toEqual(before);
  const start = page.getByRole("link", { name: "Get Started", exact: true });
  await start.hover();
  await expect(start).toHaveCSS("translate", "0px -2px");
  await start.click();
  await expect(page).toHaveURL(/\/analyze$/);
  const choose = page.getByRole("button", { name: "Choose Image", exact: true });
  await choose.hover();
  // Phase 4 opted upload controls into the shared hover utility.
  await expect(choose).toHaveCSS("translate", "0px -2px");
  await expect(choose).not.toHaveClass(/home-action/);
});

test("mobile menu fades in and out, excludes closed links from focus and restores focus on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  const panel = page.locator("#main-nav");
  const toggle = page.locator(".menu-button");
  await expect(panel).toHaveAttribute("inert", "");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await toggle.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".hero-button")).toBeFocused();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel).not.toHaveAttribute("inert");
  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel).toHaveCSS("translate", "0px");
  await expect(panel).toHaveCSS("transition-duration", "0.25s, 0.25s, 0s");
  await page.keyboard.press("Tab");
  await expect(panel.getByRole("link", { name: "Home", exact: true })).toBeFocused();
  await page.screenshot({ path: "../.artifacts/phase3-menu-mobile.png", fullPage: true });
  for (let step = 0; step < 5; step++) await page.keyboard.press("Tab");
  await expect(page.locator(".hero-button")).toBeFocused();
  await expect(panel).toHaveAttribute("inert", "");
  await toggle.click();
  await panel.getByRole("link", { name: "Home", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveCSS("outline-style", "solid");
  await expect(panel).toHaveAttribute("inert", "");
  await expect(panel).toHaveCSS("opacity", "0");
  await expect(panel).toHaveCSS("visibility", "hidden");
  // A rapid reversal finishes in the selected state.
  await toggle.click();
  await toggle.click();
  await toggle.click();
  await expect(panel).toHaveCSS("opacity", "1");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("mobile menu closes for outside clicks, the active route and navigation without losing focus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openHome(page);
  const panel = page.locator("#main-nav");
  const toggle = page.locator(".menu-button");
  await toggle.click();
  await panel.getByRole("link", { name: "Home", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await panel.getByRole("link", { name: "Home", exact: true }).focus();
  await page.locator(".how-section").click({ position: { x: 8, y: 8 } });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await panel.evaluate(el => el.contains(document.activeElement))).toBe(false);
  await toggle.click();
  await panel.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#main-content")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("breakpoint changes keep navigation accessible and About feature cards keep their original behavior", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await openHome(page);
  const panel = page.locator("#main-nav");
  const toggle = page.locator(".menu-button");
  await toggle.click();
  await toggle.focus();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(panel).not.toHaveAttribute("inert");
  await expect(panel).not.toHaveAttribute("aria-hidden");
  const home = panel.getByRole("link", { name: "Home", exact: true });
  await expect(home).toBeFocused();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(toggle).toBeFocused();
  await expect(panel).toHaveAttribute("inert", "");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/about");
  const cards = page.locator(".about-workflow .feature-card");
  await expect(cards).toHaveCount(4);
  await expect(page.locator(".about-workflow")).toHaveCSS("transform", "none");
  const before = await cards.first().boundingBox();
  await cards.first().hover();
  await expect(cards.first()).toHaveCSS("animation-name", "none");
  await expect(cards.first()).toHaveCSS("translate", "none");
  expect(await cards.first().boundingBox()).toEqual(before);
  const action = page.locator(".about-cta .button");
  await action.hover();
  await expect(action).toHaveCSS("translate", "none");
});

test("reduced motion immediately exposes cards and switches the menu with no transition or hover movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  const card = page.locator(".home-page .feature-card").first();
  await card.hover();
  await expect(card).toHaveCSS("animation-name", "none");
  await expect(card).toHaveCSS("opacity", "1");
  await expect(card).toHaveCSS("translate", "none");
  await page.locator(".hero-button").hover();
  await expect(page.locator(".hero-button")).toHaveCSS("translate", "none");
  await expect(page.locator(".button-arrow")).toHaveCSS("translate", "none");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".menu-button").click();
  await expect(page.locator("#main-nav")).toHaveCSS("transition-duration", "0s");
  await expect(page.locator("#main-nav")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await expect(page.locator("#main-nav")).toHaveCSS("visibility", "hidden");
});

test("touch interactions do not leave cards or primary actions stuck in a lifted hover state", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto(test.info().project.use.baseURL!);
    await expect(page.locator(".home-page .feature-card").last()).toHaveCSS("transform", "none");
    const card = page.locator(".home-page .feature-card").first();
    await card.tap();
    await expect(card).toHaveCSS("translate", "none");
    await page.locator(".menu-button").tap();
    await expect(page.locator("#main-nav")).toHaveCSS("opacity", "1");
    const start = page.getByRole("link", { name: "Get Started", exact: true });
    await expect(start).toHaveCSS("translate", "none");
    await page.screenshot({ path: "../.artifacts/phase3-menu-touch.png", fullPage: true });
    await page.locator(".menu-button").tap();
    await expect(page.locator("#main-nav")).toHaveCSS("visibility", "hidden");
  } finally { await context.close(); }
});
