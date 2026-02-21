"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, DatesSetArg, EventClickArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { trpc } from "@/lib/trpc/client";
import { useRealtimeInvalidation } from "@/hooks/use-realtime";
import { CalendarToolbar } from "./calendar-toolbar";
import type { CalendarView } from "./calendar-toolbar";
import { EventDrawer } from "./event-drawer";

// ── Dynamic import via ref-forwarding wrapper (performance — ~180KB, no SSR) ──

const FullCalendar = dynamic(() => import("./full-calendar-wrapper"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type CalendarEvent = RouterOutput["calendar"]["list"][number];

// ── Category colors ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  family: "#06B6D4",
  work: "#3B82F6",
  health: "#10B981",
  school: "#8B5CF6",
  social: "#F59E0B",
  other: "#6B7280",
};

// ── CSS overrides for FullCalendar theming ────────────────────────────────────

const calendarStyles = `
  .fc { font-family: inherit; }
  .fc-theme-standard td, .fc-theme-standard th { border-color: var(--color-border, rgba(255,255,255,0.1)); }
  .fc .fc-daygrid-day { background: transparent; }
  .fc .fc-col-header-cell { background: var(--color-surface, rgba(255,255,255,0.06)); padding: 8px 0; }
  .fc .fc-col-header-cell-cushion { color: var(--color-text-secondary, rgba(255,255,255,0.5)); font-size: 0.75rem; font-weight: 500; text-decoration: none; }
  .fc .fc-daygrid-day-number { color: var(--color-text-secondary, rgba(255,255,255,0.5)); font-size: 0.8125rem; text-decoration: none; }
  .fc .fc-daygrid-day.fc-day-today { background: var(--color-surface, rgba(255,255,255,0.04)); }
  .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number { color: var(--color-accent, #06B6D4); font-weight: 700; }
  .fc .fc-daygrid-day:hover { background: var(--color-surface, rgba(255,255,255,0.04)); cursor: pointer; }
  .fc-event { border-radius: 6px; font-size: 0.75rem; border: none !important; padding: 2px 6px; cursor: pointer; }
  .fc-event .fc-event-title { font-weight: 500; }
  .fc .fc-timegrid-slot { border-color: var(--color-border, rgba(255,255,255,0.06)); }
  .fc .fc-timegrid-col.fc-day-today { background: transparent; }
  .fc .fc-timegrid-slot-label { color: var(--color-text-secondary, rgba(255,255,255,0.5)); font-size: 0.75rem; }
  .fc .fc-scrollgrid { border: none; }
  .fc .fc-scrollgrid-section-body td { border-bottom: none; }
  .fc-list-event:hover td { background: var(--color-surface); }
  .fc-list-empty { background: transparent; }
  .fc-list-event-title a { color: var(--color-text); text-decoration: none; }
  .fc-list-day-cushion { background: var(--color-surface) !important; color: var(--color-text-secondary); font-size: 0.8125rem; }
`;

// ── CalendarContent ───────────────────────────────────────────────────────────

export function CalendarContent() {
  const utils = trpc.useUtils();

  const [view, setView] = useState<CalendarView>("dayGridMonth");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date().toISOString(),
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // FullCalendar ref — typed as any to avoid issues with the dynamic import wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calendarRef = useRef<any>(null);

  // Query events for the current range
  const { data: events, isLoading } = trpc.calendar.list.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Real-time invalidation for calendar events
  useRealtimeInvalidation(
    "events",
    undefined,
    () => utils.calendar.list.invalidate({ startDate: dateRange.start, endDate: dateRange.end }),
  );

  // Map to FullCalendar EventInput format
  const calendarEvents: EventInput[] =
    events?.map((event: CalendarEvent) => ({
      id: event.id,
      title: event.title,
      start: event.startAt instanceof Date ? event.startAt.toISOString() : String(event.startAt),
      end: event.endAt
        ? (event.endAt instanceof Date ? event.endAt.toISOString() : String(event.endAt))
        : undefined,
      allDay: event.allDay,
      backgroundColor: CATEGORY_COLORS[event.category ?? "other"] ?? "#6B7280",
      borderColor: "transparent",
      textColor: "#ffffff",
    })) ?? [];

  // Toolbar handlers
  const handlePrev = useCallback(() => {
    calendarRef.current?.getApi().prev();
  }, []);

  const handleNext = useCallback(() => {
    calendarRef.current?.getApi().next();
  }, []);

  const handleToday = useCallback(() => {
    calendarRef.current?.getApi().today();
  }, []);

  const handleViewChange = useCallback((newView: CalendarView) => {
    setView(newView);
    calendarRef.current?.getApi().changeView(newView);
  }, []);

  // Event handlers
  const handleDatesSet = useCallback((dateInfo: DatesSetArg) => {
    setDateRange({ start: dateInfo.startStr, end: dateInfo.endStr });
    setCalendarTitle(dateInfo.view.title);
    setView(dateInfo.view.type as CalendarView);
  }, []);

  const handleDateClick = useCallback((info: DateClickArg) => {
    setSelectedEventId(null);
    setSelectedDate(info.dateStr);
    setDrawerOpen(true);
  }, []);

  const handleEventClick = useCallback((info: EventClickArg) => {
    setSelectedDate(null);
    setSelectedEventId(info.event.id);
    setDrawerOpen(true);
  }, []);

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => {
      setSelectedEventId(null);
      setSelectedDate(null);
    }, 300);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: calendarStyles }} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col gap-4"
      >
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-text">Calendar</h1>
            <p className="mt-1 text-text-secondary">Shared family schedule</p>
          </div>
          <button
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              setSelectedDate(today);
              setSelectedEventId(null);
              setDrawerOpen(true);
            }}
            className="orbyt-button-accent shrink-0"
          >
            + Add Event
          </button>
        </div>

        {/* Toolbar */}
        <CalendarToolbar
          view={view}
          title={calendarTitle}
          onViewChange={handleViewChange}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
        />

        {/* Calendar */}
        <div className="glass-card rounded-2xl p-4">
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />
              ))}
            </div>
          ) : (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={view}
              headerToolbar={false}
              height="calc(100vh - 280px)"
              events={calendarEvents}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              datesSet={handleDatesSet}
              selectable
              editable={false}
              dayMaxEvents={3}
              nowIndicator
            />
          )}
        </div>
      </motion.div>

      {/* Event Drawer */}
      <EventDrawer
        eventId={selectedEventId}
        defaultDate={selectedDate}
        open={drawerOpen}
        onClose={closeDrawer}
        dateRange={dateRange}
      />
    </>
  );
}
