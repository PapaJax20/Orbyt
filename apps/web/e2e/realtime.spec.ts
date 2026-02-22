/**
 * Real-time collaboration tests.
 *
 * Single-user tests verify that mutations update the UI immediately without
 * a page refresh (TanStack Query cache invalidation working correctly).
 *
 * Multi-user tests use two browser contexts to verify Supabase Realtime
 * pushes updates across sessions — requires two seeded accounts.
 */
import { test, expect, chromium } from "@playwright/test";
import { loginAsAdmin, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers/auth";

// ── Single-user real-time (cache invalidation) ────────────────────────────────

test.describe("Real-time: single-user cache updates", () => {
  test("new task appears immediately without page refresh", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/tasks");
    await expect(page.getByText(/todo/i).first()).toBeVisible({ timeout: 10000 });

    const title = `Realtime Task ${Date.now()}`;

    const newTaskBtn = page.getByRole("button", { name: /new task/i }).first();
    const addTaskBtn = page.getByRole("button", { name: /add task/i }).first();

    if (await newTaskBtn.isVisible({ timeout: 2000 })) {
      await newTaskBtn.click();
    } else {
      await addTaskBtn.click();
    }

    await page.getByPlaceholder(/what needs to be done/i).fill(title);
    await page.getByRole("button", { name: /create task/i }).click();

    // Must appear without navigation
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/tasks/);
  });

  test("new shopping item appears immediately without page refresh", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/shopping");

    // Create a list
    const listName = `RT List ${Date.now()}`;
    const listInput = page.getByPlaceholder(/list name/i);
    await expect(listInput).toBeVisible({ timeout: 10000 });
    await listInput.fill(listName);
    await page.keyboard.press("Enter");
    await expect(page.getByText(listName)).toBeVisible({ timeout: 8000 });
    await page.getByText(listName).click();

    // Add an item
    const itemInput = page.getByPlaceholder(/add an item/i);
    await expect(itemInput).toBeVisible({ timeout: 8000 });

    const itemName = `RT Item ${Date.now()}`;
    await itemInput.fill(itemName);
    await page.keyboard.press("Enter");

    // Must appear without navigation
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/shopping/);
  });

  test("new bill appears immediately without page refresh", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/finances");
    await expect(page.getByText(/finances/i).first()).toBeVisible({ timeout: 10000 });

    const billName = `RT Bill ${Date.now()}`;
    await page.getByRole("button", { name: /add bill/i }).click();
    await page.getByLabel(/bill name/i).fill(billName);
    await page.getByLabel(/amount/i).fill("25.00");
    await page.getByRole("button", { name: /^add bill$/i }).last().click();

    // Must appear without navigation
    await expect(page.getByText(billName)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/finances/);
  });
});

// ── Multi-user real-time (Supabase Realtime across sessions) ──────────────────

test.describe("Real-time: multi-user (requires 2 seeded accounts)", () => {
  /**
   * To run multi-user tests, ensure the database has two accounts:
   *   demo@orbyt.app / password123       (admin)
   *   demo2@orbyt.app / password123      (member, same household)
   */
  const MEMBER_EMAIL = "demo2@orbyt.app";
  const MEMBER_PASSWORD = "password123";

  test("shopping item added by user A appears for user B in real-time", async () => {
    const browser = await chromium.launch();

    // Session A — admin
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    pageA.goto("http://localhost:3000/login");
    await pageA.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await pageA.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await pageA.getByRole("button", { name: /sign in/i }).click();
    await expect(pageA).toHaveURL(/\/dashboard/, { timeout: 12000 });

    // Session B — member
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    pageB.goto("http://localhost:3000/login");
    await pageB.getByLabel(/email/i).fill(MEMBER_EMAIL);
    await pageB.getByLabel(/password/i).fill(MEMBER_PASSWORD);
    await pageB.getByRole("button", { name: /sign in/i }).click();
    await expect(pageB).toHaveURL(/\/dashboard/, { timeout: 12000 });

    // Both navigate to shopping
    await pageA.goto("http://localhost:3000/shopping");
    await pageB.goto("http://localhost:3000/shopping");

    // A creates a list and adds an item
    const listName = `Shared List ${Date.now()}`;
    const listInputA = pageA.getByPlaceholder(/list name/i);
    await expect(listInputA).toBeVisible({ timeout: 10000 });
    await listInputA.fill(listName);
    await pageA.keyboard.press("Enter");
    await expect(pageA.getByText(listName)).toBeVisible({ timeout: 8000 });
    await pageA.getByText(listName).click();

    const itemName = `Shared Item ${Date.now()}`;
    const itemInputA = pageA.getByPlaceholder(/add an item/i);
    await expect(itemInputA).toBeVisible({ timeout: 8000 });
    await itemInputA.fill(itemName);
    await pageA.keyboard.press("Enter");
    await expect(pageA.getByText(itemName)).toBeVisible({ timeout: 8000 });

    // B selects the same list — item should appear via Realtime (up to 5s)
    await pageB.getByText(listName).click({ timeout: 8000 });
    await expect(pageB.getByText(itemName)).toBeVisible({ timeout: 8000 });

    await browser.close();
  });
});
