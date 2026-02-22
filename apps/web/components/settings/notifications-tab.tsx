"use client";

// ── Notification items (future) ───────────────────────────────────────────────

const NOTIFICATION_ITEMS = [
  {
    id: "bill_due",
    label: "Bill reminders",
    description: "Get notified 3 days before a bill is due",
  },
  {
    id: "task_assigned",
    label: "Task assignments",
    description: "When a task is assigned to you",
  },
  {
    id: "events",
    label: "Upcoming events",
    description: "Daily digest of today's family events",
  },
  {
    id: "birthdays",
    label: "Birthday reminders",
    description: "Reminders for upcoming birthdays",
  },
  {
    id: "shopping",
    label: "Shopping lists",
    description: "When someone adds items to a shared list",
  },
];

// ── NotificationsTab ──────────────────────────────────────────────────────────

export function NotificationsTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="glass-card rounded-2xl px-5 py-4">
        <p className="text-sm font-medium text-text">Coming soon</p>
        <p className="mt-1 text-sm text-text-secondary">
          Notification preferences will be available in a future update.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {NOTIFICATION_ITEMS.map((item) => (
          <div
            key={item.id}
            className="glass-card flex items-center justify-between rounded-xl px-4 py-3 opacity-50"
          >
            <div>
              <p className="text-sm font-medium text-text">{item.label}</p>
              <p className="text-xs text-text-secondary">{item.description}</p>
            </div>
            {/* Disabled toggle */}
            <div
              className="relative inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full bg-border"
              aria-disabled="true"
              role="switch"
              aria-checked={false}
            >
              <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
