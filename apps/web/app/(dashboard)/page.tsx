import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-text">
          Good morning ✨
        </h1>
        <p className="mt-1 text-text-muted">
          Here&apos;s what&apos;s happening in your household today.
        </p>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Tasks Due Today", value: "—", accent: "teal" },
          { label: "Bills Due This Week", value: "—", accent: "gold" },
          { label: "Upcoming Birthdays", value: "—", accent: "violet" },
          { label: "Shopping Items", value: "—", accent: "teal" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-accent">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main widgets grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming Events */}
        <div className="glass-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-text">
            Upcoming Events
          </h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-4xl">📅</p>
            <p className="mt-3 text-sm text-text-muted">No upcoming events</p>
            <button className="orbyt-button-accent mt-4 w-auto px-6">
              Add Event
            </button>
          </div>
        </div>

        {/* Financial Snapshot */}
        <div className="glass-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-text">
            Financial Snapshot
          </h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-4xl">💰</p>
            <p className="mt-3 text-sm text-text-muted">No bills tracked yet</p>
            <button className="orbyt-button-accent mt-4 w-auto px-6">
              Add Bill
            </button>
          </div>
        </div>

        {/* Tasks Summary */}
        <div className="glass-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-text">
            Tasks
          </h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-4xl">✅</p>
            <p className="mt-3 text-sm text-text-muted">Your task list is empty</p>
            <button className="orbyt-button-accent mt-4 w-auto px-6">
              Add Task
            </button>
          </div>
        </div>

        {/* Shopping Lists */}
        <div className="glass-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-text">
            Shopping Lists
          </h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-4xl">🛒</p>
            <p className="mt-3 text-sm text-text-muted">No shopping lists yet</p>
            <button className="orbyt-button-accent mt-4 w-auto px-6">
              Create List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
