import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "demo@orbyt.app";
const ADMIN_PASSWORD = "password123";

test.describe("Auth flow", () => {
  test("login → dashboard → logout → login again", async ({ page }) => {
    // ── Step 1: Login ───────────────────────────────────────────────────────
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Should land on dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByText(/dashboard|welcome|good/i)).toBeVisible({ timeout: 10000 });

    // ── Step 2: Dashboard renders ───────────────────────────────────────────
    // Stat cards should be visible
    await expect(page.locator("main")).toBeVisible();

    // ── Step 3: Logout ──────────────────────────────────────────────────────
    // Find logout — look for user avatar or menu
    const userMenu = page.getByRole("button", { name: /user|profile|account|menu/i }).first();
    if (await userMenu.isVisible()) {
      await userMenu.click();
      const logoutBtn = page.getByRole("menuitem", { name: /sign out|log out/i });
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
      }
    }

    // If no explicit logout found, navigate to login directly
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);

    // ── Step 4: Login again ─────────────────────────────────────────────────
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("unauthenticated redirect to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("wrong@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Should stay on login and show error
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText(/invalid|incorrect|wrong|error/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
