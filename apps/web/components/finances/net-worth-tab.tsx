"use client";

import { useState } from "react";
import {
  Building2,
  PiggyBank,
  CreditCard,
  Landmark,
  TrendingUp,
  Wallet,
  HelpCircle,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type NetWorthResult = RouterOutput["finances"]["calculateNetWorth"];
type SnapshotItem = RouterOutput["finances"]["getNetWorthHistory"][number];

type AccountType = "checking" | "savings" | "credit_card" | "loan" | "investment" | "cash" | "other";

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

const ACCOUNT_TYPE_ICONS: Record<AccountType, React.FC<{ size?: number; className?: string }>> = {
  checking: Building2,
  savings: PiggyBank,
  credit_card: CreditCard,
  loan: Landmark,
  investment: TrendingUp,
  cash: Wallet,
  other: HelpCircle,
};

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  loan: "Loan",
  investment: "Investment",
  cash: "Cash",
  other: "Other",
};

// ── Period selector options ──────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { months: 3, label: "3 Months" },
  { months: 6, label: "6 Months" },
  { months: 12, label: "12 Months" },
] as const;

// ── NetWorthTab ──────────────────────────────────────────────────────────────

export function NetWorthTab() {
  const [selectedMonths, setSelectedMonths] = useState<number>(6);
  const utils = trpc.useUtils();

  const { data: netWorth, isLoading: netWorthLoading } =
    trpc.finances.calculateNetWorth.useQuery();

  const { data: history, isLoading: historyLoading } =
    trpc.finances.getNetWorthHistory.useQuery({ months: selectedMonths });

  const takeSnapshot = trpc.finances.takeNetWorthSnapshot.useMutation({
    onSuccess: () => {
      utils.finances.getNetWorthHistory.invalidate();
      utils.finances.calculateNetWorth.invalidate();
      toast.success("Snapshot taken");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to take snapshot");
    },
  });

  // Parse net worth values
  const totalAssets = parseFloat(netWorth?.totalAssets ?? "0");
  const totalLiabilities = parseFloat(netWorth?.totalLiabilities ?? "0");
  const netWorthValue = parseFloat(netWorth?.netWorth ?? "0");
  const breakdown = netWorth?.breakdown ?? {};
  const breakdownEntries = Object.entries(breakdown);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-text-muted text-sm">
          Monitor your household net worth over time.
        </p>
        <button
          onClick={() => takeSnapshot.mutate()}
          disabled={takeSnapshot.isPending}
          className="orbyt-button-accent flex items-center gap-2 shrink-0"
        >
          <span aria-label="Take snapshot"><Camera size={16} /></span>
          {takeSnapshot.isPending ? "Saving..." : "Take Snapshot"}
        </button>
      </div>

      {/* Top card: Current net worth */}
      {netWorthLoading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : (
        <div className="glass-card rounded-2xl p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Current Net Worth
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold font-display",
              netWorthValue >= 0 ? "text-green-400" : "text-red-400"
            )}
          >
            {formatCurrency(netWorthValue)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-muted">Total Assets</p>
              <p className="text-lg font-semibold text-green-400">{formatCurrency(totalAssets)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Liabilities</p>
              <p className="text-lg font-semibold text-red-400">{formatCurrency(totalLiabilities)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown cards */}
      {netWorthLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : breakdownEntries.length === 0 ? (
        <EmptyState
          character="rosie"
          expression="thinking"
          title="No account data"
          description="Set up accounts first to see your net worth breakdown."
          compact
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {breakdownEntries.map(([type, amount]) => {
            const accountType = type as AccountType;
            const IconComp = ACCOUNT_TYPE_ICONS[accountType] ?? HelpCircle;
            const label = ACCOUNT_TYPE_LABELS[accountType] ?? type;
            const value = parseFloat(amount);
            const isLiability = accountType === "credit_card" || accountType === "loan";

            return (
              <div key={type} className="glass-card-subtle rounded-2xl p-4 flex items-center gap-3">
                <div className="rounded-xl bg-white/5 p-2 text-accent" aria-label={label}>
                  <IconComp size={20} />
                </div>
                <div>
                  <p className="text-xs text-text-muted">{label}</p>
                  <p
                    className={cn(
                      "text-lg font-bold font-display",
                      isLiability ? "text-red-400" : "text-accent"
                    )}
                  >
                    {formatCurrency(value)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Historical data section */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Net Worth History
          </h3>
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.months}
                onClick={() => setSelectedMonths(option.months)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  selectedMonths === option.months
                    ? "bg-accent/15 text-accent"
                    : "text-text-muted hover:text-text hover:bg-white/5"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* History table */}
        <div className="mt-4">
          {historyLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : !history || history.length === 0 ? (
            <EmptyState
              character="rosie"
              expression="thinking"
              title="No snapshots yet"
              description="Click 'Take Snapshot' to start tracking your net worth over time."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                      Date
                    </th>
                    <th className="py-2 px-4 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                      Assets
                    </th>
                    <th className="py-2 px-4 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                      Liabilities
                    </th>
                    <th className="py-2 pl-4 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
                      Net Worth
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((snapshot) => {
                    const nw = parseFloat(snapshot.netWorth ?? "0");
                    return (
                      <tr
                        key={snapshot.id}
                        className="border-b border-white/5 last:border-0"
                      >
                        <td className="py-2.5 pr-4 text-text">
                          {new Date(snapshot.snapshotDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-2.5 px-4 text-right text-green-400">
                          {formatCurrency(snapshot.totalAssets)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-red-400">
                          {formatCurrency(snapshot.totalLiabilities)}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 pl-4 text-right font-semibold",
                            nw >= 0 ? "text-green-400" : "text-red-400"
                          )}
                        >
                          {formatCurrency(nw)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
