import { test, expect, type Page } from "@playwright/test";

async function openHero(page: Page) {
  const now = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await page.goto("/");
  await expect(page.locator(".hero-slide.active img")).toBeVisible();
  await expect(page.locator(".hero h1")).toHaveCSS("transform", "none");
}

test("four scenes change every six seconds while copy stays fixed and outgoing zoom continues", async ({ page }) => {
  await openHero(page);
  const copy = page.locator(".hero h1, .hero-description, .hero-button");
  await expect(page.locator(".hero-button")).toHaveCSS("transform", "none");
  const boxes = await copy.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
  await expect(page.locator(".hero-slide")).toHaveCount(4);
  const firstImage = page.locator('.hero-slide[data-slide-index="0"] img');
  const zoomStart = await firstImage.evaluate(el => el.getAnimations()[0].startTime);
  for (const [current, next] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
    await expect(page.locator(`.hero-slide[data-slide-index="${next}"] img`)).toHaveCount(1);
    await page.clock.runFor(5999);
    await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", String(current));
    await page.clock.runFor(1);
    await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", String(next));
    await expect(page.locator(".hero-slide.previous")).toHaveCSS("opacity", "1");
    await expect(page.locator(".hero-slide.active")).toHaveCSS("transition-duration", "1.4s");
    await expect(page.locator(".hero-slide.previous img")).toHaveCSS("animation-name", "hero-ken-burns");
    if (current === 0) expect(await firstImage.evaluate(el => el.getAnimations()[0].startTime)).toEqual(zoomStart);
    expect(await copy.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()))).toEqual(boxes);
    await expect(page.locator(".crop-preview")).toHaveCount(3);
    const background = await page.locator(".hero-slide.active img").getAttribute("src");
    for (const preview of await page.locator(".crop-preview-image.active").all()) {
      await expect(preview).toHaveAttribute("src", background!);
      await expect(preview).toHaveCSS("transition-duration", "1.4s");
    }
  }
});

test("pause and hidden tabs stop the timer and scanner, then resume without a burst", async ({ page }) => {
  await openHero(page);
  await page.getByRole("button", { name: "Pause background animation" }).click();
  await page.clock.runFor(18000);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "0");
  for (const selector of [".hero-slide.active img", ".scan-line", ".crop-preview-1"]) {
    await expect(page.locator(selector)).toHaveCSS("animation-play-state", "paused");
  }
  await page.getByRole("button", { name: "Play background animation" }).click();
  await page.clock.runFor(6000);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "1");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".hero")).toHaveClass(/motion-paused/);
  await page.clock.runFor(18000);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "1");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".hero")).not.toHaveClass(/motion-paused/);
  await page.clock.runFor(5999);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "1");
  await page.clock.runFor(1);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "2");
});

test("reduced motion shows a static hero, including when changed during playback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHero(page);
  await expect(page.locator(".hero-image")).toHaveCount(1);
  await expect(page.locator(".hero-motion-control")).toBeHidden();
  await page.clock.runFor(18000);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "0");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator('.hero-slide[data-slide-index="1"] img')).toHaveCount(1);
  await page.clock.runFor(6000);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const selector of [".hero h1", ".hero-description", ".hero-button", ".scan-visual", ".scan-line", ".hero-slide.active img", ".crop-preview-1"]) {
    await expect(page.locator(selector)).toHaveCSS("animation-name", "none");
  }
  await expect(page.locator(".hero-slide.active")).toHaveCSS("opacity", "1");
  await expect(page.locator(".hero-slide.active")).toHaveCSS("transition-duration", "0s");
  await page.clock.runFor(18000);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "1");
});

test("next image is preloaded and a slow response holds the current frame", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route("**/images/hero-rice-morning.webp", async route => {
    requested = true;
    await gate;
    await route.continue();
  });
  await openHero(page);
  await expect.poll(() => requested).toBe(true);
  await page.clock.runFor(12000);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "0");
  await expect(page.locator(".hero-slide.active img")).toBeVisible();
  release();
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "1");
  await expect(page.locator(".hero-slide.active img")).toHaveJSProperty("complete", true);
});

test("a late image cannot advance a paused or unmounted hero", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/images/hero-rice-morning.webp", async route => { await gate; await route.continue(); });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await openHero(page);
  await page.clock.runFor(6000);
  await page.getByRole("button", { name: "Pause background animation" }).click();
  release();
  await page.clock.runFor(12000);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "0");
  await page.getByRole("button", { name: "Play background animation" }).click();
  await expect(page.locator('.hero-slide[data-slide-index="1"] img')).toHaveCount(1);
  await page.getByRole("navigation").getByRole("link", { name: "About", exact: true }).click();
  await page.clock.runFor(18000);
  await expect(page.locator(".hero")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("failed photography is skipped without showing a broken or empty active slide", async ({ page }) => {
  await page.route("**/images/hero-rice-morning.webp", route => route.abort());
  await openHero(page);
  await expect(page.locator('.hero-slide[data-slide-index="2"] img')).toHaveCount(1);
  await page.clock.runFor(6000);
  await expect(page.locator(".hero-slide.active")).toHaveAttribute("data-slide-index", "2");
  await expect(page.locator(".hero-slide.active img")).toHaveJSProperty("complete", true);
  await expect(page.locator('.hero-slide[data-slide-index="1"] img')).toHaveCount(0);
});

test("hero entrances, scanner and action fit mobile, tablet and desktop", async ({ page }) => {
  await openHero(page);
  const delays = await page.locator(".hero h1, .hero-description, .hero-button, .scan-visual").evaluateAll(elements => elements.map(el => getComputedStyle(el).animationDelay));
  expect(delays).toEqual(["0s", "0.09s", "0.18s", "0.27s"]);
  await expect(page.locator(".scan-line")).toHaveCSS("animation-name", "hero-scan");
  await expect(page.locator(".scan-visual")).toHaveCSS("transform", "none");
  const sweep = await page.locator(".scan-line").evaluate(el => {
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    const start = el.getBoundingClientRect();
    animation.currentTime = 2000;
    const middle = el.getBoundingClientRect();
    const beam = getComputedStyle(el, "::after");
    return { startX: start.x, middleX: middle.x, startY: start.y, middleY: middle.y, beamWidth: parseFloat(beam.width), beamHeight: parseFloat(beam.height) };
  });
  expect(sweep.middleX).toBeGreaterThan(sweep.startX);
  expect(sweep.middleY).toEqual(sweep.startY);
  expect(sweep.beamHeight).toBeGreaterThan(sweep.beamWidth);
  await page.getByRole("button", { name: "Pause background animation" }).click();
  for (const width of [320, 390, 600, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const hero = (await page.locator(".hero").boundingBox())!;
    const button = (await page.locator(".hero-button").boundingBox())!;
    const scanner = (await page.locator(".scan-visual").boundingBox())!;
    expect(button.x).toBeGreaterThanOrEqual(hero.x);
    expect(button.x + button.width).toBeLessThanOrEqual(hero.x + hero.width);
    expect(button.y + button.height).toBeLessThanOrEqual(hero.y + hero.height);
    if (width <= 600) expect(scanner.y).toBeGreaterThanOrEqual(button.y + button.height);
    await page.screenshot({ path: `../.artifacts/hero-phase2-${width}.png`, fullPage: true });
  }
  await page.locator(".hero-button").focus();
  await expect(page.locator(".hero-button")).toBeVisible();
  await expect(page.locator(".hero-button")).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/analyze$/);
});
