import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const healthy = path.resolve("public/images/healthy-rice.jpg");
const damaged = path.resolve("public/images/rice-leaffolder.jpg");
const classes = ["healthy_rice", "rice_stem_borer", "rice_leaffolder", "unknown"];

test.beforeEach(async ({ page }) => {
  // Only the health response is a fixture; these tests exercise upload UI, not inference.
  await page.route("**/api/health", route => route.fulfill({ json: {
    available: true, message: "Upload UI fixture", classes,
  } }));
});

async function imageTransfer(page: Page, count = 1) {
  return page.evaluateHandle(({ bytes, count }) => {
    const transfer = new DataTransfer();
    for (let i = 0; i < count; i++)
      transfer.items.add(new File([new Uint8Array(bytes)], `rice-${i}.jpg`, { type: "image/jpeg" }));
    return transfer;
  }, { bytes: [...fs.readFileSync(healthy)], count });
}

test("file drag feedback survives nested elements and resets on leave, cancellation and outside drops", async ({ page }) => {
  await page.goto("/analyze");
  await expect(page.locator(".analyze-page")).toHaveCSS("transform", "none");
  const zone = page.locator(".dropzone");
  const cloud = zone.locator(".upload-cloud");
  const size = await zone.boundingBox();
  const transfer = await imageTransfer(page);
  const drag = { dataTransfer: transfer, clientX: 100, clientY: 200 };
  await zone.dispatchEvent("dragenter", drag);
  await expect(zone).toHaveClass(/dragging/);
  await expect(zone).toHaveCSS("border-top-color", "rgb(0, 107, 54)");
  await expect(zone).toHaveCSS("background-color", "rgb(229, 247, 236)");
  await expect(cloud).toHaveCSS("translate", "0px -3px");
  await expect(zone.getByRole("heading")).toHaveText("Drop your crop image here");
  expect(await zone.boundingBox()).toEqual(size);
  await zone.getByRole("heading").dispatchEvent("dragenter", drag);
  await zone.getByRole("heading").dispatchEvent("dragleave", drag);
  await expect(zone).toHaveClass(/dragging/);
  await page.screenshot({ path: "../.artifacts/phase4-drag-active.png", fullPage: true });
  await zone.dispatchEvent("dragleave", drag);
  await expect(zone).not.toHaveClass(/dragging/);
  await expect(cloud).toHaveCSS("translate", "none");

  for (const cancel of ["escape", "dragend", "blur", "window-leave", "outside-over", "outside-drop"]) {
    await zone.dispatchEvent("dragenter", drag);
    await expect(zone).toHaveClass(/dragging/);
    if (cancel === "escape") await page.keyboard.press("Escape");
    else if (cancel === "window-leave") await page.locator("body").dispatchEvent("dragleave", { ...drag, clientX: 0 });
    else if (cancel === "outside-over") await page.locator(".photo-tips").dispatchEvent("dragover", drag);
    else if (cancel === "outside-drop") await page.locator(".photo-tips").dispatchEvent("drop", drag);
    else await page.evaluate(type => window.dispatchEvent(new Event(type)), cancel);
    await expect(zone).not.toHaveClass(/dragging/);
  }
  // A stray leave must not make the nesting counter negative for the next drag.
  await zone.dispatchEvent("dragleave", drag);
  await zone.dispatchEvent("dragenter", drag);
  await zone.dispatchEvent("dragleave", drag);
  await expect(zone).not.toHaveClass(/dragging/);
  const text = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "some text");
    return transfer;
  });
  await zone.dispatchEvent("dragenter", { dataTransfer: text });
  await expect(zone).not.toHaveClass(/dragging/);
  await zone.dispatchEvent("dragenter", drag);
  await zone.dispatchEvent("drop", drag);
  await expect(page.getByAltText("Selected rice crop preview")).toBeVisible();
  await expect(page.getByText("rice-0.jpg", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove image" }).click();
  await expect(zone).not.toHaveClass(/dragging/);
  await expect(page.getByRole("button", { name: "Choose Image", exact: true })).toBeFocused();
});

test("choose, cancel replacement, replace, remove and reselect preserve decoded previews and focus", async ({ page }) => {
  await page.goto("/analyze");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose Image", exact: true }).click();
  await (await chooser).setFiles(healthy);
  const image = page.getByAltText("Selected rice crop preview");
  await expect(image).toBeVisible();
  await expect(page.locator(".preview-ready")).toBeFocused();
  await expect(page.locator(".image-preview")).toHaveCSS("animation-name", "pp-scale-in");
  const middle = await page.locator(".image-preview").evaluate(el => {
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = 100;
    return { opacity: Number(getComputedStyle(el).opacity), transform: getComputedStyle(el).transform };
  });
  expect(middle.opacity).toBeGreaterThan(0);
  expect(middle.opacity).toBeLessThan(1);
  expect(middle.transform).not.toBe("none");
  await page.locator(".image-preview").evaluate(el => el.getAnimations().forEach(a => a.finish()));
  await expect(page.locator(".preview-meta")).toHaveCSS("animation-name", "pp-fade-in");
  await expect(page.getByRole("button", { name: "Analyze Image", exact: true })).toHaveCSS("opacity", "1");
  const firstURL = await image.getAttribute("src");
  const canceled = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Replace" }).click();
  await (await canceled).setFiles([]);
  await expect(image).toHaveAttribute("src", firstURL!);
  const replace = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Replace" }).click();
  await (await replace).setFiles(damaged);
  await expect(page.getByText("rice-leaffolder.jpg", { exact: true })).toBeVisible();
  await expect(image).not.toHaveAttribute("src", firstURL!);
  await expect(page.locator(".image-preview")).toHaveCSS("animation-name", "pp-scale-in");
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: "../.artifacts/phase4-preview-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Remove image" }).click();
  await expect(image).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose Image", exact: true })).toBeFocused();
  await page.getByLabel("Choose crop image").setInputFiles(damaged);
  await expect(image).toBeVisible();
});

test("invalid files and multiple drops retain validation and the previous valid image", async ({ page }) => {
  await page.goto("/analyze");
  const multiple = await imageTransfer(page, 2);
  await page.locator(".dropzone").dispatchEvent("drop", { dataTransfer: multiple });
  await expect(page.getByRole("alert")).toContainText("one image at a time");
  await expect(page.locator(".dropzone")).not.toHaveClass(/dragging/);
  await page.getByLabel("Choose crop image").setInputFiles(healthy);
  const image = page.getByAltText("Selected rice crop preview");
  const original = await image.getAttribute("src");
  for (const [name, mimeType, buffer, message] of [
    ["invalid.txt", "text/plain", Buffer.from("text"), "Unsupported format"],
    ["corrupt.png", "image/png", Buffer.from("not an image"), "could not be read"],
    ["large.png", "image/png", Buffer.alloc(10 * 1024 * 1024 + 1), "too large"],
    ["empty.png", "image/png", Buffer.alloc(0), "empty"],
  ] as const) {
    await page.getByLabel("Choose crop image").setInputFiles({ name, mimeType, buffer });
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(image).toHaveAttribute("src", original!);
    await expect(page.getByRole("button", { name: "Replace" })).toBeEnabled();
  }
});

test("upload controls show hover, keyboard and pressed feedback while analysis locks image actions", async ({ page }) => {
  await page.goto("/analyze");
  const choose = page.getByRole("button", { name: "Choose Image", exact: true });
  await choose.hover();
  await expect(choose).toHaveCSS("translate", "0px -2px");
  await page.mouse.down();
  await expect(choose).toHaveCSS("translate", "0px");
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await choose.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Capture Image" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Capture Image" })).toHaveCSS("outline-width", "3px");
  await page.getByLabel("Choose crop image").setInputFiles(healthy);
  const analyze = page.getByRole("button", { name: "Analyze Image", exact: true });
  await analyze.hover();
  await expect(analyze).toHaveCSS("translate", "0px -2px");
  await expect(analyze.locator(".upload-arrow")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 3, 0)");
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/analyze", async route => {
    calls++;
    expect(route.request().postDataBuffer()?.includes(Buffer.from("healthy-rice.jpg"))).toBe(true);
    await gate;
    await route.fulfill({ status: 503, json: { error: "Temporary analysis failure" } });
  });
  await analyze.click();
  await expect(page.locator(".analyze-button")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Replace" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Remove image" })).toBeDisabled();
  await expect(page.getByLabel("Choose crop image")).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Analyzing rice crop image...");
  release();
  await expect(page.getByRole("alert")).toContainText("Temporary analysis failure");
  expect(calls).toBe(1);
  await expect(analyze).toBeEnabled();
  await expect(page.getByAltText("Selected rice crop preview")).toBeVisible();
});

test("the four supported image cards highlight without changing dimensions and keep guide links", async ({ page }) => {
  await page.goto("/analyze");
  await expect(page.locator(".analyze-page")).toHaveCSS("transform", "none");
  const cards = page.locator(".classification-card");
  await expect(cards.locator("h3")).toHaveText(["Healthy Rice", "Stem Borer Damage", "Rice Leaffolder Damage", "Unknown (Other Damage)"]);
  const card = cards.first();
  const bounds = await card.boundingBox();
  await card.hover();
  await expect(card.locator("img")).toHaveCSS("transform", "matrix(1.025, 0, 0, 1.025, 0, 0)");
  expect(await card.boundingBox()).toEqual(bounds);
  await page.mouse.move(0, 0);
  await expect(card.locator("img")).toHaveCSS("transform", "none");
  await card.focus();
  await page.keyboard.press("Tab");
  await expect(cards.nth(1)).toBeFocused();
  await expect(cards.nth(1)).toHaveCSS("outline-width", "3px");
  await cards.last().click();
  await expect(page).toHaveURL(/pest-guide\/unknown-damage$/);
});

test("reduced motion keeps upload states immediate, readable and stationary", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/analyze");
  const transfer = await imageTransfer(page);
  await page.locator(".dropzone").dispatchEvent("dragenter", { dataTransfer: transfer });
  await expect(page.locator(".dropzone")).toHaveCSS("border-top-color", "rgb(0, 107, 54)");
  await expect(page.locator(".upload-cloud")).toHaveCSS("translate", "none");
  await expect(page.locator(".dropzone")).toHaveCSS("transition-duration", "0s");
  await page.locator(".dropzone").dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.locator(".image-preview")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".image-preview")).toHaveCSS("opacity", "1");
  await expect(page.locator(".analyze-button")).toHaveCSS("animation-name", "none");
  await page.locator(".analyze-button").hover();
  await expect(page.locator(".analyze-button")).toHaveCSS("translate", "none");
  await expect(page.locator(".upload-arrow")).toHaveCSS("transform", "none");
  await page.locator(".classification-card").first().hover();
  await expect(page.locator(".classification-card img").first()).toHaveCSS("transform", "none");
});

test("mobile camera input preserves capture compatibility and touch has no persistent hover movement", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await page.route("**/api/health", route => route.fulfill({ json: { available: true, message: "Mobile UI fixture", classes } }));
  await page.goto("/analyze");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Capture Image" }).tap();
  const camera = await chooser;
  expect(await camera.element().getAttribute("capture")).toBe("environment");
  await camera.setFiles({ name: "mobile-crop.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(healthy) });
  await expect(page.getByAltText("Selected rice crop preview")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".analyze-button")).toHaveCSS("translate", "none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../.artifacts/phase4-preview-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Remove image" }).tap();
  await expect(page.locator(".dropzone")).not.toHaveClass(/dragging/);
  await page.getByRole("button", { name: "Choose Image", exact: true }).hover();
  await expect(page.getByRole("button", { name: "Choose Image", exact: true })).toHaveCSS("translate", "none");
  await context.close();
});
