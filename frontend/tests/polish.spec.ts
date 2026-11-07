import { test, expect } from "@playwright/test";
import path from "node:path";

test("offscreen hero suspends playback and resumes without catching up", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 300 });
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await page.goto("/");
  const hero = page.locator(".hero");
  await expect(page.locator(".hero-slide.active img")).toBeVisible();
  await expect(page.locator('.hero-slide[data-slide-index="1"] img')).toHaveCount(1);
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect.poll(() => hero.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
  // IntersectionObserver remains a browser event even when JS timers are paused.
  await expect(hero).toHaveClass(/motion-paused/);
  const slide = await page.locator(".hero-slide.active").getAttribute("data-slide-index");
  await page.clock.runFor(24000);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", slide!);
  await expect(page.locator(".scan-line")).toHaveCSS("animation-play-state", "paused");
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(hero).not.toHaveClass(/motion-paused/);
  await page.clock.runFor(5999);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", slide!);
  await page.clock.runFor(1);
  await expect(page.locator(".hero-slide.active")).not.toHaveAttribute("data-slide-index", slide!);
  // A manual pause survives leaving and returning to the viewport.
  await page.getByRole("button", { name: "Pause background animation" }).click();
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect.poll(() => hero.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(hero).toHaveClass(/motion-paused/);
  await expect(page.getByRole("button", { name: "Play background animation" })).toHaveAttribute("aria-pressed", "true");
});

test("mobile retains crossfades and scanning with fewer continuous decorative effects", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto(test.info().project.use.baseURL!);
    await expect(page.locator(".hero-slide.active img")).toBeVisible();
    await expect(page.locator(".scan-visual")).toHaveCSS("transform", "none");
    await expect(page.locator(".hero-slide.active img")).toHaveCSS("animation-name", "none");
    await expect(page.locator(".hero-slide.active")).toHaveCSS("transition-duration", "1.4s");
    for (const preview of await page.locator(".crop-preview").all()) {
      await expect(preview).toHaveCSS("animation-name", "none");
      await expect(preview.locator(".crop-preview-image.active")).toBeVisible();
    }
    await expect.poll(() => page.locator(".scan-frame").evaluate(el => getComputedStyle(el, "::before").animationName)).toBe("none");
    await expect(page.locator(".scan-frame i").first()).toHaveCSS("filter", "none");
    await expect(page.locator(".scan-line")).toHaveCSS("animation-name", "hero-scan");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: "../.artifacts/phase8-mobile-home.png", fullPage: true });
  } finally { await context.close(); }
});

test("upload and result buttons keep their pressed shadow while hovered", async ({ page }) => {
  const classes = ["healthy_rice", "rice_stem_borer", "rice_leaffolder", "unknown"];
  await page.route("**/api/health", route => route.fulfill({ json: { available: true, message: "Phase 8 button fixture", classes } }));
  await page.route("**/api/analyze", route => route.fulfill({ json: {
    prediction: "healthy_rice", confidence: 0.91,
    probabilities: { healthy_rice: 0.91, rice_stem_borer: 0.03, rice_leaffolder: 0.03, unknown: 0.03 },
    model: "Phase 8 button fixture", unknown_method: "trained_class",
  } }));
  await page.goto("/analyze");
  const choose = page.getByRole("button", { name: "Choose Image", exact: true });
  await choose.hover();
  await expect(choose).toHaveCSS("translate", "0px -2px");
  await page.mouse.down();
  await expect.poll(() => choose.evaluate(el => getComputedStyle(el).boxShadow)).toContain("inset");
  await expect(choose).toHaveCSS("translate", "0px");
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.getByLabel("Choose crop image").setInputFiles(path.resolve("public/images/healthy-rice.jpg"));
  await page.getByRole("button", { name: "Analyze Image", exact: true }).click();
  const reset = page.getByRole("button", { name: "Analyze Another Image" });
  await reset.hover();
  await expect(reset).toHaveCSS("translate", "0px -2px");
  await page.mouse.down();
  await expect.poll(() => reset.evaluate(el => getComputedStyle(el).boxShadow)).toContain("inset");
  await expect(reset).toHaveCSS("translate", "0px");
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await reset.focus();
  await expect(reset).toHaveCSS("outline-width", "3px");
  await page.keyboard.press("Enter");
  await expect(choose).toBeFocused();
});

test("print exposes sections that have not been scrolled into view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto("/about");
  const pending = page.locator(".motion-reveal-pending");
  await expect.poll(() => pending.count()).toBeGreaterThan(0);
  await page.emulateMedia({ media: "print" });
  for (const section of await pending.all()) {
    await expect(section).toHaveCSS("opacity", "1");
    await expect(section).toHaveCSS("transform", "none");
    await expect(section).toHaveCSS("animation-name", "none");
  }
  await page.emulateMedia({ media: "screen", reducedMotion: "reduce" });
  await expect(pending).toHaveCount(0);
  await expect(page.locator(".about-cta")).toHaveCSS("opacity", "1");
});

test("focus and disabled analysis controls never restart an exposed entrance", async ({ page }) => {
  await page.route("**/api/health", route => route.fulfill({ json: {
    available: true, message: "Phase 8 focus fixture",
    classes: ["healthy_rice", "rice_leaffolder", "rice_stem_borer", "unknown"],
  } }));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/analyze", async route => {
    await pending;
    await route.fulfill({ status: 503, json: { error: "Phase 8 error fixture" } }).catch(() => {});
  });
  try {
    await page.goto("/analyze");
    const root = page.locator(".analyze-page");
    await page.getByRole("button", { name: "Choose Image", exact: true }).focus();
    await expect(root).toHaveCSS("animation-name", "none");
    await page.getByRole("navigation").getByRole("link", { name: "Home", exact: true }).focus();
    await expect(root).toHaveCSS("animation-name", "none");
    await expect(root).toHaveCSS("opacity", "1");
    await page.getByLabel("Choose crop image").setInputFiles(path.resolve("public/images/healthy-rice.jpg"));
    const analyze = page.locator(".analyze-button");
    await analyze.click();
    await expect(analyze).toBeDisabled();
    await expect(root).toHaveCSS("animation-name", "none");
    await expect(analyze).toHaveCSS("animation-name", "none");
    await expect(root).toHaveCSS("opacity", "1");
    await expect(page.locator(".analysis-overlay")).toBeVisible();
    release();
    await expect(page.getByRole("alert")).toContainText("Phase 8 error fixture");
    await expect(analyze).toBeEnabled();
    await expect(root).toHaveCSS("opacity", "1");
  } finally { release(); }
});
