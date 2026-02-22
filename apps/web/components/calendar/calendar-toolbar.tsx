"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type CalendarView = "dayGridMonth" | "timeGridWeek" | "timeGridDay";

interface CalendarToolbarProps {
  view: CalendarView;
  title: string;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const VIEW_LABELS: Record<CalendarView, string> = {
  dayGridMonth: "Month",
  timeGridWeek: "Week",
  timeGridDay: "Day",
};

const VIEWS: CalendarView[] = ["dayGridMonth", "timeGridWeek", "timeGridDay"];

export function CalendarToolbar({
  view,
  title,
  onViewChange,
  onPrev,
  onNext,
  onToday,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Left: navigation */}
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
                : "text-text-secondary hover:text-text",
            ].join(" ")}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
    </div>
  );
}
