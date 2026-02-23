"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export type CalendarView = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";

interface CalendarToolbarProps {
  view: CalendarView;
  title: string;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

const VIEW_LABELS: Record<CalendarView, string> = {
  dayGridMonth: "Month",
  timeGridWeek: "Week",
  timeGridDay: "Day",
  listWeek: "List",
};

const VIEWS: CalendarView[] = ["dayGridMonth", "timeGridWeek", "timeGridDay", "listWeek"];

export function CalendarToolbar({
  view,
  title,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onSearch,
  searchQuery,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Left: navigation + search */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          aria-label="Previous period"
          className="orbyt-button-ghost rounded-xl p-2"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onNext}
          aria-label="Next period"
          className="orbyt-button-ghost rounded-xl p-2"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button onClick={onToday} className="orbyt-button-ghost text-sm">
          Today
        </button>
        {onSearch && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search events..."
              aria-label="Search events"
              className="orbyt-input h-8 w-40 pl-8 text-sm"
            />
          </div>
        )}
        <h2 className="font-display text-lg font-bold text-text">{title}</h2>
      </div>

      {/* Right: view toggle */}
      <div className="flex rounded-xl border border-border bg-surface/50 p-1 gap-1">
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              view === v
                ? "bg-accent text-white"
                : "text-text-muted hover:text-text",
            ].join(" ")}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
    </div>
  );
}
