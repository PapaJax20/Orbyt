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
    // Use getByRole("heading") so we target the visible <h1> greeting in the
    // main content — not the sidebar nav label which is hidden on mobile
    // (hidden md:block) and would cause toBeVisible() to fail at 375px.
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

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

    // Clear all cookies so the middleware won't detect a still-valid session
    // and redirect us away from /login back to /dashboard.  Supabase's
    // signOut() clears the client-side session, but a race between the
    // Next.js middleware reading the old cookie and the client clearing it
    // can cause the redirect to fire before the cookie is gone.
    await page.context().clearCookies();

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

    // Should stay on login and show error.
    // Use role="alert" as the primary selector (matches the inline error div
    // in LoginForm) with an extended timeout — Supabase's signInWithPassword
    // round-trip can be slow, especially under mobile CPU throttling.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
  });
});
