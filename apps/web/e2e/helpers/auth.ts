import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const ADMIN_EMAIL = "demo@orbyt.app";
export const ADMIN_PASSWORD = "password123";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for the URL to change to /dashboard.  We use waitForURL (which waits
  // for an actual navigation event) rather than just polling toHaveURL, so that
  // the auth cookies set by Supabase have time to be written and picked up by
  // the Next.js middleware before we assert.
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  // Final assertion — belt-and-suspenders
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
}
