import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Finances", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/finances");
    // Wait for page to load.
    // Use getByRole("heading") to target the visible <h1>Finances</h1> in the
    // page content. getByText(/finances/i).first() would match the sidebar nav
    // label first, which is hidden on mobile (hidden md:block) and causes
    // toBeVisible() to fail at 375px viewport.
    await expect(page.getByRole("heading", { name: /finances/i })).toBeVisible({ timeout: 10000 });
  });

  // ── Stat cards ───────────────────────────────────────────────────────────────

  test("renders monthly overview stat cards", async ({ page }) => {
    await expect(page.getByText(/total monthly/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/paid this month/i)).toBeVisible();
    await expect(page.getByText(/outstanding/i)).toBeVisible();
  });

  // ── Add bill ─────────────────────────────────────────────────────────────────

  test("can open Add Bill drawer", async ({ page }) => {
    await page.getByRole("button", { name: /add bill/i }).click();

    // Drawer should open and show the form
    await expect(page.getByText(/bill name/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByLabel(/amount/i)).toBeVisible();
  });

  test("drawer stays open when clicking inside form fields", async ({ page }) => {
    await page.getByRole("button", { name: /add bill/i }).click();

    const billNameInput = page.getByLabel(/bill name/i);
    await expect(billNameInput).toBeVisible({ timeout: 8000 });

    // Click various fields — drawer should remain open
    await billNameInput.click();
    await expect(billNameInput).toBeVisible();

    await page.getByLabel(/amount/i).click();
    await expect(billNameInput).toBeVisible();

    await page.getByLabel(/due day/i).click();
    await expect(billNameInput).toBeVisible();
  });

  test("can create a bill and see it on the page", async ({ page }) => {
    const billName = `E2E Bill ${Date.now()}`;

    await page.getByRole("button", { name: /add bill/i }).click();

    await page.getByLabel(/bill name/i).fill(billName);
    await page.getByLabel(/amount/i).fill("49.99");
    // Due day already defaults to 1

    // Submit — the button is the last "Add Bill" in the drawer
    await page.getByRole("button", { name: /^add bill$/i }).last().click();

    // Bill card should appear in the grid
    await expect(page.getByText(billName)).toBeVisible({ timeout: 10000 });
  });

  // ── Tab navigation ──────────────────────────────────────────────────────────

  test("can navigate to Accounts tab", async ({ page }) => {
    const accountsTab = page.getByRole("button", { name: /^accounts$/i });
    await expect(accountsTab).toBeVisible({ timeout: 5000 });
    await accountsTab.click();

    // Accounts section should render — look for "Add Account" button or "Total Balance" text
    await expect(
      page.getByRole("button", { name: /add account/i })
        .or(page.getByText(/total balance/i))
        .first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("can navigate to Transactions tab", async ({ page }) => {
    const transactionsTab = page.getByRole("button", { name: /^transactions$/i });
    await expect(transactionsTab).toBeVisible({ timeout: 5000 });
    await transactionsTab.click();

    // Transactions section should render — look for "Add Transaction" button or transaction-related content
    await expect(
      page.getByRole("button", { name: /add transaction/i })
        .or(page.getByText(/no transactions/i))
        .first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("can navigate to Analytics tab", async ({ page }) => {
    const analyticsTab = page.getByRole("button", { name: /^analytics$/i });
    if (await analyticsTab.isVisible({ timeout: 3000 })) {
      await analyticsTab.click();

      // Analytics section should render — look for chart-related content
      await expect(
        page.getByText(/spending by category/i)
          .or(page.getByText(/income vs expenses/i))
          .or(page.getByText(/no transaction data/i))
          .first()
      ).toBeVisible({ timeout: 8000 });
    }
    // Analytics tab may be hidden if the module is disabled — defensive check
  });

  test("can navigate to Budgets tab", async ({ page }) => {
    const budgetsTab = page.getByRole("button", { name: /^budgets$/i });
    await expect(budgetsTab).toBeVisible({ timeout: 5000 });
    await budgetsTab.click();

    // Budgets section should render — look for "Add Budget" button or budget-related content
    await expect(
      page.getByRole("button", { name: /add budget/i })
        .or(page.getByText(/no budgets/i))
        .first()
    ).toBeVisible({ timeout: 8000 });
  });

  // ── Bill detail ──────────────────────────────────────────────────────────────

  test("clicking a bill card opens the detail drawer", async ({ page }) => {
    // If bills exist, click one
    const billCard = page.locator(".glass-card button").first();
    if (await billCard.isVisible({ timeout: 3000 })) {
      await billCard.click();
      // Drawer should open showing bill details
      await expect(page.getByText(/mark paid|payment history/i)).toBeVisible({ timeout: 8000 });
    }
  });

  test("mark paid dialog appears and stays open", async ({ page }) => {
    // Create a bill first
    const billName = `Pay Test ${Date.now()}`;
    await page.getByRole("button", { name: /add bill/i }).click();
    await page.getByLabel(/bill name/i).fill(billName);
    await page.getByLabel(/amount/i).fill("10.00");
    await page.getByRole("button", { name: /^add bill$/i }).last().click();
    await expect(page.getByText(billName)).toBeVisible({ timeout: 10000 });

    // Open the bill
    await page.getByText(billName).click();
    await expect(page.getByRole("button", { name: /mark paid/i })).toBeVisible({ timeout: 8000 });

    // Open mark paid modal
    await page.getByRole("button", { name: /mark paid/i }).click();
    await expect(page.getByText(/mark as paid/i)).toBeVisible({ timeout: 5000 });

    // Click inside the modal — should stay open
    const amountField = page.getByLabel(/amount/i).last();
    if (await amountField.isVisible()) {
      await amountField.click();
      await expect(page.getByText(/mark as paid/i)).toBeVisible();
    }
  });
});
