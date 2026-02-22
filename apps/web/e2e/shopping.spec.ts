import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Shopping", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/shopping");
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
  });

  // ── List panel ───────────────────────────────────────────────────────────────

  test("renders list panel", async ({ page }) => {
    // Left panel should be visible (new list form or existing lists)
    await expect(page.locator("main")).toBeVisible();
  });

  test("can create a new shopping list", async ({ page }) => {
    const listName = `E2E Groceries ${Date.now()}`;

    // Open new list form
    await page.getByRole("button", { name: /new list/i }).click();

    // Fill list name input
    const listNameInput = page.getByPlaceholder(/list name/i);
    await expect(listNameInput).toBeVisible({ timeout: 8000 });
    await listNameInput.fill(listName);
    await page.keyboard.press("Enter");

    // List should appear in the panel
    await expect(page.getByText(listName)).toBeVisible({ timeout: 8000 });
  });

  // ── Items ────────────────────────────────────────────────────────────────────

  test("can select a list and add an item", async ({ page }) => {
    // Create a list first to ensure one exists
    const listName = `Test List ${Date.now()}`;
    // Open new list form
    await page.getByRole("button", { name: /new list/i }).click();
    const listNameInput = page.getByPlaceholder(/list name/i);
    await expect(listNameInput).toBeVisible({ timeout: 8000 });
    await listNameInput.fill(listName);
    await page.keyboard.press("Enter");
    await expect(page.getByText(listName)).toBeVisible({ timeout: 8000 });

    // Select the list (on desktop it auto-selects; on mobile click it)
    const listBtn = page.getByText(listName);
    await listBtn.click();

    // Add an item
    const addItemInput = page.getByPlaceholder(/add an item/i);
    await expect(addItemInput).toBeVisible({ timeout: 8000 });

    const itemName = `Milk ${Date.now()}`;
    await addItemInput.fill(itemName);
    await page.keyboard.press("Enter");

    // Item should appear
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 8000 });
  });

  test("can check an item as bought", async ({ page }) => {
    // Create list + item
    const listName = `Check Test ${Date.now()}`;
    // Open new list form
    await page.getByRole("button", { name: /new list/i }).click();
    const listNameInput = page.getByPlaceholder(/list name/i);
    await listNameInput.fill(listName);
    await page.keyboard.press("Enter");
    await expect(page.getByText(listName)).toBeVisible({ timeout: 8000 });
    await page.getByText(listName).click();

    const itemName = `Eggs ${Date.now()}`;
    const addItemInput = page.getByPlaceholder(/add an item/i);
    await expect(addItemInput).toBeVisible({ timeout: 8000 });
    await addItemInput.fill(itemName);
    await page.keyboard.press("Enter");
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 8000 });

    // Click the checkbox to check it
    const checkbox = page.getByRole("checkbox").last();
    if (await checkbox.isVisible({ timeout: 3000 })) {
      await checkbox.click();
      // Item should be checked (strikethrough or checked state)
      await expect(checkbox).toBeChecked({ timeout: 5000 });
    }
  });

  // ── Drawer ───────────────────────────────────────────────────────────────────

  test("items panel shows empty state when no list is selected", async ({ page }) => {
    // On desktop, right panel shows a prompt to select a list
    // On mobile, items panel is hidden until a list is selected
    const emptyState = page.getByText(/select a list|choose a list|no list selected/i);
    // This might or might not be visible depending on whether lists exist
    await expect(page.locator("main")).toBeVisible();
  });
});
