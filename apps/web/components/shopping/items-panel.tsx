"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Trash2, X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/ui/empty-state";
import { useRealtimeInvalidation } from "@/hooks/use-realtime";
import type { ShoppingItem } from "./shopping-content";

// ── Helpers ────────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Produce",
  "Dairy",
  "Meat",
  "Bakery",
  "Pantry",
  "Frozen",
  "Beverages",
  "Household",
  "Personal Care",
  "Other",
] as const;

// ── Avatar ────────────────────────────────────────────────────────────────────

function InitialAvatar({ id, name }: { id: string; name: string }) {
  const color = `hsl(${(id.charCodeAt(0) * 47) % 360}, 65%, 55%)`;
  return (
    <div
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ backgroundColor: color }}
      title={name}
      aria-label={name}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── ItemRow ───────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  listId,
  getMemberName,
}: {
  item: ShoppingItem;
  listId: string;
  getMemberName: (userId: string) => string;
}) {
  const utils = trpc.useUtils();

  const checkItem = trpc.shopping.checkItem.useMutation({
    onSuccess: () => {
      utils.shopping.listItems.invalidate({ listId });
      utils.shopping.listLists.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update item");
    },
  });

  const deleteItem = trpc.shopping.deleteItem.useMutation({
    onSuccess: () => {
      utils.shopping.listItems.invalidate({ listId });
      utils.shopping.listLists.invalidate();
      toast.success("Item removed");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to delete item");
    },
  });

  function handleCheck() {
    checkItem.mutate({ itemId: item.id, checked: !item.checked });
  }

  function handleDelete() {
    deleteItem.mutate({ itemId: item.id });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface/50"
    >
      {/* Checkbox */}
      <button
        onClick={handleCheck}
        disabled={checkItem.isPending}
        aria-label={item.checked ? "Uncheck item" : "Check item"}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          item.checked
            ? "border-accent bg-accent"
            : "border-border bg-transparent hover:border-accent/60",
        )}
      >
        {item.checked && (
          <svg
            className="h-3 w-3 text-white"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Name */}
      <span
        className={cn(
          "flex-1 text-sm",
          item.checked
            ? "text-text-secondary line-through opacity-60"
            : "text-text",
        )}
      >
        {item.name}
        {item.checked && item.checkedBy && (
          <span className="ml-2 text-xs text-text-secondary no-underline" style={{ textDecoration: "none" }}>
            · checked
          </span>
        )}
      </span>

      {/* Quantity badge */}
      {item.quantity && (
        <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-text-secondary">
          {item.quantity}
        </span>
      )}

      {/* Added-by avatar */}
      <InitialAvatar id={item.addedBy} name={getMemberName(item.addedBy)} />

      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleteItem.isPending}
        aria-label="Delete item"
        className="rounded-md p-1 text-text-secondary opacity-100 transition-opacity hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

// ── CategoryGroup ─────────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  items,
  listId,
  getMemberName,
}: {
  category: string;
  items: ShoppingItem[];
  listId: string;
  getMemberName: (userId: string) => string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-2">
      {/* Category header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-surface/40"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {category}
        </span>
        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-text-secondary">
          {items.length}
        </span>
        <svg
          className={cn(
            "ml-auto h-3.5 w-3.5 text-text-secondary transition-transform",
            collapsed && "-rotate-90",
          )}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Items */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} listId={listId} getMemberName={getMemberName} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── AddItemForm ───────────────────────────────────────────────────────────────

function AddItemForm({ listId }: { listId: string }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addItem = trpc.shopping.addItem.useMutation({
    onSuccess: () => {
      utils.shopping.listItems.invalidate({ listId });
      utils.shopping.listLists.invalidate();
      setName("");
      setQuantity("");
      setCategory("");
      inputRef.current?.focus();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to add item");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addItem.mutate({
      listId,
      name: trimmed,
      quantity: quantity.trim() || undefined,
      category: category || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-auto border-t border-border pt-4"
    >
      <div className="glass-card rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="orbyt-input flex-1 text-sm"
            placeholder="Add an item…"
            maxLength={255}
            aria-label="Item name"
          />
        </div>

        <AnimatePresence>
          {name.trim().length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-2 flex gap-2 overflow-hidden"
            >
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="orbyt-input w-24 shrink-0 text-sm"
                placeholder="Qty"
                maxLength={50}
                aria-label="Quantity"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="orbyt-input flex-1 text-sm"
                aria-label="Category"
              >
                <option value="">Category…</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={addItem.isPending || !name.trim()}
                className="orbyt-button-accent shrink-0 text-sm"
              >
                {addItem.isPending ? "Adding…" : "Add"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}

// ── ItemsPanel ────────────────────────────────────────────────────────────────

interface ItemsPanelProps {
  selectedListId: string | null;
  onBack: () => void;
}

export function ItemsPanel({ selectedListId, onBack }: ItemsPanelProps) {
  const utils = trpc.useUtils();

  // Fetch household members to resolve user UUIDs to display names
  const { data: household } = trpc.household.getCurrent.useQuery();
  const getMemberName = (userId: string) =>
    household?.members.find((m) => m.userId === userId)?.profile?.displayName ?? "Unknown";

  // Real-time subscription
  useRealtimeInvalidation(
    "shopping_items",
    selectedListId ? { column: "list_id", value: selectedListId } : undefined,
    () => utils.shopping.listItems.invalidate({ listId: selectedListId! }),
  );

  const { data: lists } = trpc.shopping.listLists.useQuery();
  const selectedList = lists?.find((l) => l.id === selectedListId);

  const { data: items, isLoading } = trpc.shopping.listItems.useQuery(
    { listId: selectedListId! },
    { enabled: !!selectedListId },
  );

  const clearChecked = trpc.shopping.clearChecked.useMutation({
    onSuccess: () => {
      utils.shopping.listItems.invalidate({ listId: selectedListId! });
      utils.shopping.listLists.invalidate();
      toast.success("Checked items cleared");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to clear items");
    },
  });

  // No list selected
  if (!selectedListId) {
    return (
      <div className="glass-card flex h-full min-h-[400px] items-center justify-center rounded-2xl">
        <EmptyState
          character="eddie"
          expression="thinking"
          title="Select a list"
          description="Choose a shopping list on the left to see its items"
        />
      </div>
    );
  }

  // Group items by category
  const grouped: Record<string, ShoppingItem[]> = {};
  if (items) {
    for (const item of items) {
      const cat = item.category ?? "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat]!.push(item);
    }
  }
  const categoryKeys = Object.keys(grouped).sort();

  const hasChecked = items?.some((i) => i.checked) ?? false;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {/* Mobile back button */}
        <button
          onClick={onBack}
          aria-label="Back to lists"
          className="orbyt-button-ghost flex items-center gap-1.5 text-sm md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {selectedList && (
            <span className="text-2xl leading-none" aria-hidden="true">
              {selectedList.emoji}
            </span>
          )}
          <h2 className="truncate font-display text-xl font-bold text-text">
            {selectedList?.name ?? "Shopping List"}
          </h2>
        </div>

        {/* Clear checked button */}
        {hasChecked && (
          <button
            onClick={() => clearChecked.mutate({ listId: selectedListId })}
            disabled={clearChecked.isPending}
            aria-label="Clear checked items"
            className="orbyt-button-ghost flex shrink-0 items-center gap-1.5 text-sm text-red-400 hover:bg-red-400/10"
          >
            <Trash2 className="h-4 w-4" />
            Clear Checked
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="glass-card flex flex-1 flex-col overflow-hidden rounded-2xl p-4">
        {/* Loading skeletons */}
        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items && items.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              character="rosie"
              expression="winking"
              title="This list is empty — for now."
              description="Start adding items below."
              actionLabel="Add Item"
              onAction={() => {
                // Focus the add-item input
                const input = document.querySelector<HTMLInputElement>(
                  '[aria-label="Item name"]',
                );
                input?.focus();
              }}
            />
          </div>
        )}

        {/* Items grouped by category */}
        {!isLoading && items && items.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence initial={false}>
              {categoryKeys.map((cat) => (
                <CategoryGroup
                  key={cat}
                  category={cat}
                  items={grouped[cat]!}
                  listId={selectedListId}
                  getMemberName={getMemberName}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Add item form — always visible when a list is selected */}
        {!isLoading && (
          <AddItemForm listId={selectedListId} />
        )}
      </div>
    </div>
  );
}
