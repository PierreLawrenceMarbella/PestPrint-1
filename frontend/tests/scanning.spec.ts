import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const image = path.resolve("public/images/rice-leaffolder.jpg");
const classes = ["healthy_rice", "rice_stem_borer", "rice_leaffolder", "unknown"];
// API fixtures test presentation and request lifetime only. Production uses the model API.
const prediction = {
  prediction: "rice_leaffolder", confidence: 0.943,
  probabilities: { healthy_rice: 0.019, rice_stem_borer: 0.017, rice_leaffolder: 0.943, unknown: 0.021 },
  model: "Scanning UI fixture", unknown_method: "trained_class",
};

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", route => route.fulfill({ json: {
    available: true, message: "Scanning UI fixture", classes,
  } }));
  await page.addInitScript(() => {
    const original = window.fetch;
    // Observe the real browser AbortSignal without replacing fetch behavior.
    const state = window as unknown as { analysisSignal?: AbortSignal };
    window.fetch = (input, init) => {
      if (String(input).endsWith("/api/analyze")) state.analysisSignal = init?.signal ?? undefined;
      return original(input, init);
    };
  });
});

async function ready(page: Page) {
  await page.goto("/analyze");
  await page.getByLabel("Choose crop image").setInputFiles(image);
  await expect(page.locator(".image-preview")).toHaveCSS("transform", "none");
  await expect(page.locator(".analyze-button")).toBeEnabled();
}

async function wasAborted(page: Page) {
  return page.evaluate(() => (window as unknown as { analysisSignal?: AbortSignal }).analysisSignal?.aborted);
}

test("pending request scans the visible original, blocks duplicates and shows unaltered results without waiting for animation", async ({ page }) => {
  const response = gate();
  let calls = 0;
  await page.route("**/api/analyze", async route => {
    calls++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataBuffer()?.includes(Buffer.from("rice-leaffolder.jpg"))).toBe(true);
    await response.promise;
    await route.fulfill({ json: prediction });
  });
  await ready(page);
  const photo = page.getByAltText("Selected rice crop preview");
  const src = await photo.getAttribute("src");
  const bounds = await photo.boundingBox();
  await expect(page.locator(".analysis-overlay")).toHaveCount(0);
  await page.locator(".analyze-button").evaluate(button => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.locator(".analysis-overlay")).toBeVisible();
  await expect(page.locator(".analysis-corner")).toHaveCount(4);
  await expect(page.getByRole("status")).toHaveText("Analyzing rice crop image...");
  expect(await page.getByRole("status").evaluate(el => el.closest('[aria-busy="true"]'))).toBeNull();
  await expect(photo).toHaveAttribute("src", src!);
  await expect(photo).toHaveCSS("opacity", "1");
  expect(await photo.boundingBox()).toEqual(bounds);
  await expect(page.locator(".analysis-overlay")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.locator(".analysis-overlay")).not.toContainText("%");
  await expect(page.getByRole("button", { name: "Remove image" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Replace" })).toBeDisabled();
  const sweep = page.locator(".analysis-sweep");
  const start = await sweep.evaluate(el => getComputedStyle(el).transform);
  await expect.poll(() => sweep.evaluate(el => getComputedStyle(el).transform)).not.toBe(start);
  await page.screenshot({ path: "../.artifacts/phase5-scanning-desktop.png", fullPage: true });
  // A permanently paused sweep must not hold back completed API results.
  await sweep.evaluate(el => el.getAnimations().forEach(animation => animation.pause()));
  response.release();
  await expect(page.getByRole("heading", { name: "Your Analysis Results" })).toBeVisible();
  await expect(page.locator(".analysis-overlay")).toHaveCount(0);
  await expect(page.locator(".confidence")).toHaveText("Confidence Score: 94.3%");
  await expect(page.getByRole("progressbar", { name: "Rice Leaffolder Damage" })).toHaveAttribute("aria-valuenow", "94.3");
  await expect(page.getByAltText("Uploaded rice crop used for this analysis")).toHaveAttribute("src", src!);
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Analyze Another Image" }).click();
  await expect(page.locator(".dropzone")).toBeVisible();
  await expect(page.locator(".analysis-overlay")).toHaveCount(0);
});

test("HTTP, network and malformed-response failures stop scanning, retain the image and allow retry", async ({ page }) => {
  await ready(page);
  const photo = page.getByAltText("Selected rice crop preview");
  const src = await photo.getAttribute("src");
  for (const [failure, message] of [
    ["http", "The trained model is unavailable."],
    ["network", "Could not reach the analysis service"],
    ["malformed", "unsupported response"],
  ]) {
    const response = gate();
    await page.route("**/api/analyze", async route => {
      await response.promise;
      if (failure === "network") await route.abort("failed");
      else if (failure === "http") await route.fulfill({ status: 503, json: { error: message } });
      else await route.fulfill({ json: { ...prediction, confidence: 1.5 } });
    });
    await page.locator(".analyze-button").click();
    await expect(page.locator(".analysis-overlay")).toBeVisible();
    response.release();
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.locator(".analysis-overlay")).toHaveCount(0);
    await expect(page.locator(".upload-panel")).toHaveAttribute("aria-busy", "false");
    await expect(photo).toHaveAttribute("src", src!);
    await expect(page.locator(".analyze-button")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Replace" })).toBeEnabled();
    await page.unroute("**/api/analyze");
  }
  await page.route("**/api/analyze", route => route.fulfill({ json: prediction }));
  await page.locator(".analyze-button").click();
  await expect(page.getByRole("heading", { name: "Your Analysis Results" })).toBeVisible();
});

test("cancel aborts the request, ignores a late response and returns focus for retry", async ({ page }) => {
  const response = gate();
  const completed = gate();
  await page.route("**/api/analyze", async route => {
    await response.promise;
    // The browser may reject fulfillment after its fetch was aborted.
    await route.fulfill({ json: prediction }).catch(() => {});
    completed.release();
  });
  await ready(page);
  const src = await page.getByAltText("Selected rice crop preview").getAttribute("src");
  await page.locator(".analyze-button").click();
  await expect(page.locator(".analysis-overlay")).toBeVisible();
  await page.getByRole("button", { name: "Cancel Analysis" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => wasAborted(page)).toBe(true);
  await expect(page.locator(".analysis-overlay")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Analysis canceled. Your image is ready to try again.");
  await expect(page.locator(".analyze-button")).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByAltText("Selected rice crop preview")).toHaveAttribute("src", src!);
  response.release();
  await completed.promise;
  await expect(page.locator(".results-page")).toHaveCount(0);
  await page.unroute("**/api/analyze");
  await page.route("**/api/analyze", route => route.fulfill({ json: prediction }));
  await page.locator(".analyze-button").click();
  await expect(page.getByRole("heading", { name: "Your Analysis Results" })).toBeVisible();
});

test("navigation aborts pending analysis and a new Analyze visit starts clean", async ({ page }) => {
  const response = gate();
  await page.route("**/api/analyze", async route => {
    await response.promise;
    await route.fulfill({ json: prediction }).catch(() => {});
  });
  await ready(page);
  await page.locator(".analyze-button").click();
  await expect(page.locator(".analysis-overlay")).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Pest Guide" }).click();
  await expect.poll(() => wasAborted(page)).toBe(true);
  await expect(page.locator(".analysis-overlay")).toHaveCount(0);
  response.release();
  await page.getByRole("navigation").getByRole("link", { name: "Analyze", exact: true }).click();
  await expect(page.locator(".dropzone")).toBeVisible();
  await expect(page.locator(".analysis-overlay, .results-page")).toHaveCount(0);
});

test("timeout aborts the request, stops the scanner and retains a usable image", async ({ page }) => {
  const response = gate();
  await page.clock.install();
  await page.route("**/api/analyze", async route => {
    await response.promise;
    await route.fulfill({ json: prediction }).catch(() => {});
  });
  await ready(page);
  await page.locator(".analyze-button").click();
  await expect(page.locator(".analysis-overlay")).toBeVisible();
  await page.clock.fastForward(90_000);
  await expect(page.getByRole("alert")).toContainText("Analysis timed out");
  await expect.poll(() => wasAborted(page)).toBe(true);
  await expect(page.locator(".analysis-overlay")).toHaveCount(0);
  await expect(page.locator(".analyze-button")).toBeEnabled();
  await expect(page.getByAltText("Selected rice crop preview")).toBeVisible();
  response.release();
});

test("scanner fits mobile and desktop, pauses in hidden tabs and honors live reduced-motion changes", async ({ page }) => {
  const response = gate();
  await page.route("**/api/analyze", async route => {
    await response.promise;
    await route.fulfill({ json: prediction }).catch(() => {});
  });
  await ready(page);
  await page.locator(".analyze-button").click();
  await expect(page.locator(".analysis-overlay")).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("navigation", { includeHidden: true })).toHaveCSS("visibility", width <= 600 ? "hidden" : "visible");
    const frame = (await page.locator(".image-preview").boundingBox())!;
    const status = (await page.locator(".analysis-processing").boundingBox())!;
    expect(status.x).toBeGreaterThan(frame.x);
    expect(status.x + status.width).toBeLessThan(frame.x + frame.width);
    expect(status.y + status.height).toBeLessThan(frame.y + frame.height);
    await expect(page.getByRole("button", { name: "Cancel Analysis" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 320 || width === 1440)
      await page.screenshot({ path: `../.artifacts/phase5-scanning-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".analysis-sweep")).toHaveCSS("animation-play-state", "paused");
  await expect(page.locator(".analysis-processing .spin")).toHaveCSS("animation-play-state", "paused");
  await expect(page.locator(".analyze-button .spin")).toHaveCSS("animation-play-state", "paused");
  expect(await wasAborted(page)).toBe(false);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".analysis-sweep")).toHaveCSS("animation-play-state", "running");
  await expect(page.locator(".analyze-button .spin")).toHaveCSS("animation-play-state", "running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".analysis-sweep")).toHaveCSS("display", "none");
  await expect(page.locator(".analysis-processing .spin")).toHaveCSS("animation-name", "none");
  await expect(page.getByRole("status")).toHaveText("Analyzing rice crop image...");
  await expect(page.getByAltText("Selected rice crop preview")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "../.artifacts/phase5-reduced-motion.png", fullPage: true });
  await page.getByRole("button", { name: "Cancel Analysis" }).click();
  await expect(page.locator(".analysis-overlay")).toHaveCount(0);
  response.release();
});
