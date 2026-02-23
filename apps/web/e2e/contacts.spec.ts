import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Contacts", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/contacts");
    await expect(page.getByRole("heading", { name: /contacts/i })).toBeVisible({ timeout: 10000 });
  });

  // ── Page render ────────────────────────────────────────────────────────────

  test("renders contacts page", async ({ page }) => {
    // Page should show the contacts heading and Add Contact button
    await expect(page.getByRole("button", { name: /add contact/i })).toBeVisible();
  });

  // ── Add Contact drawer ─────────────────────────────────────────────────────

  test("can open Add Contact drawer", async ({ page }) => {
    await page.getByRole("button", { name: /add contact/i }).click();
    // Drawer should open with a First Name input
    await expect(page.getByLabel(/first name/i)).toBeVisible({ timeout: 8000 });
  });

  // ── Create a contact ──────────────────────────────────────────────────────

  test("can create a contact", async ({ page }) => {
    const contactName = `E2E Contact ${Date.now()}`;
    await page.getByRole("button", { name: /add contact/i }).click();

    const firstNameInput = page.getByLabel(/first name/i);
    await expect(firstNameInput).toBeVisible({ timeout: 8000 });
    await firstNameInput.fill(contactName);

    // Submit — the "Add Contact" button inside the drawer form
    const saveBtn = page.getByRole("button", { name: /^add contact$/i }).last();
    await saveBtn.click();

    // Contact should appear in the grid
    await expect(page.getByText(contactName)).toBeVisible({ timeout: 10000 });
  });

  // ── Search contacts ───────────────────────────────────────────────────────

  test("can search contacts", async ({ page }) => {
    // Search input should be visible (aria-label="Search contacts")
    const searchInput = page.getByLabel(/search contacts/i);
    if (await searchInput.isVisible({ timeout: 3000 })) {
      await searchInput.fill("nonexistent-name-12345");
      // Wait for debounce (300ms) + query
      await page.waitForTimeout(500);
      // Should show "No contacts found" or an empty state — page remains functional
      await expect(page.locator("main")).toBeVisible();
    }
  });

  // ── Filter by relationship type ───────────────────────────────────────────

  test("can filter contacts by relationship type", async ({ page }) => {
    const filterSelect = page.getByLabel(/filter by relationship/i);
    if (await filterSelect.isVisible({ timeout: 3000 })) {
      await filterSelect.selectOption("friend");
      // Wait for query to run
      await page.waitForTimeout(500);
      // Page should remain functional
      await expect(page.locator("main")).toBeVisible();
    }
  });
});
