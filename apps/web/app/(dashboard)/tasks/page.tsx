import type { Metadata } from "next";
export const metadata: Metadata = { title: "Tasks" };
export default function TasksPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-text">Tasks</h1>
        <p className="mt-1 text-text-muted">Manage and assign tasks across your household.</p>
      </div>
      <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
        <p className="text-5xl">✅</p>
        <p className="mt-4 font-display text-xl font-semibold text-text">Task board coming soon</p>
        <p className="mt-2 text-sm text-text-muted">Kanban board, list view, subtasks, and assignments</p>
      </div>
    </div>
  );
}