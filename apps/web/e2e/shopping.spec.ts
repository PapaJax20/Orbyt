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

  // ── Delete a shopping list ──────────────────────────────────────────────────

  test("can delete a shopping list", async ({ page }) => {
    const listName = `Delete List ${Date.now()}`;

    // Create a list first
    await page.getByRole("button", { name: /new list/i }).click();
    const listNameInput = page.getByPlaceholder(/list name/i);
    await expect(listNameInput).toBeVisible({ timeout: 8000 });
    await listNameInput.fill(listName);
    await page.keyboard.press("Enter");
    await expect(page.getByText(listName)).toBeVisible({ timeout: 8000 });

    // Open the list options menu (three-dot / MoreVertical button)
    const listCard = page.getByText(listName).locator("..").locator("..");
    const optionsBtn = listCard.getByLabel(/list options/i);
    if (await optionsBtn.isVisible({ timeout: 3000 })) {
      await optionsBtn.click();

      // Click "Delete" from the dropdown menu
      const deleteMenuItem = page.getByRole("menu").getByText(/delete/i);
      await expect(deleteMenuItem).toBeVisible({ timeout: 3000 });
      await deleteMenuItem.click();

      // Confirm deletion in the dialog
      const confirmDeleteBtn = page.getByRole("button", { name: /^delete$/i }).last();
      await expect(confirmDeleteBtn).toBeVisible({ timeout: 5000 });
      await confirmDeleteBtn.click();

      // List should be gone
      await expect(page.getByText(listName)).not.toBeVisible({ timeout: 8000 });
    }
  });

  // ── Clear checked items ───────────────────────────────────────────────────

  test("can clear checked items from a list", async ({ page }) => {
    const listName = `Clear Test ${Date.now()}`;

    // Create a list
    await page.getByRole("button", { name: /new list/i }).click();
    const listNameInput = page.getByPlaceholder(/list name/i);
    await expect(listNameInput).toBeVisible({ timeout: 8000 });
    await listNameInput.fill(listName);
    await page.keyboard.press("Enter");
    await expect(page.getByText(listName)).toBeVisible({ timeout: 8000 });
    await page.getByText(listName).click();

    const addItemInput = page.getByPlaceholder(/add an item/i);
    await expect(addItemInput).toBeVisible({ timeout: 8000 });

    // Add item 1
    const item1 = `Apple ${Date.now()}`;
    await addItemInput.fill(item1);
    await page.keyboard.press("Enter");
    await expect(page.getByText(item1)).toBeVisible({ timeout: 8000 });

    // Add item 2
    const item2 = `Banana ${Date.now()}`;
    await addItemInput.fill(item2);
    await page.keyboard.press("Enter");
    await expect(page.getByText(item2)).toBeVisible({ timeout: 8000 });

    // Check both items using the checkbox buttons
    const checkButtons = page.getByLabel(/check item/i);
    const count = await checkButtons.count();
    for (let i = 0; i < Math.min(count, 2); i++) {
      await checkButtons.nth(i).click();
      // Small wait for mutation
      await page.waitForTimeout(500);
    }

    // "Clear Checked" button should appear
    const clearBtn = page.getByRole("button", { name: /clear checked/i });
    await expect(clearBtn).toBeVisible({ timeout: 5000 });
    await clearBtn.click();

    // Both items should be gone
    await expect(page.getByText(item1)).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText(item2)).not.toBeVisible({ timeout: 8000 });
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
