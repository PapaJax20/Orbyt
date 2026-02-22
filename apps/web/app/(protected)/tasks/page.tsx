import type { Metadata } from "next";
import { TasksContent } from "@/components/tasks/tasks-content";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-6">
      <TasksContent />
    </div>
  );
}
