"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";

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
  attendeeIds,
  toggleAttendee,
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
  attendeeIds: string[];
  toggleAttendee: (userId: string) => void;
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
  onClose,
  dateRange,
}: {
  defaultDate: string;
  onClose: () => void;
  dateRange: { start: string; end: string };
}) {
  const utils = trpc.useUtils();

  const defaultStart = defaultDate.includes("T")
    ? defaultDate
    : `${defaultDate}T09:00`;

  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(`${defaultDate.slice(0, 10)}T10:00`);
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState<EventCategory>("family");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [rrule, setRrule] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);

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
      attendeeIds,
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
      attendeeIds={attendeeIds}
      toggleAttendee={toggleAttendee}
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
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    event.attendees?.map((a) => a.userId).filter((id): id is string => id !== null) ?? [],
  );

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    updateEvent.mutate({
      id: event.id,
      updateMode: "all",
      data: {
        title: title.trim(),
        startAt: toISO(startAt),
        endAt: allDay ? undefined : toISO(endAt),
        allDay,
        category,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        rrule: rrule || undefined,
        attendeeIds,
      },
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
      attendeeIds={attendeeIds}
      toggleAttendee={toggleAttendee}
      submitLabel="Save Changes"
      isPending={updateEvent.isPending}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
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

  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;

  const dateStr = event.allDay
    ? start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) +
      " · " +
      start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) +
      (end ? " – " + end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Info */}
      <div className="glass-card rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: getCategoryColor(event.category ?? "other") }}
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
      </div>

      {/* Attendees */}
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
              </div>
            ))}
          </div>
        </div>
      )}

      {event.rrule && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
          Changes will apply to all occurrences of this recurring event.
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
          onClick={() => setShowDelete(true)}
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
    </div>
  );
}

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    family: "#06B6D4",
    work: "#3B82F6",
    health: "#10B981",
    school: "#8B5CF6",
    social: "#F59E0B",
    other: "#6B7280",
  };
  return map[category] ?? "#6B7280";
}

// ── EventDrawer (main export) ─────────────────────────────────────────────────

interface EventDrawerProps {
  eventId: string | null;
  defaultDate: string | null;
  open: boolean;
  onClose: () => void;
  dateRange: { start: string; end: string };
}

export function EventDrawer({ eventId, defaultDate, open, onClose, dateRange }: EventDrawerProps) {
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
        <CreateEventForm defaultDate={defaultDate} onClose={handleClose} dateRange={dateRange} />
      ) : null}
    </Drawer>
  );
}
