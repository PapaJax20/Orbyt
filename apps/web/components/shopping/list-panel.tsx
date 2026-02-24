"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ShoppingList } from "./shopping-content";

// ── Helpers ────────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ── ListCard ──────────────────────────────────────────────────────────────────

function ListCard({
  list,
  isSelected,
  onClick,
  editingListId,
  onStartEditing,
  onFinishEditing,
  onDelete,
}: {
  list: ShoppingList;
  isSelected: boolean;
  onClick: () => void;
  editingListId: string | null;
  onStartEditing: (id: string) => void;
  onFinishEditing: () => void;
  onDelete: (id: string) => void;
}) {
  const utils = trpc.useUtils();
  const unchecked = list.itemCount - list.checkedCount;
  const isEditing = editingListId === list.id;
  const [editName, setEditName] = useState(list.name);
  const [showMenu, setShowMenu] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateList = trpc.shopping.updateList.useMutation({
    onSuccess: () => {
      utils.shopping.listLists.invalidate();
      toast.success("List renamed");
      onFinishEditing();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to rename list");
    },
  });

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) {
      setEditName(list.name);
      // Small delay to let the input render
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [isEditing, list.name]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  function handleRenameSubmit() {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === list.name) {
      onFinishEditing();
      return;
    }
    updateList.mutate({ listId: list.id, name: trimmed });
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      onFinishEditing();
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "glass-card relative w-full rounded-2xl p-4 text-left transition-all hover:shadow-lg",
        isSelected && "glass-card-active ring-2 ring-accent/50",
      )}
    >
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 text-left"
        aria-label={`Select ${list.name}`}
      >
        {/* Emoji */}
        <span className="text-2xl leading-none" aria-hidden="true">
          {list.emoji}
        </span>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleEditKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="orbyt-input w-full text-sm font-semibold"
              maxLength={100}
              aria-label="Rename list"
            />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-text">{list.name}</p>
                {/* Item count badge */}
                <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted">
                  {list.itemCount}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-text-muted">
                {unchecked === 0
                  ? "All done!"
                  : `${unchecked} unchecked`}
              </p>
            </>
          )}
        </div>
      </button>

      {/* Options menu trigger */}
      {!isEditing && (
        <div className="absolute right-3 top-3" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
            aria-label="List options"
            aria-expanded={showMenu}
            aria-haspopup="menu"
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {/* Dropdown menu */}
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.12 }}
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onStartEditing(list.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete(list.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-surface"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ── NewListForm ────────────────────────────────────────────────────────────────

function NewListForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🛒");
  const inputRef = useRef<HTMLInputElement>(null);

  const createList = trpc.shopping.createList.useMutation({
    onSuccess: () => {
      utils.shopping.listLists.invalidate();
      toast.success("Shopping list created");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create list");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createList.mutate({ name: trimmed, emoji: emoji || "🛒" });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onCancel();
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      onSubmit={handleSubmit}
      className="glass-card rounded-2xl p-4"
    >
      <div className="flex items-center gap-2">
        {/* Emoji input */}
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className="orbyt-input w-14 shrink-0 text-center text-xl"
          maxLength={10}
          aria-label="List emoji"
        />
        {/* Name input */}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="orbyt-input flex-1"
          placeholder="List name"
          maxLength={100}
          autoFocus
          required
          aria-label="List name"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={createList.isPending || !name.trim()}
          className="orbyt-button-accent flex-1 text-sm"
        >
          {createList.isPending ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="orbyt-button-ghost text-sm"
        >
          Cancel
        </button>
      </div>
    </motion.form>
  );
}

// ── ListPanel ─────────────────────────────────────────────────────────────────

interface ListPanelProps {
  selectedListId: string | null;
  onSelectList: (id: string) => void;
  autoCreate?: boolean;
}

export function ListPanel({ selectedListId, onSelectList, autoCreate = false }: ListPanelProps) {
  const utils = trpc.useUtils();
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);

  // Auto-open the new list form when navigated from the dashboard empty-state CTA
  useEffect(() => {
    if (autoCreate) {
      setShowNewForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: lists, isLoading } = trpc.shopping.listLists.useQuery();

  const deleteList = trpc.shopping.deleteList.useMutation({
    onSuccess: () => {
      utils.shopping.listLists.invalidate();
      toast.success("Shopping list deleted");
      setDeletingListId(null);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to delete list");
      setDeletingListId(null);
    },
  });

  const deletingList = lists?.find((l) => l.id === deletingListId);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-bold text-text">Shopping Lists</h1>
        {lists && lists.length > 0 && (
          <button
            onClick={() => setShowNewForm((v) => !v)}
            aria-label="New list"
            className="orbyt-button-accent flex items-center gap-1.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            New List
          </button>
        )}
      </div>

      {/* Inline new-list form */}
      <AnimatePresence>
        {showNewForm && (
          <NewListForm
            onSuccess={() => setShowNewForm(false)}
            onCancel={() => setShowNewForm(false)}
          />
        )}
      </AnimatePresence>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && lists && lists.length === 0 && !showNewForm && (
        <EmptyState
          character="rosie"
          expression="happy"
          title="No shopping lists yet."
          description="Create a list and I'll make sure nothing gets forgotten."
          actionLabel="Create List"
          onAction={() => setShowNewForm(true)}
        />
      )}

      {/* List cards */}
      {!isLoading && lists && lists.length > 0 && (
        <div className="flex flex-col gap-3 overflow-y-auto">
          <AnimatePresence initial={false}>
            {lists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                isSelected={list.id === selectedListId}
                onClick={() => onSelectList(list.id)}
                editingListId={editingListId}
                onStartEditing={setEditingListId}
                onFinishEditing={() => setEditingListId(null)}
                onDelete={setDeletingListId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deletingListId}
        onConfirm={() => {
          if (deletingListId) deleteList.mutate({ listId: deletingListId });
        }}
        onCancel={() => setDeletingListId(null)}
        title="Delete shopping list?"
        description={`"${deletingList?.name ?? "This list"}" and all its items will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
