import { defineConfig, devices } from "@playwright/test";

import { BASE_URL } from "./e2e/env";

/**
 * Browser tests of the admin (design/fase-3 §11.1, step 2): they pin down what
 * an editor can do, so the move to the shared admin package can be proven to
 * change nothing. `npm run test:e2e`; see e2e/serve.ts for what gets started.
 */
// `next dev` compiles a route on first visit; give it room.
const dev = process.env.E2E_MODE === "dev";

export default defineConfig({
  testDir: "e2e",
  timeout: dev ? 120_000 : 30_000,
  expect: { timeout: dev ? 30_000 : 5_000 },
  // One database, and specs that write to it: keep the order predictable.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "admin", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],
  webServer: {
    command: "npx tsx e2e/serve.ts",
    url: `${BASE_URL}/admin`,
    // Reset + seed + production build; a minute or two on a cold machine.
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
