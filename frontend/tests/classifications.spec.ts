import { test, expect } from "@playwright/test";
import path from "node:path";

const image = path.resolve("public/images/unknown-damage.jpg");
const currentClasses = [
  "healthy_rice",
  "rice_leaffolder",
  "rice_stem_borer",
  "unknown",
];
const labels = [
  "Healthy Rice",
  "Stem Borer Damage",
  "Rice Leaffolder Damage",
  "Unknown (Other Damage)",
];

test("four category cards accurately describe the current model and link to the guide", async ({
  page,
}) => {
  await page.goto("/analyze");
  const section = page.getByRole("region", { name: "Supported Classes" });
  await expect(section.getByRole("link")).toHaveCount(4);
  await expect(section.locator("h3")).toHaveText(labels);
  for (const name of labels)
    await expect(
      section.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(
    section.getByText("Model supported", { exact: true }),
  ).toHaveCount(4);
  await expect(section.getByText("Guide only", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Tips for Better Results" }),
  ).toBeVisible();
  expect(
    await section
      .locator("img")
      .evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
      ),
  ).toBe(true);
  await section.getByRole("link", { name: /Unknown \(Other Damage\)/ }).click();
  await expect(page).toHaveURL(/\/pest-guide\/unknown-damage$/);
  await expect(
    page.getByRole("heading", { name: "Unknown (Other Damage)", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Pest Guide" }).click();
  await expect(page.getByRole("link", { name: "View Details" })).toHaveCount(4);
  await expect(page.locator(".guide-card h2")).toHaveText([
    "Stem Borer", "Rice Leaffolder", "Healthy Rice", "Unknown (Other Damage)",
  ]);
});

test("removed pest has no advertised content or accessible detail page", async ({ page }) => {
  for (const route of ["/", "/analyze", "/pest-guide", "/about", "/pest-guide/brown-planthopper"]) {
    await page.goto(route);
    await expect(page.locator("main")).not.toContainText(/Brown Planthopper|Nilaparvata|\bBPH\b/i);
    await expect(page.locator('a[href*="brown-planthopper"], img[src*="brown-planthopper"]')).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page hasn’t taken root.");
  await expect(page.locator(".detail-panel")).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Home" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("actual model Unknown result uses four genuine probabilities and resets cleanly", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page.getByLabel("Choose crop image").setInputFiles(image);
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/analyze") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Analyze Image", exact: true })
    .click();
  const data = await (await response).json();
  expect(data.prediction).toBe("unknown");
  expect(data.unknown_method).toBe("trained_class");
  expect(Object.keys(data.probabilities).sort()).toEqual(
    [...currentClasses].sort(),
  );
  await expect(
    page.getByRole("heading", { name: "Unknown (Other Damage)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`Confidence Score: ${(data.confidence * 100).toFixed(1)}%`),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(4);
  await expect(
    page.getByRole("progressbar", { name: "Unknown (Other Damage)" }),
  ).toHaveAttribute(
    "aria-valuenow",
    String(Number((data.confidence * 100).toFixed(1))),
  );
  await expect(
    page.getByRole("progressbar", { name: "Brown Planthopper Damage" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "../.artifacts/unknown-result-real.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Analyze Another Image" }).click();
  await expect(page.getByAltText("Selected rice crop preview")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your Analysis Results" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Choose Image", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Supported Classes" }),
  ).toBeVisible();
});

// Incompatible model fixture: never advertise, relabel or renormalize its outputs.
test("a model advertising an unsupported category is rejected before inference", async ({
  page,
}) => {
  const classes = [...currentClasses, "brown_planthopper"];
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        available: true,
        classes,
        message: "Five-class development fixture",
      },
    }),
  );
  let inferenceRequests = 0;
  await page.route("**/api/analyze", (route) => {
    inferenceRequests++;
    return route.abort();
  });
  await page.goto("/analyze");
  await expect(page.getByRole("status")).toContainText("categories do not match this website");
  await expect(page.getByText("Model supported", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Supported Classes" }).getByRole("link")).toHaveCount(4);
  await page.getByLabel("Choose crop image").setInputFiles(image);
  await page
    .getByRole("button", { name: "Analyze Image", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("categories do not match this website");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.locator(".results-panel")).toHaveCount(0);
  expect(inferenceRequests).toBe(0);
});

test("unsupported predictions are not converted into a supported result", async ({ page }) => {
  await page.route("**/api/analyze", (route) => route.fulfill({
    json: {
      prediction: "brown_planthopper",
      confidence: 0.8,
      probabilities: {
        healthy_rice: 0.05, rice_leaffolder: 0.05, rice_stem_borer: 0.05,
        unknown: 0.05, brown_planthopper: 0.8,
      },
      model: "Unsupported prediction fixture",
      unknown_method: "trained_class",
    },
  }));
  await page.goto("/analyze");
  await page.getByLabel("Choose crop image").setInputFiles(image);
  await page.getByRole("button", { name: "Analyze Image", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("unsupported response");
  await expect(page.locator(".results-panel")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Brown Planthopper");
});

test("a low-confidence known class is not reassigned to Unknown", async ({
  page,
}) => {
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        prediction: "rice_leaffolder",
        confidence: 0.28,
        probabilities: {
          healthy_rice: 0.24,
          rice_leaffolder: 0.28,
          rice_stem_borer: 0.24,
          unknown: 0.24,
        },
        model: "Low-confidence development fixture",
        unknown_method: "trained_class",
      },
    }),
  );
  await page.goto("/analyze");
  await page.getByLabel("Choose crop image").setInputFiles(image);
  await page
    .getByRole("button", { name: "Analyze Image", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Rice Leaffolder", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Confidence Score: 28.0%")).toBeVisible();
  await expect(page.locator(".results-panel")).toHaveClass(/pest/);
});

test("API probabilities cannot silently add an unsupported fifth model class", async ({
  page,
}) => {
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        prediction: "unknown",
        confidence: 0.8,
        probabilities: {
          healthy_rice: 0.05,
          rice_leaffolder: 0.05,
          rice_stem_borer: 0.05,
          brown_planthopper: 0.05,
          unknown: 0.8,
        },
        model: "Invalid development fixture",
        unknown_method: "trained_class",
      },
    }),
  );
  await page.goto("/analyze");
  await page.getByLabel("Choose crop image").setInputFiles(image);
  await page
    .getByRole("button", { name: "Analyze Image", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("unsupported response");
  await expect(
    page.getByRole("heading", { name: "Your Analysis Results" }),
  ).toHaveCount(0);
});

test("updated upload and Unknown screens fit phone, tablet and desktop", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        prediction: "unknown",
        confidence: 0.91,
        probabilities: {
          healthy_rice: 0.03,
          rice_leaffolder: 0.03,
          rice_stem_borer: 0.03,
          unknown: 0.91,
        },
        model: "Responsive development fixture",
        unknown_method: "trained_class",
      },
    }),
  );
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/analyze",
      "/pest-guide",
      "/pest-guide/unknown-damage",
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/analyze");
    await expect(page.locator(".classification-card")).toHaveCount(4);
    const cards = await page.locator(".classification-card").evaluateAll((elements) => elements.map((el) => {
      const { x, y, width } = el.getBoundingClientRect();
      return { x, y, width };
    }));
    if (width >= 768) {
      expect(new Set(cards.map((card) => card.y)).size).toBe(1);
      expect(Math.max(...cards.map((card) => card.width)) - Math.min(...cards.map((card) => card.width))).toBeLessThan(1);
    } else {
      expect(cards[0].y).toBe(cards[1].y);
      expect(cards[2].y).toBe(cards[3].y);
      expect(cards[2].y).toBeGreaterThan(cards[0].y);
    }
    await page.screenshot({
      path: `../.artifacts/unknown-upload-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("Choose crop image").setInputFiles(image);
    await page
      .getByRole("button", { name: "Analyze Image", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your Analysis Results" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../.artifacts/unknown-result-fixture-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
