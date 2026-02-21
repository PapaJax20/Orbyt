"use client";

import { useState, useRef } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/ui/empty-state";
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
}: {
  list: ShoppingList;
  isSelected: boolean;
  onClick: () => void;
}) {
  const unchecked = list.itemCount - list.checkedCount;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        "glass-card w-full rounded-2xl p-4 text-left transition-all hover:shadow-lg",
        isSelected && "glass-card-active ring-2 ring-accent/50",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Emoji */}
        <span className="text-2xl leading-none" aria-hidden="true">
          {list.emoji}
        </span>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-text">{list.name}</p>
            {/* Item count badge */}
            <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs text-text-secondary">
              {list.itemCount}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">
            {unchecked === 0
              ? "All done!"
              : `${unchecked} unchecked`}
          </p>
        </div>
      </div>
    </motion.button>
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
}

export function ListPanel({ selectedListId, onSelectList }: ListPanelProps) {
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: lists, isLoading } = trpc.shopping.listLists.useQuery();

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-bold text-text">Shopping Lists</h1>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          aria-label="New list"
          className="orbyt-button-accent flex items-center gap-1.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          New List
        </button>
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
          title="No shopping lists yet"
          description="Create your first list to start tracking groceries"
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
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
