import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const image = path.resolve("public/images/rice-leaffolder.jpg");
const classes = ["healthy_rice", "rice_stem_borer", "rice_leaffolder", "unknown"];
const labels: Record<string, string> = {
  healthy_rice: "Healthy Rice", rice_stem_borer: "Stem Borer Damage",
  rice_leaffolder: "Rice Leaffolder Damage", unknown: "Unknown (Other Damage)",
};
// Clearly labeled development fixtures exercise result presentation only.
// No fixture data is imported by the application or used as an API fallback.
function fixture(prediction: string) {
  return {
    prediction, confidence: 0.8743,
    probabilities: Object.fromEntries([
      [prediction, 0.8743],
      ...classes.filter(id => id !== prediction).map((id, i) => [id, [0.0502, 0.0421, 0.0334][i]]),
    ]),
    model: "Phase 6 development fixture", unknown_method: "trained_class",
  };
}

async function installFixture(page: Page, data = fixture("healthy_rice"), supported = classes) {
  await page.route("**/api/health", route => route.fulfill({ json: {
    available: true, message: "Phase 6 development fixture", classes: supported,
  } }));
  await page.route("**/api/analyze", route => route.fulfill({ json: data }));
}

async function submit(page: Page) {
  await page.getByLabel("Choose crop image").setInputFiles(image);
  const preview = await page.getByAltText("Selected rice crop preview").getAttribute("src");
  await page.locator(".analyze-button").click();
  await expect(page.getByRole("heading", { name: "Your Analysis Results" })).toBeFocused();
  return preview;
}

async function atTime(page: Page, milliseconds: number) {
  await page.locator(".results-panel").evaluate((panel, time) => {
    for (const animation of panel.getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = time;
    }
  }, milliseconds);
}

for (const [id, tone, color, slug] of [
  ["rice_stem_borer", "pest", "rgb(251, 36, 71)", "stem-borer"],
  ["rice_leaffolder", "pest", "rgb(251, 36, 71)", "rice-leaffolder"],
  ["healthy_rice", "healthy", "rgb(23, 152, 75)", "healthy-rice"],
  ["unknown", "unknown", "rgb(230, 154, 6)", "unknown-damage"],
]) {
  test(`development fixture: ${id} reveals in sequence with genuine scores and working actions`, async ({ page }) => {
    const data = fixture(id);
    await installFixture(page, data);
    await page.goto("/analyze");
    const preview = await submit(page);
    await page.mouse.move(0, 0);
    await atTime(page, 0);
    const photo = page.locator(".result-image");
    const information = page.locator(".result-data");
    const icon = page.locator(".prediction-icon");
    const title = page.locator(".prediction-title > div");
    const confidence = page.locator(".confidence-track .result-bar-fill");
    const rows = page.locator(".probability-row");
    const actions = page.locator(".result-actions");
    const bounds = await page.locator(".results-page").boundingBox();
    await expect(page.locator(".results-panel")).toHaveClass(new RegExp(tone));
    await expect(page.getByAltText("Uploaded rice crop used for this analysis")).toHaveAttribute("src", preview!);
    await expect(page.locator(".confidence strong")).toHaveText("87.4%");
    await expect(photo).toHaveCSS("opacity", "0");
    await expect(information).toHaveCSS("opacity", "0");
    await expect(confidence).toHaveCSS("transform", "matrix(0, 0, 0, 1, 0, 0)");
    await expect(actions).toHaveCSS("opacity", "0");
    await expect(page.getByRole("progressbar")).toHaveCount(4);
    for (const [classId, value] of Object.entries(data.probabilities)) {
      const bar = page.getByRole("progressbar", { name: labels[classId] });
      expect(Number(await bar.getAttribute("aria-valuenow"))).toBeCloseTo(Number(value) * 100, 10);
      expect(await bar.locator(".result-bar-fill").evaluate(el => parseFloat((el as HTMLElement).style.width))).toBeCloseTo(Number(value) * 100, 10);
    }
    await atTime(page, 90);
    expect(Number(await photo.evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(0);
    expect(Number(await information.evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(0);
    await expect(icon).toHaveCSS("opacity", "0");
    await atTime(page, 150);
    expect(Number(await icon.evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(0);
    await expect(title).toHaveCSS("opacity", "0");
    await atTime(page, 210);
    expect(Number(await title.evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(0);
    await expect(confidence).toHaveCSS("transform", "matrix(0, 0, 0, 1, 0, 0)");
    await atTime(page, 280);
    const scale = await confidence.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThan(1);
    await expect(rows.first()).toHaveCSS("opacity", "0");
    for (let index = 0; index < 4; index++) {
      await atTime(page, 310 + index * 60);
      expect(Number(await rows.nth(index).evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(0);
      if (index < 3) await expect(rows.nth(index + 1)).toHaveCSS("opacity", "0");
      const fill = rows.nth(index).locator(".result-bar-fill");
      const amount = await fill.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
      expect(amount).toBeGreaterThan(0);
      expect(amount).toBeLessThan(1);
    }
    await expect(actions).toHaveCSS("opacity", "0");
    await atTime(page, 1000);
    await expect(confidence).toHaveCSS("transform", "none");
    await expect(confidence).toHaveCSS("background-color", color);
    await expect(photo).toHaveCSS("opacity", "1");
    await expect(actions).toHaveCSS("opacity", "1");
    expect(await page.locator(".results-page").boundingBox()).toEqual(bounds);
    const ratio = await confidence.evaluate(el => el.getBoundingClientRect().width / el.parentElement!.getBoundingClientRect().width);
    expect(ratio).toBeCloseTo(data.confidence, 3);
    await page.screenshot({ path: `../.artifacts/phase6-${id}-desktop.png`, fullPage: true });
    const reset = page.getByRole("button", { name: "Analyze Another Image" });
    await reset.hover();
    await expect(reset).toHaveCSS("translate", "0px -2px");
    await reset.click();
    await expect(page.getByRole("button", { name: "Choose Image", exact: true })).toBeFocused();
    await submit(page);
    // Keyboard access reveals a delayed action immediately, before its entrance ends.
    await atTime(page, 0);
    await page.getByRole("link", { name: /Learn More/ }).focus();
    await expect(page.locator(".result-actions")).toHaveCSS("opacity", "1");
    await expect(page.getByRole("link", { name: /Learn More/ })).toHaveCSS("outline-width", "3px");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/pest-guide/${slug}$`));
  });
}

test("only backend-supported scores are shown and a genuine zero gets no minimum visual width", async ({ page }) => {
  const supported = classes.filter(id => id !== "unknown");
  await installFixture(page, {
    prediction: "healthy_rice", confidence: 0.75,
    probabilities: { healthy_rice: 0.75, rice_stem_borer: 0.25, rice_leaffolder: 0 },
    model: "Three-class development fixture", unknown_method: "not_supported",
  }, supported);
  await page.goto("/analyze");
  await submit(page);
  await atTime(page, 1000);
  await expect(page.getByRole("progressbar")).toHaveCount(3);
  await expect(page.getByRole("progressbar", { name: labels.unknown })).toHaveCount(0);
  const zero = page.getByRole("progressbar", { name: labels.rice_leaffolder });
  await expect(zero).toHaveAttribute("aria-valuenow", "0");
  await expect(zero.locator(".result-bar-fill")).toHaveCSS("width", "0px");
  await expect(zero.locator("..").locator("strong")).toHaveText("0.0%");
});

test("small positive scores and near-certain scores are not rounded to zero or certainty", async ({ page }) => {
  await installFixture(page, {
    prediction: "healthy_rice", confidence: 0.9996,
    probabilities: { healthy_rice: 0.9996, rice_stem_borer: 0.0004, rice_leaffolder: 0, unknown: 0 },
    model: "Precision development fixture", unknown_method: "trained_class",
  });
  await page.goto("/analyze");
  await submit(page);
  await atTime(page, 1000);
  await expect(page.locator(".confidence strong")).toHaveText(">99.9%");
  const small = page.getByRole("progressbar", { name: labels.rice_stem_borer });
  expect(Number(await small.getAttribute("aria-valuenow"))).toBeCloseTo(0.04, 10);
  await expect(small.locator("..").locator("strong")).toHaveText("<0.1%");
  expect(await small.locator(".result-bar-fill").evaluate(el => parseFloat((el as HTMLElement).style.width))).toBeCloseTo(0.04, 10);
  expect(await page.locator(".confidence-track .result-bar-fill").evaluate(el => parseFloat((el as HTMLElement).style.width))).toBeCloseTo(99.96, 10);
});

test("live reduced motion removes delays and shows true bar values immediately on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installFixture(page, fixture("unknown"));
  await page.goto("/analyze");
  await submit(page);
  await atTime(page, 0);
  await expect(page.locator(".confidence-track .result-bar-fill")).toHaveCSS("transform", "matrix(0, 0, 0, 1, 0, 0)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".result-image")).toHaveCSS("opacity", "1");
  await expect(page.locator(".result-actions")).toHaveCSS("opacity", "1");
  for (const fill of await page.locator(".result-bar-fill").all()) {
    await expect(fill).toHaveCSS("animation-name", "none");
    await expect(fill).toHaveCSS("transform", "none");
  }
  await expect(page.locator(".confidence strong")).toHaveText("87.4%");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../.artifacts/phase6-unknown-mobile-reduced.png", fullPage: true });
  const reset = page.getByRole("button", { name: "Analyze Another Image" });
  await reset.hover();
  await expect(reset).toHaveCSS("translate", "none");
  await reset.click();
  await submit(page);
  await expect(page.locator(".confidence-track .result-bar-fill")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".confidence strong")).toHaveText("87.4%");
});
