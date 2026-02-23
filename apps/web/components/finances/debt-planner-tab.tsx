"use client";

import { useState, useMemo } from "react";
import { Snowflake, TrendingDown } from "lucide-react";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type AccountList = RouterOutput["finances"]["listAccounts"];
type Account = AccountList["accounts"][number];

type Strategy = "snowball" | "avalanche";

interface DebtInput {
  name: string;
  balance: number;
  apr: number;
  minPayment: number;
}

interface PayoffResult {
  months: number;
  totalInterest: number;
  totalPaid: number;
  timeline: { month: number; debts: { name: string; payment: number; remaining: number }[] }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

// ── Debt payoff calculator ──────────────────────────────────────────────────

function calculateDebtPayoff(
  debts: DebtInput[],
  strategy: Strategy,
  extraPayment: number
): PayoffResult {
  // Sort debts by strategy
  const sorted = [...debts].sort((a, b) =>
    strategy === "snowball" ? a.balance - b.balance : b.apr - a.apr
  );

  const remaining = sorted.map((d) => ({ ...d, remaining: d.balance }));
  let totalInterest = 0;
  let totalPaid = 0;
  const timeline: PayoffResult["timeline"] = [];
  let month = 0;
  const MAX_MONTHS = 600; // 50 year safety cap

  while (remaining.some((d) => d.remaining > 0) && month < MAX_MONTHS) {
    month++;
    let extra = extraPayment;
    const monthData: { name: string; payment: number; remaining: number }[] = [];

    for (const debt of remaining) {
      if (debt.remaining <= 0) {
        monthData.push({ name: debt.name, payment: 0, remaining: 0 });
        continue;
      }

      // Monthly interest
      const monthlyRate = debt.apr / 100 / 12;
      const interest = debt.remaining * monthlyRate;
      totalInterest += interest;

      // Payment: minimum + extra (extra goes to first non-zero debt in sorted order)
      let payment = debt.minPayment;
      if (extra > 0 && debt === remaining.find((d) => d.remaining > 0)) {
        payment += extra;
        extra = 0;
      }

      // Apply payment
      const applied = Math.min(payment, debt.remaining + interest);
      debt.remaining = debt.remaining + interest - applied;
      if (debt.remaining < 0.01) debt.remaining = 0;
      totalPaid += applied;

      monthData.push({ name: debt.name, payment: applied, remaining: debt.remaining });
    }

    timeline.push({ month, debts: monthData });
  }

  return { months: month, totalInterest, totalPaid, timeline };
}

// ── DebtPlannerTab ──────────────────────────────────────────────────────────

export function DebtPlannerTab() {
  const { data: accountsData, isLoading } = trpc.finances.listAccounts.useQuery();
  const allAccounts = accountsData?.accounts ?? [];

  // Filter to only credit cards and loans
  const debtAccounts = allAccounts.filter(
    (a) => a.type === "credit_card" || a.type === "loan"
  );

  // Local state for which debts are selected and their inputs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [debtInputs, setDebtInputs] = useState<Map<string, { apr: string; minPayment: string }>>(
    new Map()
  );
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [extraPayment, setExtraPayment] = useState("");

  // Toggle debt selection
  function toggleDebt(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Update debt input (APR or min payment)
  function updateDebtInput(id: string, field: "apr" | "minPayment", value: string) {
    setDebtInputs((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) ?? { apr: "", minPayment: "" };
      next.set(id, { ...existing, [field]: value });
      return next;
    });
  }

  // Build DebtInput array from selected debts
  const selectedDebts: DebtInput[] = useMemo(() => {
    return debtAccounts
      .filter((a) => selectedIds.has(a.id))
      .map((a) => {
        const inputs = debtInputs.get(a.id);
        return {
          name: a.name,
          balance: Math.abs(parseFloat(a.balance ?? "0")),
          apr: parseFloat(inputs?.apr ?? "0") || 0,
          minPayment: parseFloat(inputs?.minPayment ?? "0") || 0,
        };
      })
      .filter((d) => d.balance > 0 && d.minPayment > 0);
  }, [debtAccounts, selectedIds, debtInputs]);

  const extraPaymentNum = parseFloat(extraPayment) || 0;
  const hasValidInputs = selectedDebts.length > 0;

  // Compute results for both strategies
  const snowballResult = useMemo(() => {
    if (!hasValidInputs) return null;
    return calculateDebtPayoff(selectedDebts, "snowball", extraPaymentNum);
  }, [selectedDebts, extraPaymentNum, hasValidInputs]);

  const avalancheResult = useMemo(() => {
    if (!hasValidInputs) return null;
    return calculateDebtPayoff(selectedDebts, "avalanche", extraPaymentNum);
  }, [selectedDebts, extraPaymentNum, hasValidInputs]);

  const activeResult = strategy === "snowball" ? snowballResult : avalancheResult;

  // Determine which strategy saves more
  const snowballInterest = snowballResult?.totalInterest ?? 0;
  const avalancheInterest = avalancheResult?.totalInterest ?? 0;
  const cheaperStrategy: Strategy | null =
    snowballResult && avalancheResult
      ? snowballInterest < avalancheInterest
        ? "snowball"
        : "avalanche"
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <p className="text-text-muted text-sm">
        Plan your debt payoff with snowball or avalanche strategies.
      </p>

      {/* Step 1: Select Debts */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : debtAccounts.length === 0 ? (
        <EmptyState
          character="rosie"
          expression="thinking"
          title="No debts found"
          description="Add credit card or loan accounts first to use the debt planner."
        />
      ) : (
        <>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Step 1: Select Debts
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {debtAccounts.map((account) => {
                const isSelected = selectedIds.has(account.id);
                const inputs = debtInputs.get(account.id);
                const balance = Math.abs(parseFloat(account.balance ?? "0"));

                return (
                  <div
                    key={account.id}
                    className={cn(
                      "glass-card rounded-2xl p-4 flex flex-col gap-3 transition-all",
                      isSelected ? "ring-2 ring-accent" : "opacity-70"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDebt(account.id)}
                        className="h-4 w-4 rounded border-white/20 text-accent accent-accent"
                        aria-label={`Select ${account.name}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text truncate">{account.name}</p>
                        <p className="text-xs text-text-muted capitalize">{account.type?.replace("_", " ")}</p>
                      </div>
                    </div>

                    <p className="text-lg font-bold text-red-400 font-display">
                      {formatCurrency(balance)}
                    </p>

                    {isSelected && (
                      <div className="flex flex-col gap-2">
                        <div>
                          <label className="text-xs text-text-muted" htmlFor={`apr-${account.id}`}>
                            APR (%)
                          </label>
                          <input
                            id={`apr-${account.id}`}
                            type="text"
                            inputMode="decimal"
                            value={inputs?.apr ?? ""}
                            onChange={(e) => updateDebtInput(account.id, "apr", e.target.value)}
                            className="orbyt-input mt-0.5 w-full text-sm"
                            placeholder="e.g. 22.99"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-text-muted" htmlFor={`min-${account.id}`}>
                            Min. Monthly Payment ($)
                          </label>
                          <input
                            id={`min-${account.id}`}
                            type="text"
                            inputMode="decimal"
                            value={inputs?.minPayment ?? ""}
                            onChange={(e) => updateDebtInput(account.id, "minPayment", e.target.value)}
                            className="orbyt-input mt-0.5 w-full text-sm"
                            placeholder="e.g. 50.00"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Strategy + Extra Payment */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Step 2: Choose Strategy
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStrategy("snowball")}
                className={cn(
                  "glass-card rounded-2xl p-4 text-left transition-all",
                  strategy === "snowball"
                    ? "ring-2 ring-accent"
                    : "hover:ring-1 hover:ring-accent/30"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span aria-label="Snowball strategy"><Snowflake size={20} className="text-accent" /></span>
                  <p className="font-semibold text-text">Snowball</p>
                </div>
                <p className="text-xs text-text-muted">
                  Pay off smallest balance first for quick wins
                </p>
              </button>
              <button
                type="button"
                onClick={() => setStrategy("avalanche")}
                className={cn(
                  "glass-card rounded-2xl p-4 text-left transition-all",
                  strategy === "avalanche"
                    ? "ring-2 ring-accent"
                    : "hover:ring-1 hover:ring-accent/30"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span aria-label="Avalanche strategy"><TrendingDown size={20} className="text-accent" /></span>
                  <p className="font-semibold text-text">Avalanche</p>
                </div>
                <p className="text-xs text-text-muted">
                  Pay off highest interest first to save money
                </p>
              </button>
            </div>

            <div className="mt-4 max-w-xs">
              <label className="orbyt-label" htmlFor="extra-payment">
                Extra Monthly Payment
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                  $
                </span>
                <input
                  id="extra-payment"
                  type="text"
                  inputMode="decimal"
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(e.target.value)}
                  className="orbyt-input w-full pl-7"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Additional monthly payment above minimums
              </p>
            </div>
          </div>

          {/* Step 3: Results */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Step 3: Results
            </h3>

            {!hasValidInputs ? (
              <div className="glass-card-subtle rounded-2xl p-6 text-center">
                <p className="text-sm text-text-muted">
                  Select debts and enter APR + minimum payment to see payoff projections.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Strategy Comparison */}
                {snowballResult && avalancheResult && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ComparisonCard
                      title="Snowball"
                      months={snowballResult.months}
                      totalInterest={snowballResult.totalInterest}
                      totalPaid={snowballResult.totalPaid}
                      isHighlighted={cheaperStrategy === "snowball"}
                      interestSaved={
                        cheaperStrategy === "snowball"
                          ? avalancheInterest - snowballInterest
                          : 0
                      }
                    />
                    <ComparisonCard
                      title="Avalanche"
                      months={avalancheResult.months}
                      totalInterest={avalancheResult.totalInterest}
                      totalPaid={avalancheResult.totalPaid}
                      isHighlighted={cheaperStrategy === "avalanche"}
                      interestSaved={
                        cheaperStrategy === "avalanche"
                          ? snowballInterest - avalancheInterest
                          : 0
                      }
                    />
                  </div>
                )}

                {/* Active strategy summary */}
                {activeResult && (
                  <div className="glass-card rounded-2xl p-5">
                    <h4 className="mb-3 text-sm font-semibold text-text">
                      {strategy === "snowball" ? "Snowball" : "Avalanche"} Plan Summary
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-text-muted">Months to Payoff</p>
                        <p className="text-xl font-bold text-accent font-display">
                          {activeResult.months}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Total Interest</p>
                        <p className="text-xl font-bold text-red-400 font-display">
                          {formatCurrency(activeResult.totalInterest)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Total Paid</p>
                        <p className="text-xl font-bold text-text font-display">
                          {formatCurrency(activeResult.totalPaid)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payoff timeline table */}
                {activeResult && activeResult.timeline.length > 0 && (
                  <div className="glass-card rounded-2xl p-5">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
                      Payoff Timeline
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="py-2 pr-4 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                              Month
                            </th>
                            {selectedDebts.map((d) => (
                              <th
                                key={d.name}
                                className="py-2 px-3 text-right text-xs font-medium uppercase tracking-wider text-text-muted"
                              >
                                {d.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeResult.timeline
                            .slice(0, 12)
                            .map((row) => (
                              <tr key={row.month} className="border-b border-white/5 last:border-0">
                                <td className="py-2 pr-4 text-text font-medium">{row.month}</td>
                                {row.debts.map((d) => (
                                  <td
                                    key={d.name}
                                    className={cn(
                                      "py-2 px-3 text-right",
                                      d.remaining === 0 ? "text-green-400" : "text-text-muted"
                                    )}
                                  >
                                    {d.remaining === 0 ? "Paid off" : formatCurrency(d.remaining)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {activeResult.timeline.length > 12 && (
                        <p className="mt-2 text-xs text-text-muted text-center">
                          Showing first 12 of {activeResult.timeline.length} months
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── ComparisonCard ───────────────────────────────────────────────────────────

function ComparisonCard({
  title,
  months,
  totalInterest,
  totalPaid,
  isHighlighted,
  interestSaved,
}: {
  title: string;
  months: number;
  totalInterest: number;
  totalPaid: number;
  isHighlighted: boolean;
  interestSaved: number;
}) {
  return (
    <div
      className={cn(
        "glass-card rounded-2xl p-4 flex flex-col gap-2",
        isHighlighted && "border border-accent/30"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold text-text">{title}</p>
        {isHighlighted && (
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
            Best
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Months</span>
          <span className="font-medium text-text">{months}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Total Interest</span>
          <span className="font-medium text-red-400">{formatCurrency(totalInterest)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Total Paid</span>
          <span className="font-medium text-text">{formatCurrency(totalPaid)}</span>
        </div>
        {isHighlighted && interestSaved > 0 && (
          <div className="flex justify-between mt-1 pt-1 border-t border-white/10">
            <span className="text-text-muted">Interest Saved</span>
            <span className="font-semibold text-green-400">{formatCurrency(interestSaved)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
