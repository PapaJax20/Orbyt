import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Calendar", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/calendar");
    // Wait for the <h1>Calendar</h1> heading inside the page content.
    // Avoids matching the hidden sidebar nav label at mobile viewport.
    await expect(page.getByRole("heading", { name: /^calendar$/i })).toBeVisible({ timeout: 10000 });
  });

  // ── Page load ───────────────────────────────────────────────────────────────

  test("renders the calendar page with a calendar grid", async ({ page }) => {
    // The FullCalendar grid is wrapped in a glass-card container
    await expect(page.locator(".fc")).toBeVisible({ timeout: 10000 });
    // Toolbar navigation buttons are present
    await expect(page.getByRole("button", { name: /previous period/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /next period/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /today/i })).toBeVisible();
  });

  test("renders the Add Event button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /add event/i })).toBeVisible();
  });

  // ── View toggles ─────────────────────────────────────────────────────────────

  test("can switch to Week view", async ({ page }) => {
    await page.getByRole("button", { name: /^week$/i }).click();
    // FullCalendar renders time grid columns for week view
    await expect(page.locator(".fc-timeGridWeek-view, .fc-timegrid-view")).toBeVisible({ timeout: 8000 });
  });

  test("can switch to Day view", async ({ page }) => {
    await page.getByRole("button", { name: /^day$/i }).click();
    await expect(page.locator(".fc-timeGridDay-view, .fc-timegrid-view")).toBeVisible({ timeout: 8000 });
  });

  test("can switch to List view", async ({ page }) => {
    await page.getByRole("button", { name: /^list$/i }).click();
    // FullCalendar list view renders a .fc-list element
    await expect(page.locator(".fc-list, .fc-listWeek-view")).toBeVisible({ timeout: 8000 });
  });

  test("can switch back to Month view", async ({ page }) => {
    // Switch away then back
    await page.getByRole("button", { name: /^week$/i }).click();
    await page.getByRole("button", { name: /^month$/i }).click();
    await expect(page.locator(".fc-dayGridMonth-view, .fc-daygrid-view")).toBeVisible({ timeout: 8000 });
  });

  test("Today button navigates back to today", async ({ page }) => {
    // Go forward one period
    await page.getByRole("button", { name: /next period/i }).click();
    // Then press Today
    await page.getByRole("button", { name: /today/i }).click();
    // Calendar should still render without error
    await expect(page.locator(".fc")).toBeVisible({ timeout: 8000 });
  });

  // ── Previous / Next navigation ────────────────────────────────────────────

  test("can navigate to the next period", async ({ page }) => {
    await page.getByRole("button", { name: /next period/i }).click();
    await expect(page.locator(".fc")).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to the previous period", async ({ page }) => {
    await page.getByRole("button", { name: /previous period/i }).click();
    await expect(page.locator(".fc")).toBeVisible({ timeout: 5000 });
  });

  // ── Create event ─────────────────────────────────────────────────────────────

  test("can open the New Event drawer via the Add Event button", async ({ page }) => {
    await page.getByRole("button", { name: /add event/i }).click();

    // Drawer title should say "New Event"
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/new event/i)).toBeVisible({ timeout: 5000 });

    // Title input should be present
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 5000 });
  });

  test("can create an event and see it on the calendar", async ({ page }) => {
    const title = `E2E Event ${Date.now()}`;

    await page.getByRole("button", { name: /add event/i }).click();

    const titleInput = page.getByLabel(/^title$/i);
    await expect(titleInput).toBeVisible({ timeout: 8000 });
    await titleInput.fill(title);

    // Select a category from the dropdown
    const categorySelect = page.getByLabel(/^category$/i);
    await expect(categorySelect).toBeVisible({ timeout: 5000 });
    await categorySelect.selectOption("family");

    // Submit the form
    await page.getByRole("button", { name: /create event/i }).click();

    // Drawer should close and event should appear on the calendar.
    // FullCalendar renders event titles as anchor-like text inside .fc-event.
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });
  });

  test("create event drawer stays open when clicking inside form fields", async ({ page }) => {
    await page.getByRole("button", { name: /add event/i }).click();

    const titleInput = page.getByLabel(/^title$/i);
    await expect(titleInput).toBeVisible({ timeout: 8000 });

    // Click multiple fields — drawer must not close
    await titleInput.click();
    await titleInput.fill("Clicking inside");
    await expect(titleInput).toBeVisible();

    await page.getByLabel(/^category$/i).click();
    await expect(titleInput).toBeVisible();

    await page.getByLabel(/^location/i).click();
    await expect(titleInput).toBeVisible();
  });

  // ── View event ───────────────────────────────────────────────────────────────

  test("clicking an event on the calendar opens the event detail drawer", async ({ page }) => {
    // Create an event first so we have something to click
    const title = `View Test ${Date.now()}`;

    await page.getByRole("button", { name: /add event/i }).click();
    const titleInput = page.getByLabel(/^title$/i);
    await expect(titleInput).toBeVisible({ timeout: 8000 });
    await titleInput.fill(title);
    await page.getByRole("button", { name: /create event/i }).click();

    // Wait for the event to appear on the calendar
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // Click the event title on the calendar grid
    await page.getByText(title).first().click();

    // Drawer should open showing the event title as its heading or visible text
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /edit event/i })).toBeVisible({ timeout: 8000 });
  });

  // ── Edit event ───────────────────────────────────────────────────────────────

  test("can edit an event title", async ({ page }) => {
    const originalTitle = `Edit Test ${Date.now()}`;
    const updatedTitle = `Updated ${Date.now()}`;

    // Create the event
    await page.getByRole("button", { name: /add event/i }).click();
    const titleInput = page.getByLabel(/^title$/i);
    await expect(titleInput).toBeVisible({ timeout: 8000 });
    await titleInput.fill(originalTitle);
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 10000 });

    // Open the event detail drawer
    await page.getByText(originalTitle).first().click();
    await expect(page.getByRole("button", { name: /edit event/i })).toBeVisible({ timeout: 8000 });

    // Click "Edit Event" to switch to the edit form
    await page.getByRole("button", { name: /edit event/i }).click();

    // The drawer title should now read "Edit Event"
    await expect(page.getByText(/edit event/i)).toBeVisible({ timeout: 5000 });

    // Clear and fill the new title
    const editTitleInput = page.getByLabel(/^title$/i);
    await expect(editTitleInput).toBeVisible({ timeout: 5000 });
    await editTitleInput.clear();
    await editTitleInput.fill(updatedTitle);

    // Save changes
    await page.getByRole("button", { name: /save changes/i }).click();

    // Updated title should now appear on the calendar
    await expect(page.getByText(updatedTitle)).toBeVisible({ timeout: 10000 });
  });

  // ── Delete event ─────────────────────────────────────────────────────────────

  test("can delete an event", async ({ page }) => {
    const title = `Delete Me ${Date.now()}`;

    // Create the event
    await page.getByRole("button", { name: /add event/i }).click();
    const titleInput = page.getByLabel(/^title$/i);
    await expect(titleInput).toBeVisible({ timeout: 8000 });
    await titleInput.fill(title);
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // Open the event detail drawer
    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    // Click the Delete button in the view panel
    await expect(page.getByRole("button", { name: /^delete$/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /^delete$/i }).click();

    // ConfirmDialog should appear — confirm deletion
    await expect(page.getByText(/delete this event/i)).toBeVisible({ timeout: 5000 });
    // The confirm button inside the alertdialog has aria-label="Delete"
    await page.getByRole("button", { name: /^delete$/i }).last().click();

    // Event should no longer be visible on the calendar
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 10000 });
  });

  // ── Search ───────────────────────────────────────────────────────────────────

  test("search input is visible in the toolbar", async ({ page }) => {
    await expect(page.getByPlaceholder(/search events/i)).toBeVisible({ timeout: 8000 });
  });

  test("typing in search shows a results overlay or empty state", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search events/i);
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    // Type a query that is very unlikely to match any real event
    await searchInput.fill("zzzz-no-match-xyz-99999");
    // Wait for debounce (300 ms) + network round-trip
    await page.waitForTimeout(700);

    // Either "No events found" empty state or the results panel appears
    await expect(
      page.getByText(/no events found/i)
        .or(page.getByText(/search results/i))
    ).toBeVisible({ timeout: 8000 });
  });

  test("search finds an existing event by title", async ({ page }) => {
    const title = `Searchable ${Date.now()}`;

    // Create an event
    await page.getByRole("button", { name: /add event/i }).click();
    const titleInput = page.getByLabel(/^title$/i);
    await expect(titleInput).toBeVisible({ timeout: 8000 });
    await titleInput.fill(title);
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // Search for the event
    const searchInput = page.getByPlaceholder(/search events/i);
    await searchInput.fill(title.slice(0, 12));
    await page.waitForTimeout(700);

    // The event title should appear in the results overlay
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
  });

  test("clearing search hides the search results overlay", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search events/i);
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    await searchInput.fill("test query");
    await page.waitForTimeout(700);

    // Clear the search
    await searchInput.clear();
    await page.waitForTimeout(400);

    // Results panel should be gone
    await expect(page.getByText(/search results/i)).not.toBeVisible({ timeout: 5000 });
  });

  // ── Responsive — mobile viewport ─────────────────────────────────────────────

  test("calendar renders correctly at mobile viewport", async ({ page, viewport }) => {
    // Only assert the mobile-specific layout when running in the mobile project
    if (!viewport || viewport.width > 600) {
      test.skip();
    }

    // Calendar grid should still be visible
    await expect(page.locator(".fc")).toBeVisible({ timeout: 10000 });
    // Add Event button should be visible (the header always renders it)
    await expect(page.getByRole("button", { name: /add event/i })).toBeVisible();
  });

  test("can open the New Event drawer on mobile", async ({ page, viewport }) => {
    if (!viewport || viewport.width > 600) {
      test.skip();
    }

    await page.getByRole("button", { name: /add event/i }).click();

    // On mobile the Drawer renders as a bottom sheet — the dialog role is still present
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 5000 });
  });

  // ── Drawer close ─────────────────────────────────────────────────────────────

  test("can close the event drawer via the close button", async ({ page }) => {
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    // Close button in the DrawerHeader has aria-label="Close drawer"
    await page.getByRole("button", { name: /close drawer/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
  });
});
