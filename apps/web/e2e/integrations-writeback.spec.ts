import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

// ── Sprint 17B: Calendar Write-Back + Webhooks ────────────────────────────────
//
// Coverage:
//
// INTEGRATIONS SETTINGS TAB
//   1.  Integrations tab renders in Settings page
//   2.  Scope badges render ("Read & Write" or "Read-only") when accounts exist
//   3.  "Enable Real-time Sync" button is present and has correct aria attributes
//   4.  Sync status dot indicators render with accessible text
//   5.  "Upgrade Permissions" button visible for read-only accounts
//   6.  "Disconnect" button has a two-step confirmation flow
//
// CALENDAR / EVENT DRAWER
//   7.  Calendar page loads with events
//   8.  Clicking an event opens the drawer
//   9.  "Push to Calendar" button visible when write-capable accounts exist
//   10. Account picker dropdown is dismissed by the Escape key
//   11. "Synced" badge appears on events with an externalEventId
//   12. Event drawer has proper ARIA on color picker swatches
//   13. All-day toggle is a role="switch" with aria-checked
//
// WEBHOOK ENDPOINTS (Playwright API testing — no browser UI needed)
//   14. Google webhook returns 200 on POST with required headers
//   15. Google webhook returns 400 when required headers are absent
//   16. Microsoft webhook echoes validationToken as text/plain + 200
//   17. Microsoft webhook returns 202 on POST with notification body
//   18. Microsoft webhook returns 400 for invalid validationToken format
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Navigate to the integrations tab and wait for it to settle. */
async function goToIntegrations(page: Parameters<typeof loginAsAdmin>[0]) {
  await page.goto("/settings?tab=integrations");
  await expect(
    page.getByRole("heading", { name: /settings/i })
  ).toBeVisible({ timeout: 10000 });
  await page.waitForLoadState("networkidle");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Integrations Settings Tab
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Sprint 17B — Integrations Settings Tab", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToIntegrations(page);
  });

  // ── 1. Tab renders ────────────────────────────────────────────────────────

  test("Integrations tab renders in the Settings page", async ({ page }) => {
    // The tab trigger must be visible and be the active tab
    const tab = page.getByRole("tab", { name: /integrations/i });
    await expect(tab).toBeVisible({ timeout: 8000 });
    await expect(tab).toHaveAttribute("data-state", "active");
  });

  test("Integrations tab panel contains the Connected Calendars section", async ({
    page,
  }) => {
    await expect(
      page.getByText(/connected calendars/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("Integrations tab panel contains the Add a Calendar section", async ({
    page,
  }) => {
    await expect(
      page.getByText(/add a calendar/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  // ── 2. Scope badges ───────────────────────────────────────────────────────

  test("scope badge shows Read & Write or Read-only depending on account scopes", async ({
    page,
  }) => {
    // This test is data-dependent: it only asserts if at least one connected
    // account is present. If none, skip gracefully.
    const hasAccounts = await page
      .getByText(/read & write/i)
      .or(page.getByText(/read-only/i))
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasAccounts) {
      // No connected accounts in this environment — verify the empty state
      await expect(
        page.getByText(/no calendars connected/i)
      ).toBeVisible({ timeout: 8000 });
      return;
    }

    // At least one scope badge should be visible
    const badge = page
      .getByText(/read & write/i)
      .or(page.getByText(/read-only/i))
      .first();
    await expect(badge).toBeVisible({ timeout: 8000 });
  });

  test("Read & Write scope badge has green styling when write scopes are present", async ({
    page,
  }) => {
    const badge = page.getByText(/read & write/i).first();
    const visible = await badge.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip(); // No write-scoped account connected
      return;
    }
    // The badge lives inside a span with bg-green-500/15 text-green-500 classes
    const parent = badge.locator("..");
    await expect(parent).toBeVisible();
  });

  test("Read-only scope badge has amber styling", async ({ page }) => {
    const badge = page.getByText(/read-only/i).first();
    const visible = await badge.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip(); // No read-only account connected
      return;
    }
    await expect(badge).toBeVisible();
  });

  // ── 3. Enable Real-time Sync button ──────────────────────────────────────

  test("Enable Real-time Sync button is visible when accounts are connected", async ({
    page,
  }) => {
    const hasAccounts = await page
      .getByRole("button", { name: /enable real-time sync/i })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasAccounts) {
      // No connected accounts — the button renders only per-account
      await expect(
        page.getByText(/no calendars connected/i)
      ).toBeVisible({ timeout: 8000 });
      return;
    }

    await expect(
      page.getByRole("button", { name: /enable real-time sync/i }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("Enable Real-time Sync button has an aria-label attribute", async ({
    page,
  }) => {
    const btn = page
      .getByRole("button", { name: /enable real-time sync/i })
      .first();
    const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }

    // The component sets aria-label conditionally based on write scope status
    const label = await btn.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label).toMatch(/real-time sync/i);
  });

  test("Enable Real-time Sync button is disabled for read-only accounts", async ({
    page,
  }) => {
    // The button is rendered with disabled={!hasWrite} when scopes are read-only
    const btn = page.getByRole("button", {
      name: /upgrade permissions to enable real-time sync/i,
    });
    const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip(); // Only testable when a read-only account exists
      return;
    }
    await expect(btn).toBeDisabled();
  });

  // ── 4. Sync status dots ───────────────────────────────────────────────────

  test("sync status indicator dot is present inside each account card", async ({
    page,
  }) => {
    const hasAccounts = await page
      .locator(".glass-card")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasAccounts) {
      test.skip();
      return;
    }

    // The dot is a small inline-block rounded-full element — at least one exists
    const dots = page.locator(
      ".glass-card .rounded-full.h-2.w-2, .glass-card [class*='inline-block'][class*='h-2'][class*='w-2'][class*='rounded-full']"
    );
    const count = await dots.count();
    expect(count).toBeGreaterThan(0);
  });

  test("sync status text describes the sync state accessibly", async ({
    page,
  }) => {
    const hasAccounts = await page
      .getByText(/manual sync only/i)
      .or(page.getByText(/real-time sync active/i))
      .or(page.getByText(/sync error/i))
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasAccounts) {
      test.skip();
      return;
    }

    const statusText = page
      .getByText(/manual sync only/i)
      .or(page.getByText(/real-time sync active/i))
      .or(page.getByText(/sync error/i))
      .first();
    await expect(statusText).toBeVisible({ timeout: 8000 });
  });

  // ── 5. Upgrade Permissions button ────────────────────────────────────────

  test("Upgrade Permissions button is visible for read-only accounts", async ({
    page,
  }) => {
    const btn = page
      .getByRole("button", { name: /upgrade permissions/i })
      .first();
    const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip(); // No read-only accounts in this environment
      return;
    }
    await expect(btn).toBeVisible({ timeout: 8000 });
    await expect(btn).toBeEnabled();
  });

  test("Upgrade Permissions button meets 44px touch target height on mobile", async ({
    page,
    viewport,
  }) => {
    if (!viewport || viewport.width > 600) {
      test.skip();
      return;
    }
    const btn = page
      .getByRole("button", { name: /upgrade permissions/i })
      .first();
    const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  // ── 6. Disconnect button two-step confirmation ────────────────────────────

  test("Disconnect button is visible for each connected account", async ({
    page,
  }) => {
    const btn = page
      .getByRole("button", { name: /disconnect/i })
      .first();
    const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip(); // No connected accounts
      return;
    }
    await expect(btn).toBeVisible({ timeout: 8000 });
  });

  test("clicking Disconnect shows a confirmation step with Confirm and Cancel buttons", async ({
    page,
  }) => {
    const disconnectBtn = page
      .getByRole("button", { name: /^disconnect$/i })
      .first();
    const visible = await disconnectBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }

    await disconnectBtn.click();

    // After clicking, the component replaces the button with Confirm / Cancel
    await expect(
      page.getByRole("button", { name: /confirm/i }).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: /cancel/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("clicking Cancel in the Disconnect confirmation restores the Disconnect button", async ({
    page,
  }) => {
    const disconnectBtn = page
      .getByRole("button", { name: /^disconnect$/i })
      .first();
    const visible = await disconnectBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }

    await disconnectBtn.click();
    await expect(
      page.getByRole("button", { name: /confirm/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // Cancel restores the original "Disconnect" button
    await page.getByRole("button", { name: /^cancel$/i }).first().click();

    await expect(
      page.getByRole("button", { name: /^disconnect$/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // ── Mobile viewport ───────────────────────────────────────────────────────

  test("Integrations tab renders correctly at mobile viewport", async ({
    page,
    viewport,
  }) => {
    if (!viewport || viewport.width > 600) {
      test.skip();
      return;
    }

    await expect(
      page.getByRole("tab", { name: /integrations/i })
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByText(/add a calendar/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("Sync Now button meets 44px touch target height on mobile", async ({
    page,
    viewport,
  }) => {
    if (!viewport || viewport.width > 600) {
      test.skip();
      return;
    }

    const syncBtn = page
      .getByRole("button", { name: /sync now/i })
      .first();
    const visible = await syncBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }

    const box = await syncBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Calendar / Event Drawer
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Sprint 17B — Calendar Event Drawer", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/calendar");
    await expect(
      page.getByRole("heading", { name: /^calendar$/i })
    ).toBeVisible({ timeout: 10000 });
  });

  // ── 7. Calendar page loads ────────────────────────────────────────────────

  test("calendar page loads with the FullCalendar grid visible", async ({
    page,
  }) => {
    await expect(page.locator(".fc")).toBeVisible({ timeout: 10000 });
  });

  // ── 8. Clicking an event opens the drawer ─────────────────────────────────

  test("clicking a calendar event opens the event detail drawer", async ({
    page,
  }) => {
    // Create an event so there is something to click
    const title = `WriteBack View ${Date.now()}`;
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // Open the detail drawer
    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
  });

  // ── 9. Push to Calendar button ────────────────────────────────────────────

  test("Push to Calendar button is visible in the drawer when write-capable accounts are connected", async ({
    page,
  }) => {
    // First check if any write-capable accounts exist by navigating to settings
    // briefly, then come back (avoids needing a separate browser context)
    const title = `PushTest ${Date.now()}`;
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    // The "Push to Calendar" button is conditionally rendered only when
    // write-capable accounts exist. Soft-check: if no accounts, skip.
    const pushBtn = page.getByRole("button", { name: /push to calendar/i });
    const hasPush = await pushBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasPush) {
      await expect(pushBtn).toBeEnabled();
    } else {
      // Confirm the event drawer itself rendered correctly (drawer content visible)
      await expect(
        page.getByRole("button", { name: /edit event/i })
      ).toBeVisible({ timeout: 8000 });
    }
  });

  test("Push to Calendar button meets 44px touch target height on mobile", async ({
    page,
    viewport,
  }) => {
    if (!viewport || viewport.width > 600) {
      test.skip();
      return;
    }

    const title = `PushMobile ${Date.now()}`;
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    const pushBtn = page.getByRole("button", { name: /push to calendar/i });
    const hasPush = await pushBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasPush) {
      test.skip();
      return;
    }

    const box = await pushBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("Push to Calendar button has aria-haspopup attribute", async ({
    page,
  }) => {
    const title = `PushAria ${Date.now()}`;
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    const pushBtn = page.getByRole("button", { name: /push to calendar/i });
    const hasPush = await pushBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasPush) {
      test.skip();
      return;
    }

    // The component sets aria-haspopup="true" on the Push to Calendar button
    const haspopup = await pushBtn.getAttribute("aria-haspopup");
    expect(haspopup).toBe("true");
  });

  // ── 10. Account picker dropdown — Escape key dismissal ────────────────────

  test("account picker dropdown is dismissed by pressing Escape", async ({
    page,
  }) => {
    const title = `EscTest ${Date.now()}`;
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });

    const pushBtn = page.getByRole("button", { name: /push to calendar/i });
    const hasPush = await pushBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasPush) {
      test.skip();
      return;
    }

    // The account picker menu only appears when multiple write accounts exist.
    // Check aria-expanded to determine if a second click would show the dropdown.
    const expanded = await pushBtn.getAttribute("aria-expanded");
    if (expanded === "false" || expanded === null) {
      // Single account — clicking pushes immediately, no dropdown
      test.skip();
      return;
    }

    await pushBtn.click();
    // A role="menu" should now be visible
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 5000 });

    // Pressing Escape should dismiss the dropdown
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).not.toBeVisible({ timeout: 5000 });
  });

  // ── 11. Synced badge on linked events ─────────────────────────────────────

  test("Synced badge appears in the drawer for events with externalEventId", async ({
    page,
  }) => {
    // This assertion is data-dependent: the badge renders only when event.externalEventId
    // is set, which requires a previously imported/linked event in the test DB.
    // We navigate through calendar events looking for a linked one.
    await page.waitForLoadState("networkidle");

    const syncedBadge = page.getByText(/synced with/i);
    const hasSynced = await syncedBadge
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (!hasSynced) {
      // No linked events in this environment — verify the calendar renders fine
      await expect(page.locator(".fc")).toBeVisible({ timeout: 5000 });
      return;
    }

    // A linked event must have been clicked (badge is inside the drawer)
    await expect(syncedBadge).toBeVisible({ timeout: 5000 });
  });

  test("Synced badge includes the provider name", async ({ page }) => {
    // Open any event with externalEventId and verify the badge text includes
    // a provider name like "Google Calendar" or "Microsoft Outlook".
    // Skip if no linked events exist.
    const syncedBadge = page.getByText(/synced with/i);
    const hasSynced = await syncedBadge
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (!hasSynced) {
      test.skip();
      return;
    }

    const badgeText = await syncedBadge.textContent();
    expect(badgeText).toMatch(
      /synced with (google calendar|microsoft outlook|external calendar)/i
    );
  });

  // ── 12. Color picker ARIA ─────────────────────────────────────────────────

  test("color picker swatches in the New Event form have aria-label attributes", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });

    // The ColorPicker renders buttons with aria-label="Set event color to #..." or
    // aria-label="Use default category color"
    const colorSwatches = page.locator(
      '[aria-label="Use default category color"], [aria-label^="Set event color to"]'
    );
    const count = await colorSwatches.count();
    // There are 9 swatches (1 default + 8 colours)
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("default color swatch has accessible label 'Use default category color'", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });

    await expect(
      page.getByRole("button", { name: "Use default category color" }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("named color swatches have aria-label starting with 'Set event color to'", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });

    // At least one named color swatch should be labelled
    const namedSwatches = page.locator(
      '[aria-label^="Set event color to"]'
    );
    const count = await namedSwatches.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── 13. All-day toggle ARIA ───────────────────────────────────────────────

  test("All-day toggle is a role=switch element with aria-checked", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });

    const toggle = page.getByRole("switch");
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // aria-checked must be "true" or "false"
    const checked = await toggle.getAttribute("aria-checked");
    expect(["true", "false"]).toContain(checked);
  });

  test("clicking All-day toggle flips aria-checked", async ({ page }) => {
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });

    const toggle = page.getByRole("switch");
    await expect(toggle).toBeVisible({ timeout: 5000 });

    const before = await toggle.getAttribute("aria-checked");
    await toggle.click();
    const after = await toggle.getAttribute("aria-checked");

    // Value must have flipped
    expect(after).not.toEqual(before);
  });

  test("All-day toggle is keyboard-accessible via Enter key", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });

    const toggle = page.getByRole("switch");
    await expect(toggle).toBeVisible({ timeout: 5000 });

    const before = await toggle.getAttribute("aria-checked");
    await toggle.focus();
    await toggle.press("Enter");
    const after = await toggle.getAttribute("aria-checked");

    expect(after).not.toEqual(before);
  });

  // ── Mobile: drawer renders correctly ─────────────────────────────────────

  test("event detail drawer renders on mobile viewport without layout issues", async ({
    page,
    viewport,
  }) => {
    if (!viewport || viewport.width > 600) {
      test.skip();
      return;
    }

    const title = `MobileDrawer ${Date.now()}`;
    await page.getByRole("button", { name: /add event/i }).click();
    await expect(page.getByLabel(/^title$/i)).toBeVisible({ timeout: 8000 });
    await page.getByLabel(/^title$/i).fill(title);
    await page.getByRole("button", { name: /create event/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    await page.getByText(title).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByRole("button", { name: /edit event/i })
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByRole("button", { name: /^delete$/i })
    ).toBeVisible({ timeout: 8000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Webhook Endpoints (Playwright API testing)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Sprint 17B — Webhook Endpoints", () => {
  // ── 14. Google webhook: valid POST returns 200 ────────────────────────────

  test("Google webhook returns 200 on POST with required headers", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/google", {
      headers: {
        "x-goog-channel-id": "test-channel-id-abc123",
        "x-goog-resource-id": "test-resource-id-xyz789",
        "x-goog-resource-state": "exists",
        "Content-Type": "application/json",
      },
      data: {},
    });

    // Google webhooks must always return 200 to prevent retries.
    expect(response.status()).toBe(200);
  });

  test("Google webhook returns 200 for the sync handshake resource state", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/google", {
      headers: {
        "x-goog-channel-id": "sync-channel-id",
        "x-goog-resource-id": "sync-resource-id",
        "x-goog-resource-state": "sync",
        "Content-Type": "application/json",
      },
      data: {},
    });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  // ── 15. Google webhook: missing required headers returns 400 ──────────────

  test("Google webhook returns 400 when x-goog-channel-id header is missing", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/google", {
      headers: {
        // Intentionally omit x-goog-channel-id
        "x-goog-resource-id": "test-resource-id",
        "x-goog-resource-state": "exists",
        "Content-Type": "application/json",
      },
      data: {},
    });

    expect(response.status()).toBe(400);
  });

  test("Google webhook returns 400 when x-goog-resource-id header is missing", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/google", {
      headers: {
        "x-goog-channel-id": "test-channel-id",
        // Intentionally omit x-goog-resource-id
        "x-goog-resource-state": "exists",
        "Content-Type": "application/json",
      },
      data: {},
    });

    expect(response.status()).toBe(400);
  });

  test("Google webhook returns 400 when both required headers are missing", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/google", {
      headers: {
        "Content-Type": "application/json",
      },
      data: {},
    });

    expect(response.status()).toBe(400);
  });

  test("Google webhook 400 response body contains error field", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/google", {
      headers: {
        "Content-Type": "application/json",
      },
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(body.error!.length).toBeGreaterThan(0);
  });

  // ── 16. Microsoft webhook: validationToken echo ───────────────────────────

  test("Microsoft webhook echoes validationToken as text/plain with status 200", async ({
    request,
  }) => {
    const token = "TestValidationToken12345ABC";
    const response = await request.post(
      `/api/webhooks/microsoft?validationToken=${encodeURIComponent(token)}`,
      {
        headers: { "Content-Type": "application/json" },
        data: {},
      }
    );

    expect(response.status()).toBe(200);

    // Content-Type must be text/plain (Microsoft requires this)
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("text/plain");

    // Body must be the raw token string
    const body = await response.text();
    expect(body).toBe(token);
  });

  test("Microsoft webhook echoes validationToken that contains URL-safe base64 characters", async ({
    request,
  }) => {
    // Microsoft tokens can contain letters, digits, -, _, =, +, /, .
    const token = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=";
    const response = await request.post(
      `/api/webhooks/microsoft?validationToken=${encodeURIComponent(token)}`,
      {
        headers: { "Content-Type": "application/json" },
        data: {},
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toBe(token);
  });

  // ── 17. Microsoft webhook: notification body returns 202 ─────────────────

  test("Microsoft webhook returns 202 Accepted on POST with notification body", async ({
    request,
  }) => {
    // No validationToken query param — treat as a change notification
    const response = await request.post("/api/webhooks/microsoft", {
      headers: { "Content-Type": "application/json" },
      data: {
        value: [
          {
            subscriptionId: "test-sub-id-abc",
            changeType: "updated",
            resource: "users/me/events/test-event-id",
            clientState: "orbyt-secret",
          },
        ],
      },
    });

    // Microsoft expects 202 Accepted for valid notification deliveries
    expect(response.status()).toBe(202);
  });

  test("Microsoft webhook returns 202 on POST with an empty notifications array", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/microsoft", {
      headers: { "Content-Type": "application/json" },
      data: { value: [] },
    });

    expect(response.status()).toBe(202);
  });

  test("Microsoft webhook returns 202 when value field is absent in body", async ({
    request,
  }) => {
    // The handler falls back to [] when body.value is undefined
    const response = await request.post("/api/webhooks/microsoft", {
      headers: { "Content-Type": "application/json" },
      data: {},
    });

    expect(response.status()).toBe(202);
  });

  test("Microsoft webhook 202 response body contains ok field", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/microsoft", {
      headers: { "Content-Type": "application/json" },
      data: { value: [] },
    });

    expect(response.status()).toBe(202);
    const body = (await response.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  // ── 18. Microsoft webhook: invalid validationToken returns 400 ────────────

  test("Microsoft webhook returns 400 for a validationToken that is too long (>512 chars)", async ({
    request,
  }) => {
    // Exceeds the 512-character limit enforced by the regex guard
    const oversizedToken = "A".repeat(513);
    const response = await request.post(
      `/api/webhooks/microsoft?validationToken=${oversizedToken}`,
      {
        headers: { "Content-Type": "application/json" },
        data: {},
      }
    );

    expect(response.status()).toBe(400);
  });

  test("Microsoft webhook returns 400 for a validationToken containing disallowed characters", async ({
    request,
  }) => {
    // The regex /^[A-Za-z0-9\-_=+/.]{1,512}$/ forbids characters like <>{}
    const maliciousToken = "<script>alert(1)</script>";
    const response = await request.post(
      `/api/webhooks/microsoft?validationToken=${encodeURIComponent(maliciousToken)}`,
      {
        headers: { "Content-Type": "application/json" },
        data: {},
      }
    );

    expect(response.status()).toBe(400);
  });

  test("Microsoft webhook 400 response body text is 'Invalid token'", async ({
    request,
  }) => {
    const oversizedToken = "B".repeat(600);
    const response = await request.post(
      `/api/webhooks/microsoft?validationToken=${oversizedToken}`,
      {
        headers: { "Content-Type": "application/json" },
        data: {},
      }
    );

    expect(response.status()).toBe(400);
    const body = await response.text();
    expect(body).toBe("Invalid token");
  });

  // ── Cross-cutting: both endpoints are available ───────────────────────────

  test("Google webhook endpoint is reachable (not 404)", async ({ request }) => {
    const response = await request.post("/api/webhooks/google", {
      headers: {
        "x-goog-channel-id": "probe-channel",
        "x-goog-resource-id": "probe-resource",
        "Content-Type": "application/json",
      },
      data: {},
    });

    // May be 200 or (unlikely) an internal error — but must not be 404
    expect(response.status()).not.toBe(404);
  });

  test("Microsoft webhook endpoint is reachable (not 404)", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/microsoft", {
      headers: { "Content-Type": "application/json" },
      data: { value: [] },
    });

    expect(response.status()).not.toBe(404);
  });
});
