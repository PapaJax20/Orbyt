import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      // NOTE: We emulate mobile using a Chromium-based device (Pixel 5) rather
      // than WebKit (iPhone SE) because WebKit on localhost drops Supabase auth
      // cookies set via SameSite=Lax during client-side router.push() navigations,
      // causing loginAsAdmin() to fail — the middleware sees no session and
      // redirects back to /login. Chromium mobile emulation gives us genuine
      // mobile viewport + UA testing without the WebKit cookie limitation.
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 667 },
      },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
      },
});
