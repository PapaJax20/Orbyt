"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { format } from "date-fns";
import { DollarSign, CheckSquare, Cake, Heart, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { EventInput, DatesSetArg, EventClickArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeInvalidation } from "@/hooks/use-realtime";
import { CATEGORY_COLORS } from "@/lib/calendar-colors";
import { useMediaQuery } from "@/hooks/use-media-query";
import { CalendarToolbar } from "./calendar-toolbar";
import type { CalendarView } from "./calendar-toolbar";
import { EventDrawer } from "./event-drawer";
import { EventPopover } from "./event-popover";

// ── Dynamic import via ref-forwarding wrapper (performance — ~180KB, no SSR) ──

const FullCalendar = dynamic(() => import("./full-calendar-wrapper"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type CalendarEvent = RouterOutput["calendar"]["list"][number];

// ── CSS overrides for FullCalendar theming ────────────────────────────────────

const calendarStyles = `
  .fc { font-family: inherit; }
  .fc-theme-standard td, .fc-theme-standard th { border-color: var(--color-border, rgba(255,255,255,0.1)); }
  .fc .fc-daygrid-day { background: transparent; }
  .fc .fc-col-header-cell { background: var(--color-surface, rgba(255,255,255,0.06)); padding: 8px 0; }
  .fc .fc-col-header-cell-cushion { color: var(--color-text-muted, rgba(255,255,255,0.5)); font-size: 0.75rem; font-weight: 500; text-decoration: none; }
  .fc .fc-daygrid-day-number { color: var(--color-text-muted, rgba(255,255,255,0.5)); font-size: 0.8125rem; text-decoration: none; }
  .fc .fc-daygrid-day.fc-day-today { background: var(--color-surface, rgba(255,255,255,0.04)); }
  .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number { color: var(--color-accent, #06B6D4); font-weight: 700; }
  .fc .fc-daygrid-day:hover { background: var(--color-surface, rgba(255,255,255,0.04)); cursor: pointer; }
  .fc-event { border-radius: 6px; font-size: 0.75rem; border: none !important; padding: 2px 6px; cursor: pointer; }
  .fc-event .fc-event-title { font-weight: 500; }
  .fc .fc-timegrid-slot { border-color: var(--color-border, rgba(255,255,255,0.06)); }
  .fc .fc-timegrid-col.fc-day-today { background: transparent; }
  .fc .fc-timegrid-slot-label { color: var(--color-text-muted, rgba(255,255,255,0.5)); font-size: 0.75rem; }
  .fc .fc-scrollgrid { border: none; }
  .fc .fc-scrollgrid-section-body td { border-bottom: none; }
  .fc-list-event:hover td { background: var(--color-surface); }
  .fc-list-empty { background: transparent; }
  .fc-list-event-title a { color: var(--color-text); text-decoration: none; }
  .fc-list-day-cushion { background: var(--color-surface) !important; color: var(--color-text-muted); font-size: 0.8125rem; }
`;

// ── Popover state type ────────────────────────────────────────────────────────

interface PopoverData {
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  category: string;
  location?: string;
  color?: string;
  position: { x: number; y: number };
}

// ── Agenda View ──────────────────────────────────────────────────────────────

const AGENDA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  event: CalendarIcon,
  bill: DollarSign,
  task: CheckSquare,
  birthday: Cake,
  anniversary: Heart,
};

const AGENDA_COLORS: Record<string, string> = {
  event: "bg-accent/20 text-accent",
  bill: "bg-amber-500/20 text-amber-500",
  task: "bg-blue-500/20 text-blue-500",
  birthday: "bg-pink-500/20 text-pink-500",
  anniversary: "bg-red-500/20 text-red-500",
};

type AgendaItem = {
  type: "event" | "bill" | "task" | "birthday" | "anniversary";
  id: string;
  title: string;
  date: string | Date;
  allDay: boolean;
  metadata: Record<string, unknown>;
};

function AgendaView({ items, isLoading }: { items: AgendaItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <CalendarIcon className="mx-auto mb-3 h-8 w-8 text-text-muted/40" />
        <p className="text-sm text-text-muted">No items in this period</p>
      </div>
    );
  }

  // Group by date (YYYY-MM-DD)
  const grouped = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {Array.from(grouped.entries()).map(([dateKey, dayItems]) => {
        const d = new Date(dateKey + "T12:00:00");
        const label = format(d, "EEEE, MMMM d");
        const isToday = dateKey === format(new Date(), "yyyy-MM-dd");

        return (
          <div key={dateKey}>
            {/* Day header */}
            <div
              className={[
                "px-4 py-2 text-xs font-semibold uppercase tracking-wider",
                isToday ? "bg-accent/10 text-accent" : "bg-surface/50 text-text-muted",
              ].join(" ")}
            >
              {isToday ? "Today" : label}
            </div>
            {/* Items */}
            {dayItems.map((item) => {
              const Icon = AGENDA_ICONS[item.type] ?? CalendarIcon;
              const colorClass = AGENDA_COLORS[item.type] ?? "bg-surface text-text-muted";
              const time = item.allDay
                ? "All day"
                : format(new Date(item.date), "h:mm a");

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center gap-3 border-b border-border/10 px-4 py-3 transition-colors hover:bg-surface/30"
                >
                  <div
                    className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      colorClass,
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {item.title}
                    </p>
                    <p className="text-xs text-text-muted">
                      {time}
                      {item.metadata?.location
                        ? ` \u00B7 ${item.metadata.location}`
                        : ""}
                      {item.metadata?.amount
                        ? ` \u00B7 $${parseFloat(String(item.metadata.amount)).toFixed(2)}`
                        : ""}
                      {item.metadata?.priority
                        ? ` \u00B7 ${item.metadata.priority} priority`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface/50 px-2 py-0.5 text-[10px] capitalize text-text-muted">
                    {item.type}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── CalendarContent ───────────────────────────────────────────────────────────

export function CalendarContent() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const utils = trpc.useUtils();
  const prefersReducedMotion = useReducedMotion();

  const [view, setView] = useState<CalendarView>("dayGridMonth");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date().toISOString(),
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Popover state
  const [popover, setPopover] = useState<PopoverData | null>(null);

  // FullCalendar ref — typed as any to avoid issues with the dynamic import wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calendarRef = useRef<any>(null);

  // Get current user ID for week start preference
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Query household to get profile with weekStartDay
  const { data: household } = trpc.household.getCurrent.useQuery();
  const me = household?.members.find((m) => m.userId === userId);
  const weekStartDay = (me?.profile as Record<string, unknown> | undefined)?.weekStartDay as string | undefined;

  // Member color map for event color-coding
  const memberColorMap = new Map<string, string>();
  household?.members.forEach((m) => {
    memberColorMap.set(m.userId, m.displayColor);
  });

  // Query events for the current range
  const { data: events, isLoading } = trpc.calendar.list.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Search query
  const { data: searchResults } = trpc.calendar.search.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.length > 0 },
  );

  // Agenda view
  const isAgendaView = view === "agenda";

  const { data: agendaItems, isLoading: agendaLoading } = trpc.calendar.getAgendaItems.useQuery(
    {
      startDate: dateRange.start,
      endDate: dateRange.end,
      includeBills: true,
      includeTasks: true,
      includeBirthdays: true,
    },
    { enabled: isAgendaView },
  );

  // Real-time invalidation for calendar events
  useRealtimeInvalidation(
    "events",
    undefined,
    () => {
      utils.calendar.list.invalidate({ startDate: dateRange.start, endDate: dateRange.end });
      if (isAgendaView) utils.calendar.getAgendaItems.invalidate();
    },
  );

  // Drag-drop mutation
  const updateEvent = trpc.calendar.update.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate({ startDate: dateRange.start, endDate: dateRange.end });
      toast.success("Event moved");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to move event");
    },
  });

  // Map to FullCalendar EventInput format
  const calendarEvents: EventInput[] =
    events?.map((event: CalendarEvent) => {
      const memberColor = memberColorMap.get(event.createdBy);
      const bgColor = event.color ?? memberColor ?? CATEGORY_COLORS[event.category ?? "other"] ?? "#6B7280";
      return {
        id: event.id,
        title: event.title,
        start: event.startAt instanceof Date ? event.startAt.toISOString() : String(event.startAt),
        end: event.endAt
          ? (event.endAt instanceof Date ? event.endAt.toISOString() : String(event.endAt))
          : undefined,
        allDay: event.allDay,
        backgroundColor: bgColor,
        borderColor: "transparent",
        textColor: "#ffffff",
        extendedProps: {
          category: event.category ?? "other",
          location: event.location ?? undefined,
          color: event.color ?? undefined,
          memberColor,
        },
      };
    }) ?? [];

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
    if (newView !== "agenda") {
      calendarRef.current?.getApi().changeView(newView);
    }
  }, []);

  // Event handlers
  const handleDatesSet = useCallback((dateInfo: DatesSetArg) => {
    setDateRange({ start: dateInfo.start.toISOString(), end: dateInfo.end.toISOString() });
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

  // Drag-drop handlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventDrop = useCallback((info: any) => {
    updateEvent.mutate({
      id: info.event.id,
      updateMode: "all",
      data: {
        startAt: info.event.start?.toISOString(),
        endAt: info.event.end?.toISOString() ?? undefined,
        allDay: info.event.allDay,
      },
    });
  }, [updateEvent]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventResize = useCallback((info: any) => {
    updateEvent.mutate({
      id: info.event.id,
      updateMode: "all",
      data: {
        startAt: info.event.start?.toISOString(),
        endAt: info.event.end?.toISOString() ?? undefined,
      },
    });
  }, [updateEvent]);

  // Popover handlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventMouseEnter = useCallback((info: any) => {
    const rect = info.el.getBoundingClientRect();
    setPopover({
      title: info.event.title,
      start: info.event.start,
      end: info.event.end,
      allDay: info.event.allDay,
      category: info.event.extendedProps?.category ?? "other",
      location: info.event.extendedProps?.location,
      color: info.event.extendedProps?.color,
      position: { x: rect.left, y: rect.bottom },
    });
  }, []);

  const handleEventMouseLeave = useCallback(() => {
    setPopover(null);
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
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={prefersReducedMotion ? false : { opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col gap-4"
      >
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-text">Calendar</h1>
            <p className="mt-1 text-text-muted">Shared family schedule</p>
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
          onSearch={setSearchQuery}
          searchQuery={searchQuery}
        />

        {/* Search results overlay */}
        {debouncedSearch.length > 0 && searchResults && searchResults.length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Search Results ({searchResults.length})
            </p>
            <div className="flex flex-col gap-2">
              {searchResults.map((result) => {
                const startDate = new Date(result.startAt);
                const catColor = (result as Record<string, unknown>).color as string | null ??
                  CATEGORY_COLORS[result.category ?? "other"] ?? "#6B7280";
                return (
                  <button
                    key={result.id}
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedDate(null);
                      setSelectedEventId(result.id);
                      setDrawerOpen(true);
                    }}
                    className="flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: catColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{result.title}</p>
                      <p className="text-xs text-text-muted">
                        {format(startDate, "MMM d, yyyy")}
                        {result.location ? ` · ${result.location}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] capitalize text-text-muted">
                      {result.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {debouncedSearch.length > 0 && searchResults && searchResults.length === 0 && (
          <div className="glass-card rounded-2xl p-6 text-center">
            <p className="text-sm text-text-muted">No events found for &ldquo;{debouncedSearch}&rdquo;</p>
          </div>
        )}

        {/* Calendar */}
        {isAgendaView ? (
          <AgendaView items={agendaItems ?? []} isLoading={agendaLoading} />
        ) : (
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
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                initialView={view}
                headerToolbar={false}
                height={isMobile ? "calc(100vh - 344px)" : "calc(100vh - 280px)"}
                events={calendarEvents}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                datesSet={handleDatesSet}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventMouseEnter={handleEventMouseEnter}
                eventMouseLeave={handleEventMouseLeave}
                selectable
                editable={true}
                dayMaxEvents={3}
                nowIndicator
                firstDay={weekStartDay === "monday" ? 1 : 0}
              />
            )}
          </div>
        )}
      </motion.div>

      {/* Event Popover (hover) */}
      {popover && (
        <EventPopover
          title={popover.title}
          start={popover.start}
          end={popover.end}
          allDay={popover.allDay}
          category={popover.category}
          location={popover.location}
          color={popover.color}
          position={popover.position}
        />
      )}

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
