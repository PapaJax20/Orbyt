"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { formatFriendlyDate, formatCurrency } from "@orbyt/shared/utils";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-text-muted",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="h-2.5 w-2.5 rounded-full bg-white/10 animate-pulse shrink-0" />
      <div className="h-3 flex-1 rounded bg-white/10 animate-pulse" />
      <div className="h-3 w-14 rounded bg-white/10 animate-pulse shrink-0" />
    </div>
  );
}

function ViewAllLink({ href, count, label }: { href: string; count: number; label: string }) {
  return (
    <Link
      href={href}
      className="mt-3 block text-center text-xs text-accent hover:underline"
    >
      View all {count} {label} →
    </Link>
  );
}

export function DashboardContent() {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  // ── Stat card queries ──────────────────────────────────────────────────────
  const { data: tasksToday, isLoading: l1 } = trpc.tasks.list.useQuery({
    status: ["todo", "in_progress"],
    dueBefore: todayEnd.toISOString(),
  });
  const { data: billsWeek, isLoading: l2 } = trpc.finances.getUpcoming.useQuery({
    daysAhead: 7,
  });
  const { data: birthdays, isLoading: l3 } = trpc.contacts.getUpcomingBirthdays.useQuery({
    daysAhead: 30,
  });
  const { data: shoppingLists, isLoading: l4 } = trpc.shopping.listLists.useQuery();

  // ── Widget queries ─────────────────────────────────────────────────────────
  const { data: events, isLoading: eventsLoading } = trpc.calendar.list.useQuery({
    startDate: now.toISOString(),
    endDate: nextWeek.toISOString(),
  });
  const { data: upcomingBills, isLoading: billsLoading } = trpc.finances.getUpcoming.useQuery({
    daysAhead: 30,
  });
  const { data: pendingTasks, isLoading: tasksLoading } = trpc.tasks.list.useQuery({
    status: ["todo", "in_progress"],
  });

  // ── Derived values ─────────────────────────────────────────────────────────
  const uncheckedItems = shoppingLists?.reduce(
    (sum, list) => sum + (list.itemCount - list.checkedCount),
    0
  );

  const sv = (loading: boolean, v?: number) =>
    loading ? "…" : v !== undefined ? String(v) : "—";

  return (
    <>
      {/* Page header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-text">
          {getGreeting()} ✨
        </h1>
        <p className="mt-1 text-text-muted">
          Here&apos;s what&apos;s happening in your household today.
        </p>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Tasks Due Today",     value: sv(l1, tasksToday?.length),   accent: "teal"   },
          { label: "Bills Due This Week", value: sv(l2, billsWeek?.length),    accent: "gold"   },
          { label: "Upcoming Birthdays",  value: sv(l3, birthdays?.length),    accent: "violet" },
          { label: "Shopping Items",      value: sv(l4, uncheckedItems),       accent: "teal"   },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-accent">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main widgets grid */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* ── Upcoming Events ─────────────────────────────────────────────── */}
        <div className="glass-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-text">
            <Link href="/calendar" className="hover:text-accent transition-colors">
              Upcoming Events
            </Link>
          </h2>

          {eventsLoading ? (
            <div className="divide-y divide-white/5">
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : events && events.length > 0 ? (
            <>
              <ul className="divide-y divide-white/5">
                {events.slice(0, 3).map((event, i) => (
                  <li key={`${event.id}-${i}`} className="flex items-center gap-3 py-2.5">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: event.color ?? "var(--color-accent)" }}
                    />
                    <span className="flex-1 truncate text-sm text-text">{event.title}</span>
                    <span className="shrink-0 text-xs text-text-muted">
                      {formatFriendlyDate(new Date(event.startAt), !event.allDay)}
                    </span>
                  </li>
                ))}
              </ul>
              {events.length > 3 && (
                <ViewAllLink href="/calendar" count={events.length} label="events" />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-4xl">📅</p>
              <p className="mt-3 text-sm text-text-muted">No upcoming events</p>
              <Link href="/calendar" className="orbyt-button-accent mt-4 w-auto px-6">
                Add Event
              </Link>
            </div>
          )}
        </div>

        {/* ── Financial Snapshot ──────────────────────────────────────────── */}
        <div className="glass-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-text">
            <Link href="/finances" className="hover:text-accent transition-colors">
              Financial Snapshot
            </Link>
          </h2>

          {billsLoading ? (
            <div className="divide-y divide-white/5">
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : upcomingBills && upcomingBills.length > 0 ? (
            <>
              <ul className="divide-y divide-white/5">
                {upcomingBills.slice(0, 3).map((bill) => (
                  <li key={bill.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex-1 truncate text-sm text-text">{bill.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-cta">
                      {formatCurrency(bill.amount ?? "0")}
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">
                      {formatFriendlyDate(new Date(bill.nextDueDate))}
                    </span>
                  </li>
                ))}
              </ul>
              {upcomingBills.length > 3 && (
                <ViewAllLink href="/finances" count={upcomingBills.length} label="bills" />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-4xl">💰</p>
              <p className="mt-3 text-sm text-text-muted">No bills tracked yet</p>
              <Link href="/finances" className="orbyt-button-accent mt-4 w-auto px-6">
                Add Bill
              </Link>
            </div>
          )}
        </div>

        {/* ── Tasks Summary ────────────────────────────────────────────────── */}
        <div className="glass-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-text">
            <Link href="/tasks" className="hover:text-accent transition-colors">
              Tasks
            </Link>
          </h2>

          {tasksLoading ? (
            <div className="divide-y divide-white/5">
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : pendingTasks && pendingTasks.length > 0 ? (
            <>
              <ul className="divide-y divide-white/5">
                {pendingTasks.slice(0, 3).map((task) => (
                  <li key={task.id} className="flex items-center gap-3 py-2.5">
                    <div
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority ?? "low"] ?? "bg-text-muted"}`}
                    />
                    <span className="flex-1 truncate text-sm text-text">{task.title}</span>
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-text-muted">
                      {STATUS_LABEL[task.status] ?? task.status}
                    </span>
                  </li>
                ))}
              </ul>
              {pendingTasks.length > 3 && (
                <ViewAllLink href="/tasks" count={pendingTasks.length} label="tasks" />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-4xl">✅</p>
              <p className="mt-3 text-sm text-text-muted">Your task list is empty</p>
              <Link href="/tasks" className="orbyt-button-accent mt-4 w-auto px-6">
                Add Task
              </Link>
            </div>
          )}
        </div>

        {/* ── Shopping Lists ───────────────────────────────────────────────── */}
        <div className="glass-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-text">
            <Link href="/shopping" className="hover:text-accent transition-colors">
              Shopping Lists
            </Link>
          </h2>

          {l4 ? (
            <div className="divide-y divide-white/5">
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : shoppingLists && shoppingLists.length > 0 ? (
            <>
              <ul className="divide-y divide-white/5">
                {shoppingLists.slice(0, 3).map((list) => {
                  const remaining = list.itemCount - list.checkedCount;
                  return (
                    <li key={list.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex-1 truncate text-sm text-text">{list.name}</span>
                      <span className="shrink-0 text-xs text-text-muted">
                        {remaining === 0
                          ? "All done ✓"
                          : `${remaining} item${remaining !== 1 ? "s" : ""} left`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {shoppingLists.length > 3 && (
                <ViewAllLink href="/shopping" count={shoppingLists.length} label="lists" />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-4xl">🛒</p>
              <p className="mt-3 text-sm text-text-muted">No shopping lists yet</p>
              <Link href="/shopping" className="orbyt-button-accent mt-4 w-auto px-6">
                Create List
              </Link>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
