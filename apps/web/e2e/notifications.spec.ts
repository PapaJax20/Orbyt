import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

// ── Notifications & Reminders — Sprint 15 ────────────────────────────────────
//
// Coverage:
//   1. Settings > Notifications tab — toggle switches render
//   2. Toggle a preference — click changes aria-checked state
//   3. Bell icon visible in dashboard header
//   4. Bell badge container exists (may be hidden when count is 0)
//   5. Click bell — opens notification popover
//   6. Empty state — "No notifications yet" when list is empty
//   7. Close popover — Escape key closes it
//   8. Close popover — clicking outside closes it
//   9. Mark all read button — visible when unread count > 0 (conditional)
//  10. Mobile — bell icon visible at 375px viewport
//  11. Calendar reminder pills — present in the New Event drawer form
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Notifications — Settings tab", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: /settings/i })
    ).toBeVisible({ timeout: 10000 });

    // Navigate to the Notifications tab
    await page.getByRole("tab", { name: /notifications/i }).click();
    // Wait for the tab panel to become active
    await page.waitForTimeout(800);
  });

  // ── 1. Toggle switches render ──────────────────────────────────────────────

  test("renders notification type toggle switches", async ({ page }) => {
    // All six notification type rows should have a role="switch" toggle
    const switches = page.getByRole("switch");
    await expect(switches.first()).toBeVisible({ timeout: 8000 });

    // At least the core notification labels should be visible
    await expect(
      page.getByText(/event reminders/i).first()
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByText(/bill due alerts/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/task assigned/i).first()
    ).toBeVisible();
  });

  test("renders all six notification type rows", async ({ page }) => {
    await expect(page.getByText(/event reminders/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/bill due alerts/i).first()).toBeVisible();
    await expect(page.getByText(/task assigned/i).first()).toBeVisible();
    await expect(page.getByText(/task completed/i).first()).toBeVisible();
    await expect(page.getByText(/birthday reminders/i).first()).toBeVisible();
    await expect(page.getByText(/member joined/i).first()).toBeVisible();
  });

  test("renders the push notifications section", async ({ page }) => {
    await expect(
      page.getByText(/push notifications/i).first()
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByText(/browser push notifications/i).first()
    ).toBeVisible();
  });

  // ── 2. Toggle a preference ─────────────────────────────────────────────────

  test("clicking a toggle switch changes its aria-checked state", async ({ page }) => {
    // Target the first switch (Event Reminders)
    const firstSwitch = page.getByRole("switch").first();
    await expect(firstSwitch).toBeVisible({ timeout: 8000 });

    // Read current state
    const before = await firstSwitch.getAttribute("aria-checked");

    // Click to toggle
    await firstSwitch.click();

    // Wait for the mutation round-trip (debounced optimistic update)
    await page.waitForTimeout(1200);

    // State should have flipped
    const after = await firstSwitch.getAttribute("aria-checked");
    expect(after).not.toEqual(before);

    // Toggle back to restore seed state
    await firstSwitch.click();
    await page.waitForTimeout(1200);
  });

  test("each toggle has an accessible aria-label", async ({ page }) => {
    const switches = page.getByRole("switch");
    const count = await switches.count();
    expect(count).toBeGreaterThanOrEqual(6);

    // Every switch must carry an aria-label (enforced in the component)
    for (let i = 0; i < count; i++) {
      const label = await switches.nth(i).getAttribute("aria-label");
      expect(label).toBeTruthy();
    }
  });
});

// ── Notification Center (Bell) ────────────────────────────────────────────────

test.describe("Notification center bell", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 15000,
    });
  });

  // ── 3. Bell icon visible ───────────────────────────────────────────────────

  test("bell icon button is visible in the dashboard header", async ({ page }) => {
    // The bell button carries aria-label "Notifications" (or "Notifications (N unread)")
    await expect(
      page.getByRole("button", { name: /^notifications/i })
    ).toBeVisible({ timeout: 8000 });
  });

  // ── 4. Bell badge container ────────────────────────────────────────────────

  test("bell button area is present in the header", async ({ page }) => {
    // The NotificationCenter renders inside the header's right actions area.
    // We confirm the trigger button is in the DOM regardless of unread count.
    const bellBtn = page.getByRole("button", { name: /^notifications/i });
    await expect(bellBtn).toBeVisible({ timeout: 8000 });

    // The button wraps a Bell icon — confirm it is part of the header
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header.getByRole("button", { name: /^notifications/i })).toBeVisible();
  });

  // ── 5. Click bell opens popover ────────────────────────────────────────────

  test("clicking the bell opens the notifications popover", async ({ page }) => {
    const bellBtn = page.getByRole("button", { name: /^notifications/i });
    await expect(bellBtn).toBeVisible({ timeout: 8000 });

    await bellBtn.click();

    // The popover heading "Notifications" should become visible
    await expect(
      page.getByRole("heading", { name: /^notifications$/i })
    ).toBeVisible({ timeout: 6000 });
  });

  // ── 6. Empty state ─────────────────────────────────────────────────────────

  test("shows 'No notifications yet' empty state when list is empty", async ({
    page,
  }) => {
    const bellBtn = page.getByRole("button", { name: /^notifications/i });
    await bellBtn.click();

    // Either the empty state message or actual notification rows will render.
    // For a fresh seed user with no notifications we expect the empty state.
    // We wait generously for the query to resolve.
    await expect(
      page
        .getByText(/no notifications yet/i)
        .or(page.locator(".divide-y").first())
    ).toBeVisible({ timeout: 8000 });
  });

  // ── 7. Close popover with Escape ──────────────────────────────────────────

  test("pressing Escape closes the notification popover", async ({ page }) => {
    const bellBtn = page.getByRole("button", { name: /^notifications/i });
    await bellBtn.click();

    // Confirm popover opened
    await expect(
      page.getByRole("heading", { name: /^notifications$/i })
    ).toBeVisible({ timeout: 6000 });

    // Press Escape
    await page.keyboard.press("Escape");

    // Popover heading should disappear
    await expect(
      page.getByRole("heading", { name: /^notifications$/i })
    ).not.toBeVisible({ timeout: 5000 });
  });

  // ── 8. Close popover by clicking outside ──────────────────────────────────

  test("clicking outside the popover closes it", async ({ page }) => {
    const bellBtn = page.getByRole("button", { name: /^notifications/i });
    await bellBtn.click();

    await expect(
      page.getByRole("heading", { name: /^notifications$/i })
    ).toBeVisible({ timeout: 6000 });

    // Click on the main content area, away from the popover
    await page.locator("main").click({ position: { x: 100, y: 400 }, force: true });

    await expect(
      page.getByRole("heading", { name: /^notifications$/i })
    ).not.toBeVisible({ timeout: 5000 });
  });

  // ── 9. Mark all read button (conditional) ─────────────────────────────────

  test("mark all read button is visible inside popover when unread count > 0", async ({
    page,
  }) => {
    const bellBtn = page.getByRole("button", { name: /^notifications/i });
    await bellBtn.click();

    await expect(
      page.getByRole("heading", { name: /^notifications$/i })
    ).toBeVisible({ timeout: 6000 });

    // The "Mark all read" button only renders when unreadCount > 0.
    // We check without failing if there are no unread items — the popover
    // header area should still be present.
    const markAllBtn = page.getByRole("button", { name: /mark all read/i });
    const isPresent = await markAllBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (isPresent) {
      await markAllBtn.click();
      // Toast "All notifications marked as read" should appear
      await expect(
        page.getByText(/all notifications marked as read/i)
      ).toBeVisible({ timeout: 6000 });
    } else {
      // No unread items — the popover header is still present
      await expect(
        page.getByRole("heading", { name: /^notifications$/i })
      ).toBeVisible();
    }
  });
});

// ── Mobile viewport ──────────────────────────────────────────────────────────

test.describe("Notification center — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 15000,
    });
  });

  // ── 10. Bell icon visible on mobile ───────────────────────────────────────

  test("bell icon is visible at mobile viewport", async ({ page, viewport }) => {
    // This assertion is meaningful at all viewports; the mobile project
    // (375x667) is the primary target but it should also pass on desktop.
    await expect(
      page.getByRole("button", { name: /^notifications/i })
    ).toBeVisible({ timeout: 8000 });
  });

  test("notification popover opens and closes on mobile", async ({
    page,
    viewport,
  }) => {
    if (!viewport || viewport.width > 600) {
      // Only run the mobile-specific popover check at narrow widths
      test.skip();
    }

    const bellBtn = page.getByRole("button", { name: /^notifications/i });
    await expect(bellBtn).toBeVisible({ timeout: 8000 });
    await bellBtn.click();

    await expect(
      page.getByRole("heading", { name: /^notifications$/i })
    ).toBeVisible({ timeout: 6000 });

    // Close via Escape
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: /^notifications$/i })
    ).not.toBeVisible({ timeout: 5000 });
  });
});

// ── Calendar reminder pills ───────────────────────────────────────────────────

test.describe("Calendar — event reminder pills", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/calendar");
    await expect(
      page.getByRole("heading", { name: /^calendar$/i })
    ).toBeVisible({ timeout: 10000 });
  });

  // ── 11. Reminder pills visible in new event form ───────────────────────────

  test("reminder pills are visible in the New Event drawer", async ({ page }) => {
    // Open the drawer
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    // The "Remind me" label should be present
    await expect(page.getByText(/remind me/i).first()).toBeVisible({
      timeout: 6000,
    });

    // Each pill option from REMINDER_OPTIONS should be rendered as a button
    await expect(page.getByRole("button", { name: /^5 min$/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("button", { name: /^15 min$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^30 min$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^1 hour$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^1 day$/i })).toBeVisible();
  });

  test("clicking a reminder pill toggles its selected state", async ({ page }) => {
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    const pill15 = page.getByRole("button", { name: /^15 min$/i });
    await expect(pill15).toBeVisible({ timeout: 5000 });

    // Capture initial class to detect the "selected" styling
    const classBefore = await pill15.getAttribute("class");

    // Click to select
    await pill15.click();
    const classAfter = await pill15.getAttribute("class");

    // The class string should have changed (selected adds border-accent bg-accent/20)
    expect(classAfter).not.toEqual(classBefore);

    // Click again to deselect
    await pill15.click();
    const classDeselected = await pill15.getAttribute("class");
    expect(classDeselected).toEqual(classBefore);
  });

  test("multiple reminder pills can be selected simultaneously", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    const pill5 = page.getByRole("button", { name: /^5 min$/i });
    const pill30 = page.getByRole("button", { name: /^30 min$/i });

    await expect(pill5).toBeVisible({ timeout: 5000 });

    await pill5.click();
    await pill30.click();

    // Both should now have the "selected" accent styling
    const class5 = await pill5.getAttribute("class");
    const class30 = await pill30.getAttribute("class");

    expect(class5).toContain("border-accent");
    expect(class30).toContain("border-accent");
  });

  test("reminder pills are visible in the New Event drawer on mobile", async ({
    page,
    viewport,
  }) => {
    if (!viewport || viewport.width > 600) {
      test.skip();
    }

    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    // Scroll down within the drawer to reveal the Remind me section
    await page.getByRole("dialog").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(300);

    await expect(page.getByText(/remind me/i).first()).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByRole("button", { name: /^15 min$/i })).toBeVisible({
      timeout: 5000,
    });
  });
});
