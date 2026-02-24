"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Pencil, Trash2, Check, X, ExternalLink, Link2, Loader2, Upload, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TimeSelect } from "@/components/ui/time-select";
import { RecurrencePicker } from "@/components/ui/recurrence-picker";
import { CategorySelect } from "@/components/ui/category-select";
import { EVENT_CATEGORIES } from "@orbyt/shared/constants";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";
import { getCategoryColor } from "@/lib/calendar-colors";
import type { ExternalEventData } from "./calendar-content";

type RouterOutput = inferRouterOutputs<AppRouter>;
type EventDetail = RouterOutput["calendar"]["getById"];

// ── Helpers ──────────────────────────────────────────────────────────────────

type EventCategory = string;

const COLOR_SWATCHES = [
  "",
  "#06B6D4",
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#F97316",
];

const REMINDER_OPTIONS = [
  { label: "5 min", value: 5 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1 day", value: 1440 },
] as const;

function formatReminderMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min before`;
  if (minutes === 60) return "1 hour before";
  if (minutes < 1440) return `${Math.round(minutes / 60)} hours before`;
  if (minutes === 1440) return "1 day before";
  return `${Math.round(minutes / 1440)} days before`;
}

function toDatetimeLocal(iso: string | Date): string {
  const d = new Date(iso);
  // Format: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISO(datetimeLocal: string): string {
  return new Date(datetimeLocal).toISOString();
}

function providerLabel(provider: string): string {
  if (provider === "google") return "Google Calendar";
  if (provider === "microsoft") return "Microsoft Outlook";
  return "External Calendar";
}

/** Check if account scopes include write access */
function hasWriteScopes(provider: string, scopes: string | null): boolean {
  if (!scopes) return false;
  if (provider === "google") return scopes.includes("calendar.events");
  if (provider === "microsoft") return scopes.includes("ReadWrite");
  return false;
}

// ── Attendee Picker ──────────────────────────────────────────────────────────

function AttendeePicker({
  selectedIds,
  onToggle,
}: {
  selectedIds: string[];
  onToggle: (userId: string) => void;
}) {
  const { data: household } = trpc.household.getCurrent.useQuery();
  const members = household?.members ?? [];

  if (members.length === 0) return null;

  return (
    <div>
      <label className="orbyt-label">Attendees</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {members.map((m) => {
          const selected = selectedIds.includes(m.userId);
          return (
            <button
              key={m.userId}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(m.userId)}
              className={[
                "flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                selected
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-border text-text-muted hover:border-text-muted hover:text-text",
              ].join(" ")}
            >
              <div
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: m.displayColor }}
              />
              {m.profile.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Color Picker ─────────────────────────────────────────────────────────────

function ColorPicker({
  color,
  setColor,
}: {
  color: string;
  setColor: (v: string) => void;
}) {
  return (
    <div>
      <label className="orbyt-label">
        Color <span className="text-text-muted">(optional)</span>
      </label>
      <div className="mt-1 flex gap-1">
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={[
              "flex h-11 w-11 items-center justify-center rounded-full transition-transform",
              color === c ? "scale-110" : "hover:scale-105",
            ].join(" ")}
            title={c || "Default (category color)"}
            aria-label={c ? `Set event color to ${c}` : "Use default category color"}
          >
            <span
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full border-2",
                color === c ? "border-white" : "border-transparent",
                !c ? "bg-surface" : "",
              ].join(" ")}
              style={c ? { backgroundColor: c } : undefined}
            >
              {!c && (
                <span className="text-[10px] text-text-muted">Auto</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Recurrence Mode Picker ────────────────────────────────────────────────────

function RecurrenceModePicker({
  action,
  open,
  onSelect,
  onCancel,
}: {
  action: "edit" | "delete";
  open: boolean;
  onSelect: (mode: "this" | "this_and_future" | "all") => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const title = action === "edit" ? "Edit recurring event" : "Delete recurring event";
  const options = [
    { mode: "this" as const, label: "This event only", description: "Only change this occurrence" },
    { mode: "this_and_future" as const, label: "This and future events", description: "Change this and all following occurrences" },
    { mode: "all" as const, label: "All events", description: "Change all occurrences in the series" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurrence-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="glass-card-elevated mx-4 w-full max-w-sm rounded-2xl p-5">
        <h3 id="recurrence-picker-title" className="mb-4 font-display text-lg font-bold text-text">{title}</h3>
        <div className="flex flex-col gap-2">
          {options.map((opt, idx) => (
            <button
              key={opt.mode}
              type="button"
              autoFocus={idx === 0}
              onClick={() => onSelect(opt.mode)}
              className="flex flex-col items-start rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-surface/50"
            >
              <span className="text-sm font-medium text-text">{opt.label}</span>
              <span className="text-xs text-text-muted">{opt.description}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="orbyt-button-ghost mt-3 w-full text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Event Form Fields (shared between create and edit) ───────────────────────

function EventFormFields({
  title,
  setTitle,
  startDate,
  setStartDate,
  startTime,
  setStartTime,
  endDate,
  setEndDate,
  endTime,
  setEndTime,
  allDay,
  setAllDay,
  category,
  setCategory,
  location,
  setLocation,
  description,
  setDescription,
  rrule,
  setRrule,
  color,
  setColor,
  attendeeIds,
  toggleAttendee,
  reminderMinutes,
  toggleReminder,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  title: string;
  setTitle: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  allDay: boolean;
  setAllDay: (v: boolean) => void;
  category: EventCategory;
  setCategory: (v: EventCategory) => void;
  location: string;
  setLocation: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  rrule: string;
  setRrule: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  attendeeIds: string[];
  toggleAttendee: (userId: string) => void;
  reminderMinutes: number[];
  toggleReminder: (minutes: number) => void;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
}) {
  const { data: customCats } = trpc.calendar.listCategories.useQuery();
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-6">
      {/* Title */}
      <div>
        <label className="orbyt-label" htmlFor="event-title">Title</label>
        <input
          id="event-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="orbyt-input mt-1 w-full"
          placeholder="Event title"
          required
          maxLength={255}
          autoFocus
        />
      </div>

      {/* All day toggle */}
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface/50 px-4 py-3">
        <span id="allday-label" className="text-sm font-medium text-text">All day</span>
        <button
          type="button"
          role="switch"
          aria-checked={allDay}
          aria-labelledby="allday-label"
          onClick={() => setAllDay(!allDay)}
          className={[
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            allDay ? "bg-accent" : "bg-border",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
              allDay ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </label>

      {/* Start / End */}
      {!allDay ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="orbyt-label" htmlFor="event-start-date">Start</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <input
                id="event-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="orbyt-input"
              />
              <TimeSelect value={startTime} onChange={setStartTime} id="event-start-time" />
            </div>
          </div>
          <div>
            <label className="orbyt-label" htmlFor="event-end-date">End</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <input
                id="event-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="orbyt-input"
              />
              <TimeSelect value={endTime} onChange={setEndTime} id="event-end-time" />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <label className="orbyt-label" htmlFor="event-date">Date</label>
          <input
            id="event-date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setEndDate(e.target.value);
            }}
            className="orbyt-input mt-1 w-full"
          />
        </div>
      )}

      {/* Category */}
      <div>
        <CategorySelect
          value={category}
          onChange={(v) => setCategory(v as EventCategory)}
          presets={EVENT_CATEGORIES}
          customCategories={customCats ?? []}
          label="Category"
          id="event-category"
        />
      </div>

      {/* Custom Color */}
      <ColorPicker color={color} setColor={setColor} />

      {/* Location */}
      <div>
        <label className="orbyt-label" htmlFor="event-location">
          Location <span className="text-text-muted">(optional)</span>
        </label>
        <input
          id="event-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="orbyt-input mt-1 w-full"
          placeholder="Where is this event?"
          maxLength={500}
        />
      </div>

      {/* Description */}
      <div>
        <label className="orbyt-label" htmlFor="event-description">
          Description <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          id="event-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="orbyt-input mt-1 w-full resize-none"
          rows={2}
          maxLength={2000}
        />
      </div>

      {/* Recurrence */}
      <div>
        <label className="orbyt-label">Recurrence</label>
        <RecurrencePicker
          value={rrule}
          onChange={setRrule}
          referenceDate={new Date(`${startDate}T${startTime}`)}
          className="mt-1"
        />
      </div>

      {/* Attendees */}
      <AttendeePicker selectedIds={attendeeIds} onToggle={toggleAttendee} />

      {/* Remind Me */}
      <div>
        <label className="orbyt-label">Remind me</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {REMINDER_OPTIONS.map((opt) => {
            const selected = reminderMinutes.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleReminder(opt.value)}
                className={[
                  "min-h-[44px] rounded-full border px-3 py-1.5 text-sm transition-colors",
                  selected
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-border text-text-muted hover:border-text-muted hover:text-text",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="orbyt-button-accent flex-1"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="orbyt-button-ghost flex-1"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateEventForm({
  defaultDate,
  defaultTitle,
  onClose,
  dateRange,
}: {
  defaultDate: string;
  defaultTitle?: string;
  onClose: () => void;
  dateRange: { start: string; end: string };
}) {
  const utils = trpc.useUtils();

  const defaultDatePart = defaultDate.slice(0, 10);
  const defaultTimePart = defaultDate.includes("T") ? defaultDate.slice(11, 16) : "09:00";

  const [title, setTitle] = useState(defaultTitle ?? "");
  const [startDate, setStartDate] = useState(defaultDatePart);
  const [startTime, setStartTime] = useState(defaultTimePart);
  const [endDate, setEndDate] = useState(defaultDatePart);
  const [endTime, setEndTime] = useState("10:00");
  const [userSetEnd, setUserSetEnd] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState<EventCategory>("family");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [rrule, setRrule] = useState("");
  const [color, setColor] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState<number[]>([]);

  function handleStartTimeChange(newTime: string) {
    setStartTime(newTime);
    if (!userSetEnd) {
      const [h, m] = newTime.split(":").map(Number);
      const endH = (h! + 1) % 24;
      setEndTime(`${String(endH).padStart(2, "0")}:${String(m!).padStart(2, "0")}`);
      if (endH < h!) {
        const nextDay = new Date(startDate);
        nextDay.setDate(nextDay.getDate() + 1);
        setEndDate(nextDay.toISOString().slice(0, 10));
      }
    }
  }

  function handleEndTimeChange(newTime: string) {
    setEndTime(newTime);
    setUserSetEnd(true);
  }

  const createEvent = trpc.calendar.create.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate({ startDate: dateRange.start, endDate: dateRange.end });
      toast.success("Event created");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create event");
    },
  });

  function toggleAttendee(userId: string) {
    setAttendeeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function toggleReminder(minutes: number) {
    setReminderMinutes((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createEvent.mutate({
      title: title.trim(),
      startAt: toISO(`${startDate}T${startTime}`),
      endAt: allDay ? undefined : toISO(`${endDate}T${endTime}`),
      allDay,
      category,
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      rrule: rrule || undefined,
      color: color || undefined,
      attendeeIds,
      reminderMinutes: reminderMinutes.length > 0 ? reminderMinutes : undefined,
    });
  }

  return (
    <EventFormFields
      title={title}
      setTitle={setTitle}
      startDate={startDate}
      setStartDate={setStartDate}
      startTime={startTime}
      setStartTime={handleStartTimeChange}
      endDate={endDate}
      setEndDate={setEndDate}
      endTime={endTime}
      setEndTime={handleEndTimeChange}
      allDay={allDay}
      setAllDay={setAllDay}
      category={category}
      setCategory={setCategory}
      location={location}
      setLocation={setLocation}
      description={description}
      setDescription={setDescription}
      rrule={rrule}
      setRrule={setRrule}
      color={color}
      setColor={setColor}
      attendeeIds={attendeeIds}
      toggleAttendee={toggleAttendee}
      reminderMinutes={reminderMinutes}
      toggleReminder={toggleReminder}
      submitLabel="Create Event"
      isPending={createEvent.isPending}
      onSubmit={handleSubmit}
    />
  );
}

// ── Edit Form ─────────────────────────────────────────────────────────────────

function EditEventForm({
  event,
  onClose,
  onCancel,
  dateRange,
}: {
  event: EventDetail;
  onClose: () => void;
  onCancel: () => void;
  dateRange: { start: string; end: string };
}) {
  const utils = trpc.useUtils();

  const existingStart = toDatetimeLocal(event.startAt);
  const existingEnd = event.endAt ? toDatetimeLocal(event.endAt) : existingStart;

  const [title, setTitle] = useState(event.title);
  const [startDate, setStartDate] = useState(existingStart.slice(0, 10));
  const [startTime, setStartTime] = useState(existingStart.slice(11, 16));
  const [endDate, setEndDate] = useState(existingEnd.slice(0, 10));
  const [endTime, setEndTime] = useState(existingEnd.slice(11, 16));
  const [userSetEnd, setUserSetEnd] = useState(true); // editing = user already set the end
  const [allDay, setAllDay] = useState(event.allDay);
  const [category, setCategory] = useState<EventCategory>(
    (event.category as EventCategory) ?? "other",
  );
  const [description, setDescription] = useState(event.description ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [rrule, setRrule] = useState(event.rrule ?? "");
  const [color, setColor] = useState((event as Record<string, unknown>).color as string ?? "");
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    event.attendees?.map((a) => a.userId).filter((id): id is string => id !== null) ?? [],
  );
  const [reminderMinutes, setReminderMinutes] = useState<number[]>(
    ((event as Record<string, unknown>).reminderMinutes as number[]) ?? [],
  );
  const [showRecurrenceEdit, setShowRecurrenceEdit] = useState(false);

  const updateEvent = trpc.calendar.update.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate({ startDate: dateRange.start, endDate: dateRange.end });
      utils.calendar.getById.invalidate({ id: event.id });
      toast.success("Event updated");
      onCancel(); // Switch back to view mode
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update event");
    },
  });

  function toggleAttendee(userId: string) {
    setAttendeeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function toggleReminder(minutes: number) {
    setReminderMinutes((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes],
    );
  }

  function handleStartTimeChange(newTime: string) {
    setStartTime(newTime);
    if (!userSetEnd) {
      const [h, m] = newTime.split(":").map(Number);
      const endH = (h! + 1) % 24;
      setEndTime(`${String(endH).padStart(2, "0")}:${String(m!).padStart(2, "0")}`);
      if (endH < h!) {
        const nextDay = new Date(startDate);
        nextDay.setDate(nextDay.getDate() + 1);
        setEndDate(nextDay.toISOString().slice(0, 10));
      }
    }
  }

  function handleEndTimeChange(newTime: string) {
    setEndTime(newTime);
    setUserSetEnd(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    // If recurring, prompt for mode
    if (event.rrule) {
      setShowRecurrenceEdit(true);
      return;
    }

    // Non-recurring — just save
    doUpdate("all");
  }

  function doUpdate(mode: "this" | "this_and_future" | "all") {
    updateEvent.mutate({
      id: event.id,
      updateMode: mode,
      instanceDate: new Date(event.startAt).toISOString(),
      data: {
        title: title.trim(),
        startAt: toISO(`${startDate}T${startTime}`),
        endAt: allDay ? undefined : toISO(`${endDate}T${endTime}`),
        allDay,
        category,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        rrule: rrule || undefined,
        color: color || undefined,
        attendeeIds,
        reminderMinutes: reminderMinutes.length > 0 ? reminderMinutes : undefined,
      },
    });
  }

  return (
    <>
    <EventFormFields
      title={title}
      setTitle={setTitle}
      startDate={startDate}
      setStartDate={setStartDate}
      startTime={startTime}
      setStartTime={handleStartTimeChange}
      endDate={endDate}
      setEndDate={setEndDate}
      endTime={endTime}
      setEndTime={handleEndTimeChange}
      allDay={allDay}
      setAllDay={setAllDay}
      category={category}
      setCategory={setCategory}
      location={location}
      setLocation={setLocation}
      description={description}
      setDescription={setDescription}
      rrule={rrule}
      setRrule={setRrule}
      color={color}
      setColor={setColor}
      attendeeIds={attendeeIds}
      toggleAttendee={toggleAttendee}
      reminderMinutes={reminderMinutes}
      toggleReminder={toggleReminder}
      submitLabel="Save Changes"
      isPending={updateEvent.isPending}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
    <RecurrenceModePicker
      action="edit"
      open={showRecurrenceEdit}
      onSelect={(mode) => {
        setShowRecurrenceEdit(false);
        doUpdate(mode);
      }}
      onCancel={() => setShowRecurrenceEdit(false)}
    />
    </>
  );
}

// ── External Event View ──────────────────────────────────────────────────────

function ExternalEventView({
  extEvent,
  onClose,
  dateRange,
}: {
  extEvent: ExternalEventData;
  onClose: () => void;
  dateRange: { start: string; end: string };
}) {
  const utils = trpc.useUtils();

  const createOrbytEvent = trpc.calendar.create.useMutation();
  const linkEventMutation = trpc.integrations.linkEvent.useMutation();
  const [isImporting, setIsImporting] = useState(false);

  const start = new Date(extEvent.startAt);
  const end = extEvent.endAt ? new Date(extEvent.endAt) : null;

  const dateStr = extEvent.allDay
    ? start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) +
      " \u00B7 " +
      start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) +
      (end ? " \u2013 " + end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");

  async function handleImportToOrbyt() {
    setIsImporting(true);
    try {
      // 1. Create Orbyt event with external event data
      const newEvent = await createOrbytEvent.mutateAsync({
        title: extEvent.title,
        startAt: extEvent.startAt,
        endAt: extEvent.endAt ?? undefined,
        allDay: extEvent.allDay,
        category: "other",
        description: extEvent.description ?? undefined,
        location: extEvent.location ?? undefined,
        attendeeIds: [],
      });

      // 2. Link the new Orbyt event to the external event
      await linkEventMutation.mutateAsync({
        eventId: newEvent.id,
        externalEventId: extEvent.dbId,
      });

      // 3. Invalidate caches
      utils.calendar.list.invalidate({ startDate: dateRange.start, endDate: dateRange.end });
      utils.integrations.listExternalEvents.invalidate();

      toast.success("Event imported and linked to Orbyt");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import event";
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Source badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-muted">
          <ExternalLink size={12} aria-hidden="true" />
          {providerLabel(extEvent.provider)}
        </span>
        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-500">
          External Event
        </span>
      </div>

      {/* Event details (read-only) */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="font-display text-xl font-bold text-text">{extEvent.title}</h3>
        <p className="mt-1 text-sm text-text-muted">{dateStr}</p>
        {extEvent.location && (
          <p className="mt-2 flex items-center gap-1 text-sm text-text-muted">
            <span aria-hidden="true" className="text-base">&#x1F4CD;</span> {extEvent.location}
          </p>
        )}
        {extEvent.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-text">{extEvent.description}</p>
        )}
      </div>

      {/* Import to Orbyt action */}
      <button
        type="button"
        onClick={handleImportToOrbyt}
        disabled={isImporting}
        className="orbyt-button-accent flex items-center justify-center gap-2"
      >
        {isImporting ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <Upload size={16} aria-hidden="true" />
        )}
        {isImporting ? "Importing..." : "Import to Orbyt"}
      </button>

      <p className="text-center text-xs text-text-muted">
        This will create an Orbyt event with the same details and link it to the external event for bidirectional sync.
      </p>
    </div>
  );
}

// ── View Event ────────────────────────────────────────────────────────────────

function ViewEvent({
  event,
  onClose,
  onEdit,
  dateRange,
}: {
  event: EventDetail;
  onClose: () => void;
  onEdit: () => void;
  dateRange: { start: string; end: string };
}) {
  const utils = trpc.useUtils();
  const [showDelete, setShowDelete] = useState(false);
  const [showRecurrenceDelete, setShowRecurrenceDelete] = useState(false);

  // Get current user ID for RSVP
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Connected accounts for Push to Calendar feature
  const { data: connectedAccounts } = trpc.integrations.listConnectedAccounts.useQuery();

  // Find write-capable accounts
  const writeAccounts = useMemo(() => {
    if (!connectedAccounts) return [];
    return connectedAccounts.filter((a) => hasWriteScopes(a.provider, a.scopes ?? null));
  }, [connectedAccounts]);

  // Check if this event is linked to an external event
  const externalEventId = (event as Record<string, unknown>).externalEventId as string | null;
  const externalProvider = (event as Record<string, unknown>).externalProvider as string | null;
  const eventConnectedAccountId = (event as Record<string, unknown>).connectedAccountId as string | null;
  const isLinked = !!externalEventId;

  // Determine linked provider label
  const linkedProviderLabel = useMemo(() => {
    if (!isLinked || !eventConnectedAccountId || !connectedAccounts) return null;
    const acct = connectedAccounts.find((a) => a.id === eventConnectedAccountId);
    return acct ? providerLabel(acct.provider) : (externalProvider ? providerLabel(externalProvider) : "External Calendar");
  }, [isLinked, eventConnectedAccountId, connectedAccounts, externalProvider]);

  // Dropdown state for Push to Calendar account selection
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const accountPickerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!showAccountPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (accountPickerRef.current && !accountPickerRef.current.contains(e.target as Node)) {
        setShowAccountPicker(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowAccountPicker(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAccountPicker]);

  const writeBackMutation = trpc.integrations.writeBackEvent.useMutation({
    onSuccess: () => {
      utils.calendar.getById.invalidate({ id: event.id });
      utils.calendar.list.invalidate({ startDate: dateRange.start, endDate: dateRange.end });
      setShowAccountPicker(false);
      toast.success("Event pushed to external calendar");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to push event to calendar");
    },
  });

  const deleteEvent = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate({ startDate: dateRange.start, endDate: dateRange.end });
      toast.success("Event deleted");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to delete event");
    },
  });

  const updateRsvp = trpc.calendar.updateRsvp.useMutation({
    onSuccess: () => {
      utils.calendar.getById.invalidate({ id: event.id });
      utils.calendar.list.invalidate({ startDate: dateRange.start, endDate: dateRange.end });
      toast.success("RSVP updated");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update RSVP");
    },
  });

  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;

  const dateStr = event.allDay
    ? start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) +
      " \u00B7 " +
      start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) +
      (end ? " \u2013 " + end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");

  // Check if current user is an attendee
  const myAttendee = event.attendees?.find((a) => a.userId === userId);

  function handlePushToCalendar(accountId?: string) {
    if (writeAccounts.length === 0) return;
    if (writeAccounts.length === 1 || accountId) {
      // Single account or explicit account selected from dropdown
      writeBackMutation.mutate({
        eventId: event.id,
        accountId: accountId ?? writeAccounts[0]!.id,
      });
    } else {
      // Multiple accounts — show picker
      setShowAccountPicker(true);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Sync badge for linked events */}
      {isLinked && linkedProviderLabel && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-500">
            <Link2 size={12} aria-hidden="true" />
            Synced with {linkedProviderLabel}
          </span>
        </div>
      )}

      {/* Info */}
      <div className="glass-card rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{
              backgroundColor:
                (event as Record<string, unknown>).color as string ??
                getCategoryColor(event.category ?? "other"),
            }}
          />
          <span className="text-xs capitalize text-text-muted">{event.category ?? "other"}</span>
          {event.rrule && (
            <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-500">
              Recurring
            </span>
          )}
        </div>
        <h3 className="font-display text-xl font-bold text-text">{event.title}</h3>
        <p className="mt-1 text-sm text-text-muted">{dateStr}</p>
        {event.location && (
          <p className="mt-2 flex items-center gap-1 text-sm text-text-muted">
            <span aria-hidden="true" className="text-base">&#x1F4CD;</span> {event.location}
          </p>
        )}
        {event.description && (
          <p className="mt-3 text-sm text-text">{event.description}</p>
        )}
        {/* Reminder info */}
        {((event as Record<string, unknown>).reminderMinutes as number[] | undefined)?.length ? (
          <p className="mt-3 text-sm text-text-muted">
            Reminder: {((event as Record<string, unknown>).reminderMinutes as number[]).map(formatReminderMinutes).join(", ")}
          </p>
        ) : null}
      </div>

      {/* Attendees with RSVP status */}
      {event.attendees && event.attendees.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Attendees
          </p>
          <div className="flex flex-wrap gap-2">
            {event.attendees.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                  {(a.profile?.displayName ?? "?").charAt(0).toUpperCase()}
                </div>
                <span className="text-text">{a.profile?.displayName ?? "Unknown"}</span>
                <span
                  className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    a.rsvpStatus === "accepted"
                      ? "bg-green-500/15 text-green-500"
                      : a.rsvpStatus === "declined"
                        ? "bg-red-500/15 text-red-500"
                        : "bg-amber-500/15 text-amber-500",
                  ].join(" ")}
                >
                  {a.rsvpStatus ?? "pending"}
                </span>
              </div>
            ))}
          </div>

          {/* RSVP buttons for current user */}
          {myAttendee && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-text-muted">Your RSVP:</span>
              <button
                onClick={() =>
                  updateRsvp.mutate({ eventId: event.id, status: "accepted" })
                }
                disabled={updateRsvp.isPending}
                className={[
                  "flex min-h-[44px] items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  myAttendee.rsvpStatus === "accepted"
                    ? "bg-green-500/20 text-green-500 ring-1 ring-green-500/40"
                    : "bg-surface text-text-muted hover:bg-green-500/10 hover:text-green-500",
                ].join(" ")}
              >
                <Check className="h-3 w-3" />
                Accept
              </button>
              <button
                onClick={() =>
                  updateRsvp.mutate({ eventId: event.id, status: "declined" })
                }
                disabled={updateRsvp.isPending}
                className={[
                  "flex min-h-[44px] items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  myAttendee.rsvpStatus === "declined"
                    ? "bg-red-500/20 text-red-500 ring-1 ring-red-500/40"
                    : "bg-surface text-text-muted hover:bg-red-500/10 hover:text-red-500",
                ].join(" ")}
              >
                <X className="h-3 w-3" />
                Decline
              </button>
            </div>
          )}
        </div>
      )}

      {/* Push to Calendar button — only shown when:
          - Event is NOT linked to an external event
          - User has at least one write-capable connected account */}
      {!isLinked && writeAccounts.length > 0 && (
        <div className="relative" ref={accountPickerRef}>
          <button
            type="button"
            onClick={() => handlePushToCalendar()}
            disabled={writeBackMutation.isPending}
            aria-haspopup="true"
            aria-expanded={showAccountPicker}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            {writeBackMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <ExternalLink size={16} aria-hidden="true" />
            )}
            {writeBackMutation.isPending ? "Pushing..." : "Push to Calendar"}
            {writeAccounts.length > 1 && !writeBackMutation.isPending && (
              <ChevronDown size={14} aria-hidden="true" className="ml-1" />
            )}
          </button>

          {/* Account picker dropdown for multiple write accounts */}
          {showAccountPicker && writeAccounts.length > 1 && (
            <div role="menu" className="absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded-xl border border-border bg-bg/95 shadow-xl backdrop-blur-sm">
              <p className="px-3 py-2 text-xs font-medium text-text-muted">Select calendar</p>
              {writeAccounts.map((acct) => (
                <button
                  key={acct.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handlePushToCalendar(acct.id)}
                  disabled={writeBackMutation.isPending}
                  className="flex w-full min-h-[44px] items-center gap-2 px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface disabled:opacity-50"
                >
                  <ExternalLink size={14} aria-hidden="true" className="shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{providerLabel(acct.provider)}</p>
                    <p className="truncate text-xs text-text-muted">{acct.email ?? "Unknown"}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Indicator when no write accounts exist but connected accounts do */}
      {!isLinked && writeAccounts.length === 0 && connectedAccounts && connectedAccounts.length > 0 && (
        <p className="text-center text-xs text-text-muted">
          Upgrade your calendar permissions in Settings to push events externally.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onEdit}
          className="orbyt-button-ghost flex flex-1 items-center justify-center gap-2"
        >
          <Pencil className="h-4 w-4" />
          Edit Event
        </button>
        <button
          onClick={() => event.rrule ? setShowRecurrenceDelete(true) : setShowDelete(true)}
          className="orbyt-button-ghost flex items-center gap-2 text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Delete this event?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteEvent.mutate({ id: event.id })}
        onCancel={() => setShowDelete(false)}
      />

      <RecurrenceModePicker
        action="delete"
        open={showRecurrenceDelete}
        onSelect={(mode) => {
          setShowRecurrenceDelete(false);
          deleteEvent.mutate({
            id: event.id,
            deleteMode: mode,
            instanceDate: new Date(event.startAt).toISOString(),
          });
        }}
        onCancel={() => setShowRecurrenceDelete(false)}
      />
    </div>
  );
}

// ── EventDrawer (main export) ─────────────────────────────────────────────────

interface EventDrawerProps {
  eventId: string | null;
  defaultDate: string | null;
  defaultTitle?: string | null;
  open: boolean;
  onClose: () => void;
  dateRange: { start: string; end: string };
  externalEventData?: ExternalEventData | null;
}

export function EventDrawer({ eventId, defaultDate, defaultTitle, open, onClose, dateRange, externalEventData }: EventDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { data: event, isLoading } = trpc.calendar.getById.useQuery(
    { id: eventId! },
    { enabled: !!eventId },
  );

  // Reset editing state when drawer closes or event changes
  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  // Determine title
  const title = externalEventData
    ? externalEventData.title
    : eventId
      ? isEditing
        ? "Edit Event"
        : (event?.title ?? "Event Details")
      : "New Event";

  return (
    <Drawer open={open} onClose={handleClose} title={title}>
      {/* External event view mode */}
      {externalEventData ? (
        <ExternalEventView
          extEvent={externalEventData}
          onClose={handleClose}
          dateRange={dateRange}
        />
      ) : eventId ? (
        isLoading ? (
          <div className="flex flex-col gap-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : event ? (
          isEditing ? (
            <EditEventForm
              event={event}
              onClose={handleClose}
              onCancel={() => setIsEditing(false)}
              dateRange={dateRange}
            />
          ) : (
            <ViewEvent
              event={event}
              onClose={handleClose}
              onEdit={() => setIsEditing(true)}
              dateRange={dateRange}
            />
          )
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">Event not found.</p>
        )
      ) : defaultDate ? (
        <CreateEventForm defaultDate={defaultDate} defaultTitle={defaultTitle ?? undefined} onClose={handleClose} dateRange={dateRange} />
      ) : null}
    </Drawer>
  );
}
