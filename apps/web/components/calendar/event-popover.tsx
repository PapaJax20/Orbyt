"use client";

import { format } from "date-fns";
import { CATEGORY_COLORS } from "@/lib/calendar-colors";

interface EventPopoverProps {
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  category: string;
  location?: string;
  color?: string;
  position: { x: number; y: number };
}

export function EventPopover({
  title,
  start,
  end,
  allDay,
  category,
  location,
  color,
  position,
}: EventPopoverProps) {
  const bgColor = color ?? CATEGORY_COLORS[category] ?? "#6B7280";

  const timeStr = allDay
    ? format(start, "MMM d, yyyy")
    : `${format(start, "MMM d, h:mm a")}${end ? ` – ${format(end, "h:mm a")}` : ""}`;

  return (
    <div
      className="pointer-events-none fixed z-50 w-56 rounded-xl border border-border bg-bg/95 p-3 shadow-xl backdrop-blur-sm"
      style={{ left: position.x, top: position.y + 8 }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: bgColor }}
        />
        <span className="text-xs capitalize text-text-muted">{category}</span>
      </div>
      <p className="text-sm font-semibold leading-tight text-text">{title}</p>
      <p className="mt-1 text-xs text-text-muted">{timeStr}</p>
      {location && (
        <p className="mt-1 text-xs text-text-muted">
          <span role="img" aria-label="location">
            📍
          </span>{" "}
          {location}
        </p>
      )}
    </div>
  );
}
