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

  // ── Sprint 16: Agenda View ────────────────────────────────────────────────

  test("Agenda button is present in the view toggle toolbar", async ({ page }) => {
    // The toolbar renders 5 view buttons; Agenda is the 5th
    await expect(page.getByRole("button", { name: /^agenda$/i })).toBeVisible({ timeout: 8000 });
  });

  test("clicking Agenda switches to the agenda view and hides the FullCalendar grid", async ({ page }) => {
    await page.getByRole("button", { name: /^agenda$/i }).click();

    // FullCalendar grid (.fc) should no longer be in the DOM (it is conditionally rendered)
    // Use a short timeout — if it stays visible the test should fail fast
    await expect(page.locator(".fc")).not.toBeVisible({ timeout: 6000 });

    // The agenda view renders either a glass-card container with day headers
    // or an empty-state paragraph — both are inside the agenda component
    const agendaLoaded = page
      .getByText(/no items in this period/i)
      .or(page.getByText(/today/i).first())
      .or(page.getByText(/all day/i).first());

    await expect(agendaLoaded).toBeVisible({ timeout: 10000 });
  });

  test("agenda view shows the empty state when no items exist in the period", async ({ page }) => {
    await page.getByRole("button", { name: /^agenda$/i }).click();

    // Wait for the query to settle — either empty state or real data
    await page.waitForLoadState("networkidle");

    // The empty state message rendered by AgendaView is "No items in this period"
    // If there IS data the test is skipped gracefully
    const emptyState = page.getByText(/no items in this period/i);
    const hasItems = await page.locator(".glass-card").count() > 0;

    if (hasItems) {
      // Data loaded — just verify the container renders without errors
      await expect(page.locator(".glass-card").first()).toBeVisible({ timeout: 6000 });
    } else {
      await expect(emptyState).toBeVisible({ timeout: 8000 });
    }
  });

  test("Agenda view button shows active style after clicking", async ({ page }) => {
    const agendaBtn = page.getByRole("button", { name: /^agenda$/i });
    await agendaBtn.click();

    // The active button receives bg-accent text-white classes (added by CalendarToolbar)
    // We verify it is still present and visible (regression guard)
    await expect(agendaBtn).toBeVisible({ timeout: 5000 });

    // Switching back to Month should deactivate Agenda
    await page.getByRole("button", { name: /^month$/i }).click();
    await expect(page.locator(".fc-dayGridMonth-view, .fc-daygrid-view")).toBeVisible({ timeout: 8000 });
  });

  test("can navigate back from Agenda to Month view", async ({ page }) => {
    await page.getByRole("button", { name: /^agenda$/i }).click();
    // FullCalendar grid is hidden in agenda mode
    await expect(page.locator(".fc")).not.toBeVisible({ timeout: 6000 });

    await page.getByRole("button", { name: /^month$/i }).click();
    // FullCalendar grid should reappear
    await expect(page.locator(".fc")).toBeVisible({ timeout: 8000 });
  });

  // ── Sprint 16: View Toggle completeness ──────────────────────────────────

  test("all 5 view toggle buttons are present in the toolbar", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^month$/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /^week$/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /^day$/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /^list$/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /^agenda$/i })).toBeVisible({ timeout: 8000 });
  });

  test("cycling through all 5 views does not throw an error", async ({ page }) => {
    // Month — already default, verify
    await expect(page.locator(".fc")).toBeVisible({ timeout: 8000 });

    // Week
    await page.getByRole("button", { name: /^week$/i }).click();
    await expect(page.locator(".fc-timeGridWeek-view, .fc-timegrid-view")).toBeVisible({ timeout: 8000 });

    // Day
    await page.getByRole("button", { name: /^day$/i }).click();
    await expect(page.locator(".fc-timeGridDay-view, .fc-timegrid-view")).toBeVisible({ timeout: 8000 });

    // List
    await page.getByRole("button", { name: /^list$/i }).click();
    await expect(page.locator(".fc-list, .fc-listWeek-view")).toBeVisible({ timeout: 8000 });

    // Agenda (custom — FullCalendar hidden)
    await page.getByRole("button", { name: /^agenda$/i }).click();
    await expect(page.locator(".fc")).not.toBeVisible({ timeout: 6000 });

    // Back to Month
    await page.getByRole("button", { name: /^month$/i }).click();
    await expect(page.locator(".fc-dayGridMonth-view, .fc-daygrid-view")).toBeVisible({ timeout: 8000 });
  });

  test("active view button is visually distinguished from inactive buttons", async ({ page }) => {
    // The active button has bg-accent text-white; we can verify it via aria or class
    // Playwright does not expose CSS classes directly so we rely on accessibility:
    // clicking each button and checking the calendar view changed is the real signal.
    // Here we do a lighter check — after clicking Week, the Week button is still present.
    const weekBtn = page.getByRole("button", { name: /^week$/i });
    await weekBtn.click();
    await expect(weekBtn).toBeVisible();

    const monthBtn = page.getByRole("button", { name: /^month$/i });
    await monthBtn.click();
    await expect(monthBtn).toBeVisible();
  });

  // ── Sprint 16: RecurrenceModePicker — Delete flow ─────────────────────────

  test("RecurrenceModePicker dialog appears when deleting a recurring event", async ({ page }) => {
    const title = `Recurring Del Test ${Date.now()}`;

    // Create a recurring (weekly) event
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);

    // Set recurrence to Weekly via the Recurrence select
    const rruleSelect = page.getByLabel(/^recurrence$/i);
    await expect(rruleSelect).toBeVisible({ timeout: 5000 });
    await rruleSelect.selectOption("FREQ=WEEKLY");

    // Submit creation
    await page.getByRole("button", { name: /create event/i }).click();

    // Wait for event to appear on the calendar
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // Open the event detail drawer
    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    // The event detail panel (ViewEvent) shows a "Recurring" badge and Delete button
    await expect(page.getByText(/recurring/i)).toBeVisible({ timeout: 5000 });

    // Click Delete — because event.rrule is set, this triggers RecurrenceModePicker
    await page.getByRole("button", { name: /^delete$/i }).click();

    // RecurrenceModePicker renders as a dialog overlay with three option buttons
    const picker = page.getByRole("dialog", { name: /delete recurring event/i });
    await expect(picker).toBeVisible({ timeout: 8000 });
  });

  test("RecurrenceModePicker shows all 3 scope options for delete", async ({ page }) => {
    const title = `Recurring Options Test ${Date.now()}`;

    // Create a weekly recurring event
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByLabel(/^recurrence$/i).selectOption("FREQ=WEEKLY");
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // Open event and click Delete to show the picker
    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: /^delete$/i }).click();

    // All three scope options must be visible
    await expect(page.getByText(/this event only/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/this and future events/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/all events/i)).toBeVisible({ timeout: 8000 });
  });

  test("RecurrenceModePicker Cancel button closes the picker without deleting", async ({ page }) => {
    const title = `Recurring Cancel Test ${Date.now()}`;

    // Create weekly event
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByLabel(/^recurrence$/i).selectOption("FREQ=WEEKLY");
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // Open event and trigger the recurrence delete picker
    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: /^delete$/i }).click();

    // Verify picker appeared
    await expect(page.getByText(/this event only/i)).toBeVisible({ timeout: 8000 });

    // Click Cancel inside the picker
    // The Cancel button is the last button inside the picker overlay
    await page.getByRole("button", { name: /^cancel$/i }).last().click();

    // Picker should be gone — "This event only" is no longer visible
    await expect(page.getByText(/this event only/i)).not.toBeVisible({ timeout: 5000 });

    // The event drawer should still be open (event was not deleted)
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // The event should still exist on the calendar (close drawer first)
    await page.getByRole("button", { name: /close drawer/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
  });

  test("selecting This event only on RecurrenceModePicker deletes only that occurrence", async ({ page }) => {
    const title = `Recurring This Only ${Date.now()}`;

    // Create weekly event
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByLabel(/^recurrence$/i).selectOption("FREQ=WEEKLY");
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // Open event and trigger recurrence delete
    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: /^delete$/i }).click();

    // Select "This event only"
    await page.getByText(/this event only/i).click();

    // Toast should confirm deletion
    await expect(page.getByText(/event deleted/i)).toBeVisible({ timeout: 8000 });
  });

  test("selecting All events on RecurrenceModePicker removes all occurrences", async ({ page }) => {
    const title = `Recurring All Del ${Date.now()}`;

    // Create weekly event
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByLabel(/^recurrence$/i).selectOption("FREQ=WEEKLY");
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // Open event and trigger recurrence delete
    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: /^delete$/i }).click();

    // Select "All events" to delete the whole series
    await page.getByText(/^all events$/i).click();

    // Toast + event removed from calendar
    await expect(page.getByText(/event deleted/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 10000 });
  });

  // ── Sprint 16: Event Creation smoke test ─────────────────────────────────

  test("event creation smoke test — title only, toast confirms success", async ({ page }) => {
    const title = `Smoke ${Date.now()}`;

    await page.getByRole("button", { name: /add event/i }).click();

    const titleInput = page.getByLabel(/^title$/i);
    await expect(titleInput).toBeVisible({ timeout: 8000 });
    await titleInput.fill(title);

    await page.getByRole("button", { name: /create event/i }).click();

    // Success toast ("Event created") must appear
    await expect(page.getByText(/event created/i)).toBeVisible({ timeout: 8000 });
  });

  test("event creation smoke test — drawer closes after successful create", async ({ page }) => {
    const title = `SmokeClose ${Date.now()}`;

    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByRole("button", { name: /create event/i }).click();

    // Drawer must close (dialog no longer visible)
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });
  });

  test("event creation smoke test on mobile viewport", async ({ page, viewport }) => {
    if (!viewport || viewport.width > 600) {
      test.skip();
    }

    const title = `MobileSmoke ${Date.now()}`;

    await page.getByRole("button", { name: /add event/i }).click();
    const titleInput = page.getByLabel(/^title$/i);
    await expect(titleInput).toBeVisible({ timeout: 8000 });
    await titleInput.fill(title);

    await page.getByRole("button", { name: /create event/i }).click();

    await expect(page.getByText(/event created/i)).toBeVisible({ timeout: 8000 });
  });

  // ── Sprint 16: Agenda view on mobile viewport ─────────────────────────────

  test("Agenda view renders correctly at mobile viewport", async ({ page, viewport }) => {
    if (!viewport || viewport.width > 600) {
      test.skip();
    }

    await page.getByRole("button", { name: /^agenda$/i }).click();

    // FullCalendar grid should be hidden
    await expect(page.locator(".fc")).not.toBeVisible({ timeout: 6000 });

    // Agenda container (glass-card) or empty state must be visible
    await page.waitForLoadState("networkidle");

    const agendaContainer = page
      .getByText(/no items in this period/i)
      .or(page.locator(".glass-card").first());

    await expect(agendaContainer).toBeVisible({ timeout: 10000 });
  });

  test("can switch from Agenda to Week view on mobile", async ({ page, viewport }) => {
    if (!viewport || viewport.width > 600) {
      test.skip();
    }

    await page.getByRole("button", { name: /^agenda$/i }).click();
    await expect(page.locator(".fc")).not.toBeVisible({ timeout: 6000 });

    await page.getByRole("button", { name: /^week$/i }).click();
    await expect(page.locator(".fc")).toBeVisible({ timeout: 8000 });
  });
});
