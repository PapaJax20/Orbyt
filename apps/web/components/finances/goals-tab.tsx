"use client";

import { useState } from "react";
import { Plus, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ── Types ──────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type GoalItem = RouterOutput["finances"]["listGoals"][number];

type GoalCategory = "savings" | "sinking_fund" | "debt_payoff";

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  savings: "Savings",
  sinking_fund: "Sinking Fund",
  debt_payoff: "Debt Payoff",
};

// ── ContributeModal ──────────────────────────────────────────────────────────

function ContributeModal({
  goal,
  open,
  onClose,
}: {
  goal: GoalItem;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [amount, setAmount] = useState("");

  const contribute = trpc.finances.contributeToGoal.useMutation({
    onSuccess: () => {
      utils.finances.listGoals.invalidate();
      utils.finances.listAccounts.invalidate();
      utils.finances.getFinancialOverview.invalidate();
      toast.success("Contribution added");
      setAmount("");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to add contribution");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = amount.trim();
    if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      toast.error("Enter a valid amount (e.g., 50.00)");
      return;
    }
    contribute.mutate({
      goalId: goal.id,
      amount: trimmed,
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>
              <Dialog.Content
                asChild
                onInteractOutside={(e) => e.preventDefault()}
                aria-describedby="contribute-description"
              >
                <motion.div
                  className="glass-card fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <Dialog.Title className="font-display text-xl font-bold text-text">
                    Contribute to Goal
                  </Dialog.Title>
                  <Dialog.Description
                    id="contribute-description"
                    className="mt-1 text-sm text-text-muted"
                  >
                    Add funds to{" "}
                    <span className="font-semibold text-text">
                      {goal.emoji ? `${goal.emoji} ` : ""}{goal.name}
                    </span>
                  </Dialog.Description>

                  <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                    <div>
                      <label className="orbyt-label" htmlFor="contribute-amount">Amount</label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                          $
                        </span>
                        <input
                          id="contribute-amount"
                          type="text"
                          inputMode="decimal"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="orbyt-input w-full pl-7"
                          placeholder="0.00"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={contribute.isPending}
                        className="orbyt-button-ghost flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={contribute.isPending || !amount.trim()}
                        className="orbyt-button-accent flex-1"
                      >
                        {contribute.isPending ? "Adding..." : "Contribute"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── GoalCard ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onContribute,
  onDelete,
}: {
  goal: GoalItem;
  onContribute: () => void;
  onDelete: () => void;
}) {
  const current = parseFloat(goal.currentAmount ?? "0");
  const target = parseFloat(goal.targetAmount ?? "0");
  const percentage = goal.progressPercent;

  const barColor = percentage >= 100 ? "bg-green-500" : "bg-accent";

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {goal.emoji && (
            <span className="text-xl leading-none">{goal.emoji}</span>
          )}
          <div>
            <p className="font-semibold text-text">{goal.name}</p>
            <p className="text-xs text-text-muted capitalize">
              {GOAL_CATEGORY_LABELS[(goal.category as GoalCategory) ?? "savings"]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {goal.onTrack !== null && (
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              goal.onTrack
                ? "bg-green-500/15 text-green-400"
                : "bg-yellow-500/15 text-yellow-400"
            )}>
              {goal.onTrack ? "On Track" : "Behind"}
            </span>
          )}
          <button
            onClick={onDelete}
            className="p-1 rounded-lg text-text-muted hover:text-red-400 transition-colors"
            aria-label="Delete goal"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 w-full rounded-full overflow-hidden bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Amount */}
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-text">
          <span className="font-bold text-accent">{formatCurrency(current)}</span>
          <span className="text-text-muted"> / {formatCurrency(target)}</span>
        </p>
        <span className="text-xs font-medium text-text-muted">
          {Math.round(percentage)}%
        </span>
      </div>

      {/* Target date + months remaining */}
      {goal.targetDate && (
        <p className="text-xs text-text-muted">
          Target: {new Date(goal.targetDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {goal.monthsRemaining !== null && (
            <> ({goal.monthsRemaining} month{goal.monthsRemaining !== 1 ? "s" : ""} left)</>
          )}
        </p>
      )}

      {/* Monthly contribution */}
      {goal.monthlyContribution && (
        <p className="text-xs text-text-muted">
          Monthly contribution: {formatCurrency(goal.monthlyContribution)}
        </p>
      )}

      {/* Contribute button */}
      <button
        onClick={onContribute}
        className="orbyt-button-accent mt-1 text-sm flex items-center justify-center gap-2"
      >
        <Target className="h-4 w-4" />
        Contribute
      </button>
    </div>
  );
}

function GoalCardSkeleton() {
  return <Skeleton className="h-48 rounded-2xl" />;
}

// ── Goal Drawer ──────────────────────────────────────────────────────────────

function GoalDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [category, setCategory] = useState<GoalCategory>("savings");
  const [emoji, setEmoji] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("");

  const { data: accountsData } = trpc.finances.listAccounts.useQuery();
  const accounts = accountsData?.accounts ?? [];

  const createGoal = trpc.finances.createGoal.useMutation({
    onSuccess: () => {
      utils.finances.listGoals.invalidate();
      utils.finances.getFinancialOverview.invalidate();
      toast.success("Goal created");
      // Reset form
      setName("");
      setTargetAmount("");
      setTargetDate("");
      setMonthlyContribution("");
      setCategory("savings");
      setEmoji("");
      setLinkedAccountId("");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create goal");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTarget = targetAmount.trim();
    if (!trimmedTarget || !/^\d+(\.\d{1,2})?$/.test(trimmedTarget)) {
      toast.error("Enter a valid target amount (e.g., 5000.00)");
      return;
    }

    const trimmedContrib = monthlyContribution.trim();
    if (trimmedContrib && !/^\d+(\.\d{1,2})?$/.test(trimmedContrib)) {
      toast.error("Enter a valid monthly contribution (e.g., 200.00)");
      return;
    }

    createGoal.mutate({
      name: name.trim(),
      targetAmount: trimmedTarget,
      targetDate: targetDate || null,
      monthlyContribution: trimmedContrib || null,
      category,
      emoji: emoji.trim() || null,
      linkedAccountId: linkedAccountId || null,
    });
  }

  return (
    <Drawer open={isOpen} onClose={onClose} title="Add Savings Goal">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-6">
        {/* Emoji + Name */}
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div>
            <label className="orbyt-label" htmlFor="goal-emoji">Emoji</label>
            <input
              id="goal-emoji"
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="orbyt-input mt-1 w-full text-center text-lg"
              placeholder="🎯"
              maxLength={4}
            />
          </div>
          <div>
            <label className="orbyt-label" htmlFor="goal-name">Name</label>
            <input
              id="goal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="orbyt-input mt-1 w-full"
              placeholder="e.g. Vacation Fund"
              required
              maxLength={100}
            />
          </div>
        </div>

        {/* Target Amount */}
        <div>
          <label className="orbyt-label" htmlFor="goal-target">Target Amount</label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              $
            </span>
            <input
              id="goal-target"
              type="text"
              inputMode="decimal"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="orbyt-input w-full pl-7"
              placeholder="0.00"
              required
            />
          </div>
        </div>

        {/* Target Date */}
        <div>
          <label className="orbyt-label" htmlFor="goal-date">
            Target Date <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="goal-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="orbyt-input mt-1 w-full"
          />
        </div>

        {/* Monthly Contribution */}
        <div>
          <label className="orbyt-label" htmlFor="goal-monthly">
            Monthly Contribution <span className="text-text-muted">(optional)</span>
          </label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              $
            </span>
            <input
              id="goal-monthly"
              type="text"
              inputMode="decimal"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
              className="orbyt-input w-full pl-7"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="orbyt-label" htmlFor="goal-category">Category</label>
          <select
            id="goal-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as GoalCategory)}
            className="orbyt-input mt-1 w-full"
          >
            <option value="savings">Savings</option>
            <option value="sinking_fund">Sinking Fund</option>
            <option value="debt_payoff">Debt Payoff</option>
          </select>
        </div>

        {/* Linked Account */}
        <div>
          <label className="orbyt-label" htmlFor="goal-account">
            Linked Account <span className="text-text-muted">(optional)</span>
          </label>
          <select
            id="goal-account"
            value={linkedAccountId}
            onChange={(e) => setLinkedAccountId(e.target.value)}
            className="orbyt-input mt-1 w-full"
          >
            <option value="">No linked account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={createGoal.isPending || !name.trim() || !targetAmount.trim()}
          className="orbyt-button-accent"
        >
          {createGoal.isPending ? "Creating..." : "Create Goal"}
        </button>
      </form>
    </Drawer>
  );
}

// ── GoalsTab (main export) ───────────────────────────────────────────────────

export function GoalsTab() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<GoalItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: goals, isLoading } = trpc.finances.listGoals.useQuery();

  const utils = trpc.useUtils();

  const deleteGoal = trpc.finances.deleteGoal.useMutation({
    onSuccess: () => {
      utils.finances.listGoals.invalidate();
      utils.finances.getFinancialOverview.invalidate();
      toast.success("Goal archived");
      setDeleteId(null);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to archive goal");
    },
  });

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-text-muted text-sm">
              Set savings targets and track your progress toward financial goals.
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="orbyt-button-accent flex items-center gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Goal
          </button>
        </div>

        {/* Goals Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <GoalCardSkeleton key={i} />
            ))}
          </div>
        ) : !goals || goals.length === 0 ? (
          <EmptyState
            character="rosie"
            expression="thinking"
            title="No savings goals yet."
            description="Set up your first savings goal and start tracking your progress."
            actionLabel="Add Goal"
            onAction={() => setDrawerOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onContribute={() => setContributeGoal(goal)}
                onDelete={() => setDeleteId(goal.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Goal Drawer */}
      <GoalDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Contribute Modal */}
      {contributeGoal && (
        <ContributeModal
          goal={contributeGoal}
          open={!!contributeGoal}
          onClose={() => setContributeGoal(null)}
        />
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        title="Archive this goal?"
        description="It will be removed from your active goals. Progress data will be preserved."
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => deleteId && deleteGoal.mutate({ id: deleteId })}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
