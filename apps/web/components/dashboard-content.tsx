"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { trpc } from "@/lib/trpc/client";
import { formatFriendlyDate, formatCurrency } from "@orbyt/shared/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarWidget } from "@/components/dashboard/calendar-widget";

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
  const prefersReducedMotion = useReducedMotion();
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
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={prefersReducedMotion ? false : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
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
          { label: "Tasks Due Today",     value: sv(l1, tasksToday?.length),   accent: "teal",   href: "/tasks"    },
          { label: "Bills Due This Week", value: sv(l2, billsWeek?.length),    accent: "gold",   href: "/finances" },
          { label: "Upcoming Birthdays",  value: sv(l3, birthdays?.length),    accent: "violet", href: "/contacts" },
          { label: "Shopping Items",      value: sv(l4, uncheckedItems),       accent: "teal",   href: "/shopping" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="glass-card glass-card-hover p-4 block">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-accent">
              {stat.value}
            </p>
          </Link>
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
            <div className="space-y-1">
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : events && events.length > 0 ? (
            <>
              <ul className="space-y-1">
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
            <EmptyState
              compact
              character="rosie"
              expression="happy"
              title="Your calendar is wide open."
              description="Add events and I'll make sure the family stays in sync."
            />
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
            <div className="space-y-1">
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : upcomingBills && upcomingBills.length > 0 ? (
            <>
              <ul className="space-y-1">
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
            <EmptyState
              compact
              character="rosie"
              expression="thinking"
              title="No bills being tracked."
              description="Add your household bills and I'll keep an eye on what's due."
            />
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
            <div className="space-y-1">
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : pendingTasks && pendingTasks.length > 0 ? (
            <>
              <ul className="space-y-1">
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
            <EmptyState
              compact
              character="rosie"
              expression="happy"
              title="All clear! Nothing on the to-do list."
              description="When you add tasks, I'll help keep everyone on track."
            />
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
            <div className="space-y-1">
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
          ) : shoppingLists && shoppingLists.length > 0 ? (
            <>
              <ul className="space-y-1">
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
            <EmptyState
              compact
              character="rosie"
              expression="happy"
              title="No shopping lists yet."
              description="Create a list and I'll make sure nothing gets forgotten."
            />
          )}
        </div>

        {/* ── Mini Calendar ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <CalendarWidget />
        </div>

      </div>
    </motion.div>
  );
}
