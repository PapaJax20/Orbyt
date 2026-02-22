import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const ADMIN_EMAIL = "demo@orbyt.app";
export const ADMIN_PASSWORD = "password123";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 12000 });
}
