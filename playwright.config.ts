import { defineConfig, devices } from "@playwright/test";

import {
  E2E_API_URL,
  E2E_BASE_URL,
  E2E_DATABASE_NAME,
  E2E_MONGO_URI
} from "./e2e/support/environment.js";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI === "true" ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  forbidOnly: process.env.CI === "true",
  reporter:
    process.env.CI === "true"
      ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
      : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results/playwright",
  globalTeardown: "./e2e/support/global-teardown.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "pnpm e2e:serve:api",
      url: `${E2E_API_URL}/ready`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        NODE_ENV: "test",
        API_PORT: "4000",
        WEB_ORIGIN: E2E_BASE_URL,
        PERSISTENCE_MODE: "required",
        MONGO_URI: E2E_MONGO_URI,
        MONGO_DB_NAME: E2E_DATABASE_NAME,
        CODELIFT_E2E_MONGO_URI: E2E_MONGO_URI,
        AI_PROVIDER: "python_mock",
        AI_PYTHON_BASE_URL: "http://127.0.0.1:9",
        AI_TIMEOUT_MS: "500",
        AI_MAX_RETRIES: "0",
        AI_EXTERNAL_ENABLED: "false",
        AI_AGENT_ENABLED: "false"
      }
    },
    {
      command: "pnpm --filter @codelift/web dev",
      url: E2E_BASE_URL,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe"
    }
  ]
});
