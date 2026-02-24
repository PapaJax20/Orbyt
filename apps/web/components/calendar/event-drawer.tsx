"use client";

import { useState, useEffect } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";
import { getCategoryColor } from "@/lib/calendar-colors";

type RouterOutput = inferRouterOutputs<AppRouter>;
type EventDetail = RouterOutput["calendar"]["getById"];

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "family",
  "work",
  "medical",
  "school",
  "social",
  "sports",
  "holiday",
  "birthday",
  "other",
] as const;
type EventCategory = (typeof CATEGORIES)[number];

const RECURRENCE_OPTIONS = [
  { label: "Does not repeat", value: "" },
  { label: "Daily", value: "FREQ=DAILY" },
  { label: "Weekly", value: "FREQ=WEEKLY" },
  { label: "Monthly", value: "FREQ=MONTHLY" },
  { label: "Yearly", value: "FREQ=YEARLY" },
];

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
                "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
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
  startAt,
  setStartAt,
  endAt,
  setEndAt,
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
  startAt: string;
  setStartAt: (v: string) => void;
  endAt: string;
  setEndAt: (v: string) => void;
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
        <span className="text-sm font-medium text-text">All day</span>
        <button
          type="button"
          role="switch"
          aria-checked={allDay}
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
            <label className="orbyt-label" htmlFor="event-start">Start</label>
            <input
              id="event-start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="orbyt-input mt-1 w-full"
            />
          </div>
          <div>
            <label className="orbyt-label" htmlFor="event-end">End</label>
            <input
              id="event-end"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="orbyt-input mt-1 w-full"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="orbyt-label" htmlFor="event-date">Date</label>
          <input
            id="event-date"
            type="date"
            value={startAt.slice(0, 10)}
            onChange={(e) => {
              setStartAt(`${e.target.value}T00:00`);
              setEndAt(`${e.target.value}T00:00`);
            }}
            className="orbyt-input mt-1 w-full"
          />
        </div>
      )}

      {/* Category */}
      <div>
        <label className="orbyt-label" htmlFor="event-category">Category</label>
        <select
          id="event-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as EventCategory)}
          className="orbyt-input mt-1 w-full capitalize"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
        </select>
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
        <label className="orbyt-label" htmlFor="event-recurrence">Recurrence</label>
        <select
          id="event-recurrence"
          value={rrule}
          onChange={(e) => setRrule(e.target.value)}
          className="orbyt-input mt-1 w-full"
        >
          {RECURRENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
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
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
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

  const defaultStart = defaultDate.includes("T")
    ? defaultDate
    : `${defaultDate}T09:00`;

  const [title, setTitle] = useState(defaultTitle ?? "");
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(`${defaultDate.slice(0, 10)}T10:00`);
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState<EventCategory>("family");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [rrule, setRrule] = useState("");
  const [color, setColor] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState<number[]>([]);

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
      startAt: toISO(startAt),
      endAt: allDay ? undefined : toISO(endAt),
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
      startAt={startAt}
      setStartAt={setStartAt}
      endAt={endAt}
      setEndAt={setEndAt}
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

  const [title, setTitle] = useState(event.title);
  const [startAt, setStartAt] = useState(toDatetimeLocal(event.startAt));
  const [endAt, setEndAt] = useState(
    event.endAt ? toDatetimeLocal(event.endAt) : toDatetimeLocal(event.startAt),
  );
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
        startAt: toISO(startAt),
        endAt: allDay ? undefined : toISO(endAt),
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
      startAt={startAt}
      setStartAt={setStartAt}
      endAt={endAt}
      setEndAt={setEndAt}
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
      " · " +
      start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) +
      (end ? " – " + end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");

  // Check if current user is an attendee
  const myAttendee = event.attendees?.find((a) => a.userId === userId);

  return (
    <div className="flex flex-col gap-5 pb-6">
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
            📍 {event.location}
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
                  "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
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
                  "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
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
}

export function EventDrawer({ eventId, defaultDate, defaultTitle, open, onClose, dateRange }: EventDrawerProps) {
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

  const title = eventId
    ? isEditing
      ? "Edit Event"
      : (event?.title ?? "Event Details")
    : "New Event";

  return (
    <Drawer open={open} onClose={handleClose} title={title}>
      {eventId ? (
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
