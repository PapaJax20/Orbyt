import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/tasks");
    // Wait for board to render.
    // Use getByRole("heading") to target the visible <h1>Tasks</h1> in the page
    // content. getByText(/tasks/i).first() would match the sidebar nav label
    // first, which is hidden on mobile (hidden md:block) and causes
    // toBeVisible() to fail at 375px viewport.
    await expect(page.getByRole("heading", { name: /tasks/i })).toBeVisible({ timeout: 10000 });
  });

  // ── Board ────────────────────────────────────────────────────────────────────

  test("renders kanban columns", async ({ page }) => {
    await expect(page.getByText(/to do/i).first()).toBeVisible();
    await expect(page.getByText(/in progress/i).first()).toBeVisible();
    await expect(page.getByText(/done/i).first()).toBeVisible();
  });

  test("can switch between kanban and list view", async ({ page }) => {
    // Look for view toggle buttons (Board / List)
    const listViewBtn = page.getByRole("button", { name: /list view/i });
    if (await listViewBtn.isVisible({ timeout: 3000 })) {
      await listViewBtn.click();
      // Table/list rows should be visible
      await expect(page.locator("main")).toBeVisible();

      // Switch back to board
      const boardBtn = page.getByRole("button", { name: /board/i });
      if (await boardBtn.isVisible()) {
        await boardBtn.click();
        await expect(page.getByText(/to do/i).first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ── Create task ──────────────────────────────────────────────────────────────

  test("can create a task and it appears on the board", async ({ page }) => {
    const title = `E2E Task ${Date.now()}`;

    // Open create drawer via header "New Task" button or column "Add task" button
    const newTaskBtn = page.getByRole("button", { name: /new task/i }).first();
    const addTaskBtn = page.getByRole("button", { name: /add task/i }).first();

    if (await newTaskBtn.isVisible({ timeout: 2000 })) {
      await newTaskBtn.click();
    } else {
      await addTaskBtn.click();
    }

    // Fill title
    await page.getByPlaceholder(/what needs to be done/i).fill(title);

    // Submit
    await page.getByRole("button", { name: /create task/i }).click();

    // Task card should appear on the board
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
  });

  // ── Task detail ──────────────────────────────────────────────────────────────

  test("clicking a task card opens the detail drawer", async ({ page }) => {
    // If there are existing tasks, click one
    const taskCard = page.locator(".glass-card").first();
    if (await taskCard.isVisible({ timeout: 3000 })) {
      await taskCard.click();
      // Drawer title or description field should appear
      await expect(page.getByText(/task details|edit task/i)).toBeVisible({ timeout: 5000 });
    }
  });

  // ── Drawer stays open ────────────────────────────────────────────────────────

  test("task drawer stays open when clicking inside it", async ({ page }) => {
    const newTaskBtn = page.getByRole("button", { name: /new task/i }).first();
    const addTaskBtn = page.getByRole("button", { name: /add task/i }).first();

    if (await newTaskBtn.isVisible({ timeout: 2000 })) {
      await newTaskBtn.click();
    } else {
      await addTaskBtn.click();
    }

    const titleInput = page.getByPlaceholder(/what needs to be done/i);
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Click inside the drawer
    await titleInput.click();
    await titleInput.fill("Clicking inside should not close");

    // Drawer should still be open
    await expect(titleInput).toBeVisible();
  });
});
