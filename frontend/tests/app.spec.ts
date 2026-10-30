import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const riceImage = path.resolve("public/images/rice-leaffolder.jpg");
const healthyImage = path.resolve("public/images/healthy-rice.jpg");

test("home, education navigation, assets, and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Identify Rice Pests",
  );
  await expect(page.locator(".hero-image")).toHaveCount(4);
  await expect(page.locator(".features .feature-card")).toHaveCount(4);
  await expect.poll(() => page.locator(".hero-image").evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.screenshot({
    path: "../.artifacts/home-desktop.png",
    fullPage: true,
  });
  await page.getByRole("navigation").getByRole("link", { name: "Pest Guide" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Common Rice Pests and Their Damage",
  );
  await page.screenshot({ path: "../.artifacts/guide-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "View Details" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Stem Borer",
  );
  await expect(page.getByRole("heading", { name: "Typical damage characteristics" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of [
    "/",
    "/analyze",
    "/pest-guide",
    "/pest-guide/stem-borer",
    "/about",
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Analyze", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.screenshot({
    path: "../.artifacts/analyze-mobile.png",
    fullPage: true,
  });
  await page.goto("/");
  await page.screenshot({
    path: "../.artifacts/home-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("real model inference displays the API probabilities and uploaded image", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page.screenshot({
    path: "../.artifacts/analyze-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Choose crop image").setInputFiles(riceImage);
  await expect(page.getByAltText("Selected rice crop preview")).toBeVisible();
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith("/api/analyze") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Analyze Image", exact: true })
    .click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(Object.keys(result.probabilities)).toHaveLength(4);
  await expect(
    page.getByRole("heading", { name: "Your Analysis Results" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      `Confidence Score: ${(result.confidence * 100).toFixed(1)}%`,
    ),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(4);
  await page.screenshot({
    path: "../.artifacts/results-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../.artifacts/results-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Analyze Another Image" }).click();
  await expect(
    page.getByRole("button", { name: "Choose Image", exact: true }),
  ).toBeVisible();
});

test("invalid uploads, remove, API failure and duplicate-request protection", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page.getByLabel("Choose crop image").setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("Unsupported format");
  await page.getByLabel("Choose crop image").setInputFiles({
    name: "corrupt.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("could not be read");
  await page.getByLabel("Choose crop image").setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert")).toContainText("too large");
  await page.getByLabel("Choose crop image").setInputFiles(healthyImage);
  await page.getByRole("button", { name: "Remove image" }).click();
  await expect(
    page.getByRole("button", { name: "Choose Image", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Choose crop image").setInputFiles(healthyImage);
  let requests = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/analyze", async (route) => {
    requests++;
    await gate;
    await route.fulfill({
      status: 503,
      json: { error: "The trained model is unavailable." },
    });
  });
  await page
    .getByRole("button", { name: "Analyze Image", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Analyzing Image…", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Replace" })).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toContainText("model is unavailable");
  expect(requests).toBe(1);
  await expect(page.getByAltText("Selected rice crop preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analyze Image", exact: true }),
  ).toBeEnabled();
});

// Fixtures only exercise UI branches. Production predictions always come from the model API.
for (const predicted of [
  "healthy_rice",
  "unknown",
  "rice_leaffolder",
  "rice_stem_borer",
]) {
  test(`result presentation for ${predicted} and guide link`, async ({
    page,
  }) => {
    await page.route("**/api/analyze", (route) =>
      route.fulfill({
        json: {
          prediction: predicted,
          confidence: 0.91,
          probabilities: Object.fromEntries(
            [
              "healthy_rice",
              "rice_leaffolder",
              "rice_stem_borer",
              "unknown",
            ].map((id) => [id, id === predicted ? 0.91 : 0.03]),
          ),
          model: "UI test fixture",
          unknown_method: "trained_class",
        },
      }),
    );
    await page.goto("/analyze");
    await page.getByLabel("Choose crop image").setInputFiles(healthyImage);
    await page
      .getByRole("button", { name: "Analyze Image", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your Analysis Results" }),
    ).toBeVisible();
    const photo = await page.locator(".result-image").boundingBox();
    const probabilities = await page.locator(".probability-section").boundingBox();
    expect(probabilities!.y).toBeGreaterThan(photo!.y + photo!.height);
    await page.screenshot({ path: `../.artifacts/result-${predicted}-fixture.png`, fullPage: true });
    if (predicted === "unknown") {
      await expect(
        page.getByRole("heading", {
          name: "Unknown (Other Damage)",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("not independently detected findings", { exact: false }),
      ).toBeVisible();
      await expect(page.locator(".results-panel")).toHaveClass(/unknown/);
      await expect(page.getByRole("progressbar")).toHaveCount(4);
      await page.screenshot({
        path: "../.artifacts/unknown-result-fixture.png",
        fullPage: true,
      });
      await page.getByRole("link", { name: "Learn More", exact: true }).click();
      await expect(page).toHaveURL(/pest-guide\/unknown-damage$/);
      await expect(
        page.getByRole("heading", {
          name: "Tips for clearer crop photographs",
        }),
      ).toBeVisible();
    } else {
      if (predicted === "healthy_rice")
        await expect(
          page.getByText(
            "does not confirm that the plant is completely pest-free",
            { exact: false },
          ),
        ).toBeVisible();
      else
        await expect(
          page.getByText("not separately verified findings", { exact: false }),
        ).toBeVisible();
      await page.getByRole("link", { name: /Learn More/ }).click();
      await expect(page).toHaveURL(
        new RegExp(
          predicted === "healthy_rice"
            ? "healthy-rice"
            : predicted === "rice_stem_borer"
              ? "stem-borer"
              : "rice-leaffolder",
        ),
      );
    }
  });
}

test("camera permission failure provides a usable fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/analyze");
  await page.getByRole("button", { name: "Capture Image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("permission was denied");
  await expect(
    page.getByRole("button", { name: "Capture Photo" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Choose Image", exact: true }),
  ).toBeEnabled();
});

test("hero cycles every five seconds without moving copy, can pause, and respects reduced motion", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator(".hero-image").first()).toHaveClass(/active/);
  const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
  for (const slide of [1, 2, 3, 0]) {
    await page.clock.runFor(5000);
    await expect(page.locator(".hero-image").nth(slide)).toHaveClass(/active/);
    expect(await page.getByRole("heading", { level: 1 }).boundingBox()).toEqual(heading);
  }
  await page.getByRole("button", { name: "Pause background animation" }).click();
  await page.clock.runFor(10000);
  await expect(page.locator(".hero-image").first()).toHaveClass(/active/);
  await page.getByRole("button", { name: "Play background animation" }).click();
  await page.clock.runFor(5000);
  await expect(page.locator(".hero-image").nth(1)).toHaveClass(/active/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".hero-image").first()).toHaveClass(/active/);
  await page.clock.runFor(10000);
  await expect(page.locator(".hero-image").first()).toHaveClass(/active/);
  await expect(page.locator(".hero-image").first()).toHaveCSS("animation-name", "none");
  await expect(page.locator(".crop-preview").first()).toHaveCSS("animation-name", "none");
});

test("drag and drop selects a real image and replacement updates the preview", async ({
  page,
}) => {
  await page.goto("/analyze");
  const bytes = [...fs.readFileSync(riceImage)];
  const transfer = await page.evaluateHandle((bytes) => {
    const data = new DataTransfer();
    data.items.add(
      new File([new Uint8Array(bytes)], "dropped-rice.jpg", {
        type: "image/jpeg",
      }),
    );
    return data;
  }, bytes);
  await page
    .locator(".dropzone")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByAltText("Selected rice crop preview")).toBeVisible();
  await expect(
    page.getByText("dropped-rice.jpg", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Choose crop image").setInputFiles(healthyImage);
  await expect(
    page.getByText("healthy-rice.jpg", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("dropped-rice.jpg", { exact: true })).toHaveCount(
    0,
  );
});

test("camera capture produces a photo and stops the video stream", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const draw = () => {
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#458c46";
          ctx.fillRect(0, 0, 640, 480);
        };
        draw();
        const timer = setInterval(draw, 100);
        const stream = canvas.captureStream(10);
        (
          window as unknown as { testCameraStream: MediaStream }
        ).testCameraStream = stream;
        stream
          .getTracks()[0]
          .addEventListener("ended", () => clearInterval(timer));
        return stream;
      },
    });
  });
  await page.goto("/analyze");
  await page.getByRole("button", { name: "Capture Image" }).click();
  await expect(
    page.getByRole("button", { name: "Capture Photo" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Capture Photo" }).click();
  await expect(page.getByAltText("Selected rice crop preview")).toBeVisible();
  await expect(
    page.getByText("rice-crop-photo.jpg", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as unknown as { testCameraStream: MediaStream }).testCameraStream
        .getTracks()
        .every((track) => track.readyState === "ended"),
    ),
  ).toBe(true);
});
