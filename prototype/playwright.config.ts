import { defineConfig, devices } from "@playwright/test";

const externalServer = process.env.BASE_URL?.trim() || undefined;
const baseURL = externalServer ?? "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: externalServer
    ? undefined
    : {
        command: "pnpm build && pnpm start --port 3001",
        url: baseURL,
        env: { TMDB_API_TOKEN: "" },
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
});
