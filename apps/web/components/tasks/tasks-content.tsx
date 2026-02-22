"use client";

import { useState } from "react";
import {
  DndContext,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import { LayoutGrid, List, Plus } from "lucide-react";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc/client";
import { TaskDrawer } from "./task-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { formatFriendlyDate } from "@orbyt/shared/utils";

type RouterOutput = inferRouterOutputs<AppRouter>;

// ── Utilities ─────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS = [
  { status: "todo",        label: "To Do",       dot: "bg-text-muted",  header: "text-text-muted"  },
  { status: "in_progress", label: "In Progress",  dot: "bg-accent",      header: "text-accent"      },
  { status: "done",        label: "Done",         dot: "bg-green-400",   header: "text-green-400"   },
] as const;

type ColumnStatus = (typeof COLUMNS)[number]["status"];

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-400",
  high:   "bg-orange-400",
  medium: "bg-yellow-400",
  low:    "bg-white/20",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

const STATUS_LABEL: Record<string, string> = {
  todo:        "To Do",
  in_progress: "In Progress",
  done:        "Done",
};

const VALID_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

// ── Task card data type ────────────────────────────────────────────────────────

type TaskItem = RouterOutput["tasks"]["list"][number];

// ── TaskCard ──────────────────────────────────────────────────────────────────

function TaskCard({ task, onClick }: { task: TaskItem; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const isOverdue =
    task.dueAt &&
    new Date(task.dueAt) < new Date() &&
    task.status !== "done";

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={cn(
        "glass-card group cursor-pointer select-none rounded-lg p-3 transition-shadow hover:shadow-lg hover:shadow-accent/5",
        isDragging && "opacity-40 shadow-2xl ring-2 ring-accent/40",
      )}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      {/* Priority dot + Title */}
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "mt-[5px] h-2 w-2 shrink-0 rounded-full",
            PRIORITY_DOT[task.priority] ?? "bg-white/20",
          )}
        />
        <p className="text-sm font-medium leading-snug text-text line-clamp-2">{task.title}</p>
      </div>

      {/* Bottom row */}
      {(task.assignees.length > 0 || task.dueAt) && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {/* Assignee avatars */}
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              <div
                key={a.userId}
                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ring-1 ring-bg"
                style={{ backgroundColor: a.profile.id ? `hsl(${(a.profile.id.charCodeAt(0) * 47) % 360}, 65%, 55%)` : "var(--color-accent)" }}
                title={a.profile.displayName}
              >
                {a.profile.displayName.charAt(0).toUpperCase()}
              </div>
            ))}
            {task.assignees.length > 3 && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] text-text-muted ring-1 ring-bg">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>

          {/* Due date */}
          {task.dueAt && (
            <span
              className={cn(
                "shrink-0 text-xs",
                isOverdue ? "font-medium text-red-400" : "text-text-muted",
              )}
            >
              {formatFriendlyDate(new Date(task.dueAt))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  dot,
  header,
  tasks,
  isLoading,
  onTaskClick,
  onAddTask,
}: {
  status: ColumnStatus;
  label: string;
  dot: string;
  header: string;
  tasks: TaskItem[];
  isLoading: boolean;
  onTaskClick: (id: string) => void;
  onAddTask: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[272px] flex-1 flex-col rounded-xl bg-white/[0.04] p-3 transition-colors",
        isOver && "bg-accent/[0.07] ring-2 ring-accent/30",
      )}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2 px-1">
        <div className={cn("h-2 w-2 rounded-full", dot)} />
        <span className={cn("font-display text-sm font-semibold", header)}>{label}</span>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs text-text-muted">
          {isLoading ? "…" : tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2">
        {isLoading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-lg bg-white/5" />
            ))
          : tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
            ))}
      </div>

      {/* Add task button */}
      <button
        onClick={onAddTask}
        className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-white/5 hover:text-text"
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </button>
    </div>
  );
}

// ── ListView ──────────────────────────────────────────────────────────────────

function ListView({
  tasks,
  isLoading,
  onTaskClick,
}: {
  tasks: TaskItem[];
  isLoading: boolean;
  onTaskClick: (id: string) => void;
}) {
  return (
    <div className="glass-card overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[16px_1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted">
        <span />
        <span>Task</span>
        <span className="hidden sm:block">Assignees</span>
        <span>Due</span>
        <span>Status</span>
      </div>

      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/50 px-4 py-3.5"
          >
            <div className="h-2.5 w-2.5 rounded-full bg-white/10 animate-pulse" />
            <div className="h-3 flex-1 rounded bg-white/10 animate-pulse" />
          </div>
        ))
      ) : tasks.length === 0 ? (
        <EmptyState
          character="rosie"
          expression="happy"
          title="All clear! Nothing on the to-do list."
          description="When you add tasks, I'll help keep everyone on track."
        />
      ) : (
        tasks.map((task) => {
          const isOverdue =
            task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "done";

          return (
            <button
              key={task.id}
              onClick={() => onTaskClick(task.id)}
              className="grid w-full grid-cols-[16px_1fr_auto_auto_auto] items-center gap-4 border-b border-border/50 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
            >
              {/* Priority dot */}
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  PRIORITY_DOT[task.priority] ?? "bg-white/20",
                )}
              />

              {/* Title */}
              <span className="truncate text-sm text-text">{task.title}</span>

              {/* Assignees */}
              <div className="hidden -space-x-1.5 sm:flex">
                {task.assignees.slice(0, 3).map((a) => (
                  <div
                    key={a.userId}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ring-1 ring-bg"
                    style={{
                      backgroundColor: `hsl(${(a.profile.id.charCodeAt(0) * 47) % 360}, 65%, 55%)`,
                    }}
                    title={a.profile.displayName}
                  >
                    {a.profile.displayName.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>

              {/* Due date */}
              <span
                className={cn(
                  "shrink-0 text-xs",
                  isOverdue ? "text-red-400" : "text-text-muted",
                )}
              >
                {task.dueAt ? formatFriendlyDate(new Date(task.dueAt)) : "—"}
              </span>

              {/* Status badge */}
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-text-muted">
                {STATUS_LABEL[task.status] ?? task.status}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

// ── TasksContent (main export) ─────────────────────────────────────────────────

export function TasksContent() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<string>("todo");

  const utils = trpc.useUtils();

  // Fetch all non-cancelled tasks in one query
  const { data: allTasks, isLoading } = trpc.tasks.list.useQuery({
    status: ["todo", "in_progress", "done"],
  });

  // Fetch household members for the assignee picker
  const { data: household } = trpc.household.getCurrent.useQuery();

  // Drag-drop: require 5px movement before activating drag (prevents accidental drags)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const newStatus = String(over.id);
    if (!(VALID_STATUSES as readonly string[]).includes(newStatus)) return;
    const task = allTasks?.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    updateStatus.mutate({ id: taskId, status: newStatus as ValidStatus });
  }

  function openCreate(status = "todo") {
    setSelectedTaskId(null);
    setDefaultStatus(status);
    setDrawerOpen(true);
  }

  function openTask(id: string) {
    setSelectedTaskId(id);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    // Small delay so the exit animation plays before clearing selection
    setTimeout(() => setSelectedTaskId(null), 300);
  }

  // Group tasks by status for kanban
  const byStatus: Record<ColumnStatus, TaskItem[]> = {
    todo:        allTasks?.filter((t) => t.status === "todo")        ?? [],
    in_progress: allTasks?.filter((t) => t.status === "in_progress") ?? [],
    done:        allTasks?.filter((t) => t.status === "done")        ?? [],
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-text">Tasks</h1>
          <p className="mt-1 text-text-muted">
            Manage and assign tasks across your household.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex items-center rounded-lg bg-white/5 p-1">
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                view === "kanban"
                  ? "bg-white/10 text-text"
                  : "text-text-muted hover:text-text",
              )}
              title="Kanban view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                view === "list"
                  ? "bg-white/10 text-text"
                  : "text-text-muted hover:text-text",
              )}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* New task button */}
          <button onClick={() => openCreate()} className="orbyt-button-accent flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Board or List */}
      {view === "kanban" ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                dot={col.dot}
                header={col.header}
                tasks={byStatus[col.status]}
                isLoading={isLoading}
                onTaskClick={openTask}
                onAddTask={() => openCreate(col.status)}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <ListView tasks={allTasks ?? []} isLoading={isLoading} onTaskClick={openTask} />
      )}

      {/* Task drawer */}
      <TaskDrawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        taskId={selectedTaskId}
        defaultStatus={defaultStatus}
        members={household?.members ?? []}
        onSuccess={() => {
          utils.tasks.list.invalidate();
          closeDrawer();
        }}
      />
    </motion.div>
  );
}
