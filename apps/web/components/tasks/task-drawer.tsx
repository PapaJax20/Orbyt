"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send } from "lucide-react";
import { toast } from "sonner";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatFriendlyDate } from "@orbyt/shared/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type Member = RouterOutput["household"]["getCurrent"]["members"][number];

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;      // null = create mode
  defaultStatus: string;
  members: Member[];
  onSuccess: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Low",    color: "text-white/40" },
  { value: "medium", label: "Medium", color: "text-yellow-400" },
  { value: "high",   label: "High",   color: "text-orange-400" },
  { value: "urgent", label: "Urgent", color: "text-red-400" },
] as const;

const STATUS_OPTIONS = [
  { value: "todo",        label: "To Do"       },
  { value: "in_progress", label: "In Progress" },
  { value: "done",        label: "Done"        },
  { value: "cancelled",   label: "Cancelled"   },
] as const;

// ── TaskDrawer ─────────────────────────────────────────────────────────────────

export function TaskDrawer({
  isOpen,
  onClose,
  taskId,
  defaultStatus,
  members,
  onSuccess,
}: TaskDrawerProps) {
  const isCreating = taskId === null;
  const utils = trpc.useUtils();

  // ── Queries (only run when viewing) ─────────────────────────────────────────
  const { data: task, isLoading: taskLoading } = trpc.tasks.getById.useQuery(
    { id: taskId! },
    { enabled: !!taskId },
  );
  const { data: comments } = trpc.tasks.listComments.useQuery(
    { taskId: taskId! },
    { enabled: !!taskId },
  );

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Task created");
      onSuccess();
    },
  });
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      toast.success("Task updated");
      onSuccess();
    },
  });
  const addComment = trpc.tasks.addComment.useMutation({
    onSuccess: () => utils.tasks.listComments.invalidate({ taskId: taskId! }),
  });
  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      toast.success("Task deleted");
      utils.tasks.list.invalidate();
      onClose();
    },
  });

  // ── Form state ───────────────────────────────────────────────────────────────
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority]       = useState("medium");
  const [status, setStatus]           = useState(defaultStatus);
  const [dueAt, setDueAt]             = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [newComment, setNewComment]   = useState("");
  const [isEditing, setIsEditing]     = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Populate form when switching tasks or modes
  useEffect(() => {
    if (isCreating) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setStatus(defaultStatus);
      setDueAt("");
      setAssigneeIds([]);
      setIsEditing(false);
    }
  }, [isCreating, defaultStatus]);

  useEffect(() => {
    if (task && !isCreating) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPriority(task.priority);
      setStatus(task.status);
      setDueAt(
        task.dueAt ? new Date(task.dueAt).toISOString().split("T")[0]! : "",
      );
      setAssigneeIds(task.assignees.map((a) => a.userId));
      setIsEditing(false);
    }
  }, [task, isCreating]);

  // Reset editing state when drawer closes
  useEffect(() => {
    if (!isOpen) setIsEditing(false);
  }, [isOpen]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function toggleAssignee(userId: string) {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      title: title.trim(),
      description: description.trim() || null,
      priority: priority as "low" | "medium" | "high" | "urgent",
      status: status as "todo" | "in_progress" | "done" | "cancelled",
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      assigneeIds,
      tags: [] as string[],
    };

    if (isCreating) {
      createTask.mutate(data);
    } else {
      updateTask.mutate({ id: taskId!, data });
    }
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !taskId) return;
    addComment.mutate(
      { taskId, content: newComment.trim() },
      { onSuccess: () => setNewComment("") },
    );
  }

  const isSaving = createTask.isPending || updateTask.isPending;

  // ── Form fields (shared between create and edit) ──────────────────────────
  const FormFields = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
      {/* Title */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="orbyt-input w-full"
          placeholder="What needs to be done?"
          required
          autoFocus
        />
      </div>

      {/* Priority + Status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="orbyt-input w-full"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="orbyt-input w-full"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Due date */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
          Due Date
        </label>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="orbyt-input w-full"
        />
      </div>

      {/* Assignees */}
      {members.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
            Assignees
          </label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const selected = assigneeIds.includes(m.userId);
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => toggleAssignee(m.userId)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                    selected
                      ? "border-accent bg-accent/20 text-accent"
                      : "border-border text-text-muted hover:border-text-muted hover:text-text",
                  )}
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
      )}

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="orbyt-input w-full resize-none"
          placeholder="Add details, notes, or context…"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button type="submit" className="orbyt-button-accent flex-1" disabled={isSaving}>
          {isSaving ? "Saving…" : isCreating ? "Create Task" : "Save Changes"}
        </button>
        {!isCreating && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="orbyt-button-ghost px-3 text-red-400 hover:bg-red-400/10"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );

  // ── View mode (read-only) ─────────────────────────────────────────────────
  const ViewMode = task && (
    <div className="p-6">
      {/* Title */}
      <h3 className="font-display text-xl font-semibold text-text">{task.title}</h3>

      {/* Meta chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-text-muted capitalize">
          {task.priority} priority
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-text-muted">
          {STATUS_OPTIONS.find((s) => s.value === task.status)?.label ?? task.status}
        </span>
        {task.dueAt && (
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              new Date(task.dueAt) < new Date() && task.status !== "done"
                ? "bg-red-400/10 text-red-400"
                : "bg-white/10 text-text-muted",
            )}
          >
            Due {formatFriendlyDate(new Date(task.dueAt))}
          </span>
        )}
      </div>

      {/* Assignees */}
      {task.assignees.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
            Assignees
          </p>
          <div className="flex flex-wrap gap-2">
            {task.assignees.map((a) => (
              <div
                key={a.userId}
                className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm text-text"
              >
                <div
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{
                    backgroundColor: `hsl(${(a.profile.id.charCodeAt(0) * 47) % 360}, 65%, 55%)`,
                  }}
                />
                {a.profile.displayName}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
            Description
          </p>
          <p className="text-sm leading-relaxed text-text">{task.description}</p>
        </div>
      )}

      {/* Edit button */}
      <button
        onClick={() => setIsEditing(true)}
        className="orbyt-button-ghost mt-5 w-full"
      >
        Edit Task
      </button>
    </div>
  );

  // ── Comments section ──────────────────────────────────────────────────────
  const CommentsSection = !isCreating && (
    <div className="border-t border-border">
      <div className="p-6">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-text-muted">
          Comments {comments && comments.length > 0 && `(${comments.length})`}
        </p>

        {/* Comment list */}
        <div className="mb-4 flex flex-col gap-3">
          {!comments || comments.length === 0 ? (
            <p className="text-sm text-text-muted">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: `hsl(${(comment.profile.id.charCodeAt(0) * 47) % 360}, 65%, 55%)`,
                  }}
                >
                  {comment.profile.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-text">
                      {comment.profile.displayName}
                    </span>
                    <span className="text-xs text-text-muted">
                      {formatFriendlyDate(new Date(comment.createdAt), true)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-text">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add comment */}
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment…"
            className="orbyt-input flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || addComment.isPending}
            className="orbyt-button-accent px-3"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Drawer panel */}
            <motion.div
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-border bg-[var(--color-bg)] shadow-2xl"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="font-display text-lg font-semibold text-text">
                  {isCreating ? "New Task" : isEditing ? "Edit Task" : "Task Details"}
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">
                {/* Loading skeleton */}
                {!isCreating && taskLoading && (
                  <div className="flex flex-col gap-3 p-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-8 animate-pulse rounded-lg bg-white/5" />
                    ))}
                  </div>
                )}

                {/* Create or Edit form */}
                {(isCreating || isEditing) && !taskLoading && FormFields}

                {/* View mode */}
                {!isCreating && !isEditing && !taskLoading && ViewMode}

                {/* Comments */}
                {!isCreating && !taskLoading && CommentsSection}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this task?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          setConfirmOpen(false);
          deleteTask.mutate({ id: taskId! });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
