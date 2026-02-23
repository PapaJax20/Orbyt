import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible({ timeout: 10000 });
  });

  // ── Tab rendering ─────────────────────────────────────────────────────────

  test("renders settings tabs", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /profile/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /household/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /appearance/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /notifications/i })).toBeVisible();
  });

  // ── Appearance tab ────────────────────────────────────────────────────────

  test("can switch to Appearance tab and see themes", async ({ page }) => {
    await page.getByRole("tab", { name: /appearance/i }).click();
    // Should see theme options (Orbit, Solar, Aurora, Nebula, etc.)
    await expect(
      page.getByText(/orbit|solar|aurora|nebula/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  // ── Profile tab ───────────────────────────────────────────────────────────

  test("profile tab shows display name and avatar", async ({ page }) => {
    // Profile tab is the default
    await expect(page.getByLabel(/display name/i)).toBeVisible({ timeout: 8000 });
    // Avatar section should be visible
    await expect(page.getByText(/avatar/i).first()).toBeVisible();
  });

  // ── Finance module toggles ────────────────────────────────────────────────

  test("can see finance module toggles", async ({ page }) => {
    // Scroll down to find finance modules section in the profile tab
    await expect(page.getByText(/finance modules/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/goals/i).first()).toBeVisible();
    await expect(page.getByText(/net worth/i).first()).toBeVisible();
  });

  // ── Household tab ─────────────────────────────────────────────────────────

  test("can switch to Household tab", async ({ page }) => {
    await page.getByRole("tab", { name: /household/i }).click();
    // Should see household-related content
    await expect(page.locator("main")).toBeVisible();
    // Wait for content to load
    await page.waitForTimeout(1000);
    // The tab panel should be visible
    await expect(page.locator("[data-state=active]").last()).toBeVisible();
  });

  // ── Notifications tab ─────────────────────────────────────────────────────

  test("can switch to Notifications tab", async ({ page }) => {
    await page.getByRole("tab", { name: /notifications/i }).click();
    // Should see notification-related content
    await expect(page.locator("main")).toBeVisible();
    // Wait for content to load
    await page.waitForTimeout(1000);
    // The tab panel should be visible
    await expect(page.locator("[data-state=active]").last()).toBeVisible();
  });
});
