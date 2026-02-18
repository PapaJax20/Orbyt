import type { Metadata } from "next";
export const metadata: Metadata = { title: "Calendar" };
export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-text">Calendar</h1>
        <p className="mt-1 text-text-muted">Shared family schedule — events, reminders, and recurring plans.</p>
      </div>
      <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
        <p className="text-5xl">📅</p>
        <p className="mt-4 font-display text-xl font-semibold text-text">Calendar coming soon</p>
        <p className="mt-2 text-sm text-text-muted">Month, week, and day views with recurring events</p>
      </div>
    </div>
  );
}