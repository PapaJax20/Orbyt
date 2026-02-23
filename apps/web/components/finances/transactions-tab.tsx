"use client";

import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
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
type TransactionItem = RouterOutput["finances"]["listTransactions"]["transactions"][number];

type TransactionType = "expense" | "income" | "transfer";

type TransactionCategory =
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
  | "gifts"
  | "income"
  | "salary"
  | "freelance"
  | "investment"
  | "transfer"
  | "other";

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

// ── Constants ────────────────────────────────────────────────────────────────

const TRANSACTION_CATEGORIES: TransactionCategory[] = [
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
  "gifts",
  "income",
  "salary",
  "freelance",
  "investment",
  "transfer",
  "other",
];

const CATEGORY_COLORS: Record<string, string> = {
  housing: "bg-blue-500/15 text-blue-400",
  utilities: "bg-yellow-500/15 text-yellow-400",
  groceries: "bg-green-500/15 text-green-400",
  dining: "bg-orange-500/15 text-orange-400",
  transportation: "bg-cyan-500/15 text-cyan-400",
  healthcare: "bg-red-500/15 text-red-400",
  insurance: "bg-purple-500/15 text-purple-400",
  entertainment: "bg-pink-500/15 text-pink-400",
  shopping: "bg-indigo-500/15 text-indigo-400",
  education: "bg-teal-500/15 text-teal-400",
  personal: "bg-amber-500/15 text-amber-400",
  gifts: "bg-rose-500/15 text-rose-400",
  income: "bg-green-500/15 text-green-400",
  salary: "bg-emerald-500/15 text-emerald-400",
  freelance: "bg-lime-500/15 text-lime-400",
  investment: "bg-sky-500/15 text-sky-400",
  transfer: "bg-blue-500/15 text-blue-400",
  other: "bg-white/10 text-text-muted",
};

const PAGE_SIZE = 20;

// ── Transaction Drawer ───────────────────────────────────────────────────────

function TransactionDrawer({
  isOpen,
  onClose,
  transaction,
}: {
  isOpen: boolean;
  onClose: () => void;
  transaction?: TransactionItem | null;
}) {
  const utils = trpc.useUtils();

  const isEditing = !!transaction;

  const [type, setType] = useState<TransactionType>(
    (transaction?.type as TransactionType) ?? "expense"
  );
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [amount, setAmount] = useState(transaction?.amount ?? "");
  const [category, setCategory] = useState<TransactionCategory>(
    (transaction?.category as TransactionCategory) ?? "other"
  );
  const [date, setDate] = useState(
    transaction?.date
      ? new Date(transaction.date).toISOString().slice(0, 10)
      : todayISODate()
  );
  const [accountId, setAccountId] = useState(transaction?.accountId ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [isRecurring, setIsRecurring] = useState(transaction?.isRecurring ?? false);
  const [recurringFrequency, setRecurringFrequency] = useState(
    transaction?.recurringFrequency ?? ""
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [ownership, setOwnership] = useState<"mine" | "theirs" | "ours">(
    (transaction?.ownership as "mine" | "theirs" | "ours") ?? "ours"
  );
  const [isSplit, setIsSplit] = useState(false);
  const [splitMembers, setSplitMembers] = useState<string[]>([]);

  const { data: accountsData } = trpc.finances.listAccounts.useQuery();
  const { data: membersData } = trpc.finances.listHouseholdMembers.useQuery();
  const members = membersData ?? [];
  const accounts = accountsData?.accounts ?? [];

  const createTransaction = trpc.finances.createTransaction.useMutation({
    onSuccess: (data) => {
      utils.finances.listTransactions.invalidate();
      utils.finances.listAccounts.invalidate();
      utils.finances.getFinancialOverview.invalidate();

      // Create splits if enabled
      if (isSplit && splitMembers.length > 0 && data) {
        const perPerson = (parseFloat(amount.trim()) / (splitMembers.length + 1)).toFixed(2);
        createSplits.mutate({
          transactionId: data.id,
          splits: splitMembers.map((memberId) => ({
            owedBy: memberId,
            owedTo: data.createdBy,
            amount: perPerson,
          })),
        });
      }

      toast.success("Transaction added");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to add transaction");
    },
  });

  const updateTransaction = trpc.finances.updateTransaction.useMutation({
    onSuccess: () => {
      utils.finances.listTransactions.invalidate();
      utils.finances.listAccounts.invalidate();
      utils.finances.getFinancialOverview.invalidate();
      toast.success("Transaction updated");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update transaction");
    },
  });

  const deleteTransaction = trpc.finances.deleteTransaction.useMutation({
    onSuccess: () => {
      utils.finances.listTransactions.invalidate();
      utils.finances.listAccounts.invalidate();
      utils.finances.getFinancialOverview.invalidate();
      toast.success("Transaction deleted");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to delete transaction");
    },
  });

  const createSplits = trpc.finances.createExpenseSplits.useMutation({
    onSuccess: () => {
      utils.finances.getBalanceBetweenMembers.invalidate();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedAmount = amount.trim();
    if (!trimmedAmount || !/^\d+(\.\d{1,2})?$/.test(trimmedAmount)) {
      toast.error("Enter a valid amount (e.g., 50.00)");
      return;
    }

    const dateISO = new Date(date + "T12:00:00.000Z").toISOString();

    if (isEditing && transaction) {
      updateTransaction.mutate({
        id: transaction.id,
        data: {
          type,
          description: description.trim(),
          amount: trimmedAmount,
          category,
          date: dateISO,
          accountId: accountId || null,
          notes: notes.trim() || null,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency || null : null,
          ownership,
        },
      });
    } else {
      createTransaction.mutate({
        type,
        description: description.trim(),
        amount: trimmedAmount,
        category,
        date: dateISO,
        accountId: accountId || null,
        notes: notes.trim() || null,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency || null : null,
        ownership,
      });
    }
  }

  const isPending = createTransaction.isPending || updateTransaction.isPending;

  return (
    <>
      <Drawer
        open={isOpen}
        onClose={onClose}
        title={isEditing ? "Edit Transaction" : "Add Transaction"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-6">
          {/* Type toggle */}
          <div>
            <label className="orbyt-label">Type</label>
            <div className="mt-1 flex gap-2">
              {(["expense", "income", "transfer"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all capitalize",
                    type === t
                      ? t === "expense"
                        ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                        : t === "income"
                        ? "bg-green-500/15 text-green-400 ring-1 ring-green-500/30"
                        : "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30"
                      : "bg-surface/50 text-text-muted hover:text-text"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="orbyt-label" htmlFor="tx-description">Description</label>
            <input
              id="tx-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="orbyt-input mt-1 w-full"
              placeholder="e.g. Grocery Store"
              required
              maxLength={255}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="orbyt-label" htmlFor="tx-amount">Amount</label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                $
              </span>
              <input
                id="tx-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="orbyt-input w-full pl-7"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Category + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="orbyt-label" htmlFor="tx-category">Category</label>
              <select
                id="tx-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                className="orbyt-input mt-1 w-full capitalize"
              >
                {TRANSACTION_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="orbyt-label" htmlFor="tx-date">Date</label>
              <input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="orbyt-input mt-1 w-full"
                required
              />
            </div>
          </div>

          {/* Account */}
          <div>
            <label className="orbyt-label" htmlFor="tx-account">
              Account <span className="text-text-muted">(optional)</span>
            </label>
            <select
              id="tx-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="orbyt-input mt-1 w-full"
            >
              <option value="">No account</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="orbyt-label" htmlFor="tx-notes">
              Notes <span className="text-text-muted">(optional)</span>
            </label>
            <textarea
              id="tx-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="orbyt-input mt-1 w-full resize-none"
              rows={2}
              maxLength={2000}
              placeholder="Any additional notes..."
            />
          </div>

          {/* Recurring toggle */}
          <div className="rounded-xl border border-border bg-surface/50 px-4 py-3">
            <label className="flex cursor-pointer items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-text">Recurring</span>
                <span className="text-xs text-text-muted">Mark as a recurring transaction</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-medium", isRecurring ? "text-accent" : "text-text-muted")}>
                  {isRecurring ? "ON" : "OFF"}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isRecurring}
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
                    isRecurring ? "bg-accent" : "bg-white/10"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 rounded-full shadow transition-transform",
                      isRecurring ? "translate-x-6 bg-white" : "translate-x-1 bg-white/60"
                    )}
                  />
                </button>
              </div>
            </label>
            {isRecurring && (
              <div className="mt-3">
                <select
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value)}
                  className="orbyt-input w-full text-sm"
                >
                  <option value="">Select frequency</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            )}
          </div>

          {/* Ownership */}
          <div>
            <label className="orbyt-label">Who is this for?</label>
            <div className="mt-1 flex gap-2">
              {(["mine", "theirs", "ours"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOwnership(o)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all capitalize",
                    ownership === o
                      ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                      : "bg-surface/50 text-text-muted hover:text-text"
                  )}
                >
                  {o === "mine" ? "Mine" : o === "theirs" ? "Partner's" : "Shared"}
                </button>
              ))}
            </div>
          </div>

          {/* Expense Splitting */}
          {type === "expense" && (
            <div className="rounded-xl border border-border bg-surface/50 px-4 py-3">
              <label className="flex cursor-pointer items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-text">Split this expense</span>
                  <span className="text-xs text-text-muted">Divide the cost with household members</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-medium", isSplit ? "text-accent" : "text-text-muted")}>
                    {isSplit ? "ON" : "OFF"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isSplit}
                    onClick={() => setIsSplit(!isSplit)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
                      isSplit ? "bg-accent" : "bg-white/10"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 rounded-full shadow transition-transform",
                        isSplit ? "translate-x-6 bg-white" : "translate-x-1 bg-white/60"
                      )}
                    />
                  </button>
                </div>
              </label>
              {isSplit && members.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs text-text-muted">Split evenly among:</p>
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSplitMembers((prev) =>
                            prev.includes(m.id)
                              ? prev.filter((id) => id !== m.id)
                              : [...prev, m.id]
                          );
                        }}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                          splitMembers.includes(m.id)
                            ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                            : "bg-white/10 text-text-muted hover:text-text"
                        )}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                  {splitMembers.length > 0 && amount.trim() && (
                    <p className="text-xs text-accent">
                      Each pays: {formatCurrency(
                        (parseFloat(amount) / (splitMembers.length + 1)).toFixed(2)
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending || !description.trim() || !amount.trim()}
              className="orbyt-button-accent flex-1"
            >
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Transaction"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="orbyt-button-ghost text-red-400 hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </Drawer>

      {isEditing && transaction && (
        <ConfirmDialog
          open={showDeleteConfirm}
          title="Delete this transaction?"
          description="This action cannot be undone. The account balance will be adjusted accordingly."
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => deleteTransaction.mutate({ id: transaction.id })}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

// ── TransactionsTab (main export) ────────────────────────────────────────────

export function TransactionsTab() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionItem | null>(null);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMemberId, setFilterMemberId] = useState("");
  const [filterOwnership, setFilterOwnership] = useState("");
  const [page, setPage] = useState(0);

  const { data: membersData } = trpc.finances.listHouseholdMembers.useQuery();
  const members = membersData ?? [];

  const queryInput: {
    limit: number;
    offset: number;
    startDate?: string;
    endDate?: string;
    category?: TransactionCategory;
    type?: TransactionType;
    memberId?: string;
    ownership?: "mine" | "theirs" | "ours";
  } = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  if (startDate) {
    queryInput.startDate = new Date(startDate + "T00:00:00.000Z").toISOString();
  }
  if (endDate) {
    queryInput.endDate = new Date(endDate + "T23:59:59.999Z").toISOString();
  }
  if (filterCategory) {
    queryInput.category = filterCategory as TransactionCategory;
  }
  if (filterType) {
    queryInput.type = filterType as TransactionType;
  }
  if (filterMemberId) {
    queryInput.memberId = filterMemberId;
  }
  if (filterOwnership) {
    queryInput.ownership = filterOwnership as "mine" | "theirs" | "ours";
  }

  const { data, isLoading } = trpc.finances.listTransactions.useQuery(queryInput);
  const { data: accountsData } = trpc.finances.listAccounts.useQuery();
  const accountsMap = new Map(
    (accountsData?.accounts ?? []).map((a) => [a.id, a.name])
  );

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function openCreate() {
    setSelectedTransaction(null);
    setDrawerOpen(true);
  }

  function openTransaction(tx: TransactionItem) {
    setSelectedTransaction(tx);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setSelectedTransaction(null), 300);
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-text-muted text-sm">
            View and manage all your income, expenses, and transfers.
          </p>
          <button onClick={openCreate} className="orbyt-button-accent flex items-center gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add Transaction
          </button>
        </div>

        {/* Filter bar */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-text-muted whitespace-nowrap">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                className="orbyt-input text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-text-muted whitespace-nowrap">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                className="orbyt-input text-sm"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
              className="orbyt-input text-sm capitalize"
            >
              <option value="">All Categories</option>
              {TRANSACTION_CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
              className="orbyt-input text-sm capitalize"
            >
              <option value="">All Types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
            <select
              value={filterMemberId}
              onChange={(e) => { setFilterMemberId(e.target.value); setPage(0); }}
              className="orbyt-input text-sm"
            >
              <option value="">All Members</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select
              value={filterOwnership}
              onChange={(e) => { setFilterOwnership(e.target.value); setPage(0); }}
              className="orbyt-input text-sm"
            >
              <option value="">All Ownership</option>
              <option value="mine">Mine</option>
              <option value="theirs">Partner's</option>
              <option value="ours">Shared</option>
            </select>
          </div>
        </div>

        {/* Transaction list */}
        <div className="glass-card overflow-hidden rounded-2xl">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-text-muted">
            <span>Description</span>
            <span className="hidden sm:block">Category</span>
            <span className="hidden md:block">Account</span>
            <span className="text-right">Amount</span>
          </div>

          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border/50 px-4 py-3.5"
              >
                <div className="h-3 flex-1 rounded bg-white/10 animate-pulse" />
                <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
              </div>
            ))
          ) : transactions.length === 0 ? (
            <EmptyState
              character="rosie"
              expression="thinking"
              title="No transactions found."
              description="Add your first transaction or adjust the filters."
              actionLabel="Add Transaction"
              onAction={openCreate}
            />
          ) : (
            transactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => openTransaction(tx)}
                className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border/50 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
              >
                {/* Description + date */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{tx.description}</p>
                  <p className="text-xs text-text-muted">
                    {new Date(tx.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {/* Category badge */}
                <span className={cn(
                  "hidden sm:inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  CATEGORY_COLORS[tx.category] ?? CATEGORY_COLORS.other
                )}>
                  {tx.category}
                </span>

                {/* Account name */}
                <span className="hidden md:block shrink-0 text-xs text-text-muted">
                  {tx.accountId ? (accountsMap.get(tx.accountId) ?? "—") : "—"}
                </span>

                {/* Amount */}
                <span className={cn(
                  "shrink-0 text-sm font-semibold text-right",
                  tx.type === "income"
                    ? "text-green-400"
                    : tx.type === "transfer"
                    ? "text-blue-400"
                    : "text-red-400"
                )}>
                  {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                  {formatCurrency(tx.amount, tx.currency)}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="orbyt-button-ghost p-2 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-text-muted">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="orbyt-button-ghost p-2 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Drawer */}
      <TransactionDrawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        transaction={selectedTransaction}
      />
    </>
  );
}
