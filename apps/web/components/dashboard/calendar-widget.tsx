"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const cells: (number | null)[] = [];
  // Leading empty cells
  for (let i = 0; i < startOffset; i++) {
    cells.push(null);
  }
  // Day cells
  for (let d = 1; d <= totalDays; d++) {
    cells.push(d);
  }
  // Trailing empty cells to fill grid
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── CalendarWidget ────────────────────────────────────────────────────────────

export function CalendarWidget() {
  const router = useRouter();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // Date range for the currently viewed month
  const monthStart = useMemo(
    () => new Date(viewYear, viewMonth, 1).toISOString(),
    [viewYear, viewMonth],
  );
  const monthEnd = useMemo(
    () => new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999).toISOString(),
    [viewYear, viewMonth],
  );

  const { data: events, isLoading } = trpc.calendar.list.useQuery({
    startDate: monthStart,
    endDate: monthEnd,
  });

  // Build a set of day numbers that have events
  const eventDays = useMemo(() => {
    const days = new Set<number>();
    if (!events) return days;
    for (const event of events) {
      const d = new Date(event.startAt);
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        days.add(d.getDate());
      }
    }
    return days;
  }, [events, viewYear, viewMonth]);

  const cells = useMemo(
    () => getMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const todayDay =
    now.getFullYear() === viewYear && now.getMonth() === viewMonth
      ? now.getDate()
      : null;

  function handlePrev() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNext() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleDayClick(day: number) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    router.push(`/calendar?date=${dateStr}`);
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-text flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-accent" aria-hidden="true" />
          Mini Calendar
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            aria-label="Previous month"
            className="orbyt-button-ghost rounded-xl p-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[120px] text-center text-sm font-medium text-text-muted">
            {formatMonthYear(viewYear, viewMonth)}
          </span>
          <button
            onClick={handleNext}
            aria-label="Next month"
            className="orbyt-button-ghost rounded-xl p-1.5"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted"
          >
            {label}
          </div>
        ))}

        {/* Day cells */}
        {isLoading
          ? Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="flex h-9 items-center justify-center rounded-lg"
              >
                <div className="h-5 w-5 animate-pulse rounded-full bg-surface" />
              </div>
            ))
          : cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="h-9" />;
              }

              const isToday = day === todayDay;
              const hasEvent = eventDays.has(day);

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => handleDayClick(day)}
                  aria-label={`${formatMonthYear(viewYear, viewMonth)} ${day}${hasEvent ? ", has events" : ""}`}
                  className={[
                    "relative flex h-9 items-center justify-center rounded-lg text-sm transition-colors",
                    isToday
                      ? "bg-accent font-bold text-white"
                      : "text-text hover:bg-surface",
                  ].join(" ")}
                >
                  {day}
                  {hasEvent && (
                    <span
                      className={[
                        "absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                        isToday ? "bg-white" : "bg-accent",
                      ].join(" ")}
                    />
                  )}
                </button>
              );
            })}
      </div>
    </div>
  );
}
