import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build (`npm run build` first)
 * using an isolated, freshly seeded development store in .data-e2e.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  // Most tests run with the first-visit popup already dismissed; welcome.spec.ts starts from a clean browser.
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure", storageState: "e2e/quiet.storage.json" },
  webServer: {
    command: "rm -rf .data-e2e && NIVORE_DATA_DIR=.data-e2e SESSION_SECRET=e2e-only-secret-0123456789abcdefghijklmnop ADMIN_EMAIL=atelier@nivore.local ADMIN_PASSWORD=atelier-e2e-password npx next start -p 3200",
    url: "http://localhost:3200",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
