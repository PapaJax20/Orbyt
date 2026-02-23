"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ── Types ──────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type BudgetProgress = RouterOutput["finances"]["getBudgetProgress"][number];

type BudgetCategory =
  | "housing"
  | "utilities"
  | "groceries"
  | "dining"
  | "transportation"
  | "healthcare"
  | "insurance"
  | "entertainment"
  | "shopping"
  | "education"
  | "personal"
  | "subscriptions"
  | "savings"
  | "other";

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

// ── Constants ────────────────────────────────────────────────────────────────

const BUDGET_CATEGORIES: BudgetCategory[] = [
  "housing",
  "utilities",
  "groceries",
  "dining",
  "transportation",
  "healthcare",
  "insurance",
  "entertainment",
  "shopping",
  "education",
  "personal",
  "subscriptions",
  "savings",
  "other",
];

// ── BudgetCard ───────────────────────────────────────────────────────────────

function BudgetCard({
  budget,
  onDelete,
}: {
  budget: BudgetProgress;
  onDelete: () => void;
}) {
  const spent = parseFloat(budget.spent);
  const limit = parseFloat(budget.monthlyLimit ?? "0");
  const percentage = budget.percentage;
  const remaining = parseFloat(budget.remaining);

  const barColor =
    percentage > 90
      ? "bg-red-500"
      : percentage > 70
      ? "bg-yellow-500"
      : "bg-green-500";

  const barBgColor =
    percentage > 90
      ? "bg-red-500/10"
      : percentage > 70
      ? "bg-yellow-500/10"
      : "bg-green-500/10";

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-text capitalize">{budget.category}</p>
          <p className="text-xs text-text-muted mt-0.5">
            {formatCurrency(spent)} / {formatCurrency(limit)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            percentage > 90
              ? "bg-red-500/15 text-red-400"
              : percentage > 70
              ? "bg-yellow-500/15 text-yellow-400"
              : "bg-green-500/15 text-green-400"
          )}>
            {Math.round(percentage)}%
          </span>
          <button
            onClick={onDelete}
            className="p-1 rounded-lg text-text-muted hover:text-red-400 transition-colors"
            aria-label="Delete budget"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className={cn("h-2.5 w-full rounded-full overflow-hidden", barBgColor)}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Remaining */}
      <p className={cn(
        "text-xs",
        remaining >= 0 ? "text-text-muted" : "text-red-400 font-medium"
      )}>
        {remaining >= 0
          ? `${formatCurrency(remaining)} remaining`
          : `${formatCurrency(Math.abs(remaining))} over budget`}
      </p>

      {/* Rollover badge */}
      {budget.rollover && (
        <span className="self-start rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
          Rollover enabled
        </span>
      )}
    </div>
  );
}

function BudgetCardSkeleton() {
  return <Skeleton className="h-36 rounded-2xl" />;
}

// ── Budget Drawer ────────────────────────────────────────────────────────────

function BudgetDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();

  const [category, setCategory] = useState<BudgetCategory>("groceries");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [rollover, setRollover] = useState(false);

  const createBudget = trpc.finances.createBudget.useMutation({
    onSuccess: () => {
      utils.finances.listBudgets.invalidate();
      utils.finances.getBudgetProgress.invalidate();
      utils.finances.getFinancialOverview.invalidate();
      toast.success("Budget created");
      setCategory("groceries");
      setMonthlyLimit("");
      setRollover(false);
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create budget");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = monthlyLimit.trim();
    if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      toast.error("Enter a valid amount (e.g., 500.00)");
      return;
    }
    createBudget.mutate({
      category,
      monthlyLimit: trimmed,
      rollover,
    });
  }

  return (
    <Drawer open={isOpen} onClose={onClose} title="Add Budget">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-6">
        {/* Category */}
        <div>
          <label className="orbyt-label" htmlFor="budget-category">Category</label>
          <select
            id="budget-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BudgetCategory)}
            className="orbyt-input mt-1 w-full capitalize"
          >
            {BUDGET_CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
        </div>

        {/* Monthly Limit */}
        <div>
          <label className="orbyt-label" htmlFor="budget-limit">Monthly Limit</label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              $
            </span>
            <input
              id="budget-limit"
              type="text"
              inputMode="decimal"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              className="orbyt-input w-full pl-7"
              placeholder="0.00"
              required
            />
          </div>
        </div>

        {/* Rollover toggle */}
        <div className="rounded-xl border border-border bg-surface/50 px-4 py-3">
          <label className="flex cursor-pointer items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text">Rollover</span>
              <span className="text-xs text-text-muted">Carry unspent budget to next month</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-medium", rollover ? "text-accent" : "text-text-muted")}>
                {rollover ? "ON" : "OFF"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={rollover}
                onClick={() => setRollover(!rollover)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
                  rollover ? "bg-accent" : "bg-white/10"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 rounded-full shadow transition-transform",
                    rollover ? "translate-x-6 bg-white" : "translate-x-1 bg-white/60"
                  )}
                />
              </button>
            </div>
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={createBudget.isPending || !monthlyLimit.trim()}
          className="orbyt-button-accent"
        >
          {createBudget.isPending ? "Creating..." : "Create Budget"}
        </button>
      </form>
    </Drawer>
  );
}

// ── BudgetsTab (main export) ─────────────────────────────────────────────────

export function BudgetsTab() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: budgetProgress, isLoading } = trpc.finances.getBudgetProgress.useQuery({
    month: currentMonth,
  });

  const utils = trpc.useUtils();

  const deleteBudget = trpc.finances.deleteBudget.useMutation({
    onSuccess: () => {
      utils.finances.listBudgets.invalidate();
      utils.finances.getBudgetProgress.invalidate();
      utils.finances.getFinancialOverview.invalidate();
      toast.success("Budget archived");
      setDeleteId(null);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to archive budget");
    },
  });

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-text-muted text-sm">
              Set spending limits by category and track your progress.
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="orbyt-button-accent flex items-center gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Budget
          </button>
        </div>

        {/* Budget Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <BudgetCardSkeleton key={i} />
            ))}
          </div>
        ) : !budgetProgress || budgetProgress.length === 0 ? (
          <EmptyState
            character="rosie"
            expression="thinking"
            title="No budgets set up yet."
            description="Create budgets to track your spending by category."
            actionLabel="Add Budget"
            onAction={() => setDrawerOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {budgetProgress.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onDelete={() => setDeleteId(budget.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Budget Drawer */}
      <BudgetDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        title="Archive this budget?"
        description="It will be removed from your active budgets. Historical data will be preserved."
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => deleteId && deleteBudget.mutate({ id: deleteId })}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
