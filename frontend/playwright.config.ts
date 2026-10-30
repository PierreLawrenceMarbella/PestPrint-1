import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5000",
    headless: true,
    channel: "msedge",
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
  },
});
