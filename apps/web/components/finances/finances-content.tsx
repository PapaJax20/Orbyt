"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  PieChart,
  Receipt,
  Target,
} from "lucide-react";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountsTab } from "./accounts-tab";
import { TransactionsTab } from "./transactions-tab";
import { BudgetsTab } from "./budgets-tab";
import { BillsTab } from "./bills-tab";
import { GoalsTab } from "./goals-tab";

// ── Types ──────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type FinancialOverview = RouterOutput["finances"]["getFinancialOverview"];
type BudgetProgress = RouterOutput["finances"]["getBudgetProgress"][number];
type GoalItem = RouterOutput["finances"]["listGoals"][number];
type TransactionItem = RouterOutput["finances"]["listTransactions"]["transactions"][number];
type UpcomingBill = RouterOutput["finances"]["getUpcoming"][number];

// ── Utilities ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

// ── Tab definitions ──────────────────────────────────────────────────────────

type TabId = "overview" | "accounts" | "transactions" | "budgets" | "bills" | "goals";

const TABS: { id: TabId; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "accounts", label: "Accounts", icon: Building2 },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "budgets", label: "Budgets", icon: PieChart },
  { id: "bills", label: "Bills", icon: Receipt },
  { id: "goals", label: "Goals", icon: Target },
];

// ── Overview Stat Card ───────────────────────────────────────────────────────

function OverviewStatCard({
  title,
  value,
  valueClassName,
}: {
  title: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="glass-card-subtle rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{title}</p>
      <p className={cn("text-2xl font-bold font-display text-text", valueClassName)}>{value}</p>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: overview, isLoading: overviewLoading } =
    trpc.finances.getFinancialOverview.useQuery({ month: currentMonth });

  const { data: budgetProgress, isLoading: budgetsLoading } =
    trpc.finances.getBudgetProgress.useQuery({ month: currentMonth });

  const { data: upcomingBills, isLoading: billsLoading } =
    trpc.finances.getUpcoming.useQuery({ daysAhead: 30 });

  const { data: recentTxData, isLoading: txLoading } =
    trpc.finances.listTransactions.useQuery({ limit: 5, offset: 0 });

  const { data: goals, isLoading: goalsLoading } =
    trpc.finances.listGoals.useQuery();

  const recentTransactions = recentTxData?.transactions ?? [];
  const topBudgets = (budgetProgress ?? []).slice(0, 4);
  const topBills = (upcomingBills ?? []).slice(0, 3);
  const topGoals = (goals ?? []).slice(0, 3);

  const availableToSpend = parseFloat(overview?.availableToSpend ?? "0");

  return (
    <div className="flex flex-col gap-6">
      {/* Top row: 4 stat cards */}
      {overviewLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewStatCard
            title="Total Balance"
            value={formatCurrency(overview?.totalBalance ?? "0")}
          />
          <OverviewStatCard
            title="Income This Month"
            value={formatCurrency(overview?.monthlyIncome ?? "0")}
            valueClassName="text-green-400"
          />
          <OverviewStatCard
            title="Expenses This Month"
            value={formatCurrency(overview?.monthlyExpenses ?? "0")}
            valueClassName="text-red-400"
          />
          <OverviewStatCard
            title="Available to Spend"
            value={formatCurrency(overview?.availableToSpend ?? "0")}
            valueClassName={availableToSpend >= 0 ? "text-green-400" : "text-red-400"}
          />
        </div>
      )}

      {/* Middle row: Budget progress + Upcoming bills */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Budget progress */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
            Budget Progress
          </h3>
          {budgetsLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : topBudgets.length === 0 ? (
            <EmptyState
              character="rosie"
              expression="thinking"
              title="No budgets yet"
              description="Set up budgets to track spending"
              compact
            />
          ) : (
            <div className="flex flex-col gap-4">
              {topBudgets.map((budget) => {
                const percentage = budget.percentage;
                const barColor =
                  percentage > 90
                    ? "bg-red-500"
                    : percentage > 70
                    ? "bg-yellow-500"
                    : "bg-green-500";
                return (
                  <div key={budget.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-text capitalize">{budget.category}</p>
                      <p className="text-xs text-text-muted">
                        {formatCurrency(budget.spent)} / {formatCurrency(budget.monthlyLimit)}
                      </p>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden bg-white/10">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", barColor)}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming bills */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
            Upcoming Bills
          </h3>
          {billsLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : topBills.length === 0 ? (
            <EmptyState
              character="rosie"
              expression="happy"
              title="No upcoming bills"
              description="All bills are taken care of"
              compact
            />
          ) : (
            <div className="flex flex-col gap-2">
              {topBills.map((bill) => (
                <div
                  key={bill.id}
                  className="glass-card-subtle flex items-center justify-between rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{bill.name}</p>
                    <p className="text-xs text-text-muted">
                      Due {bill.nextDueDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-accent">
                    {formatCurrency(bill.amount, bill.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Recent transactions + Savings goals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent transactions */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
            Recent Transactions
          </h3>
          {txLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <EmptyState
              character="rosie"
              expression="thinking"
              title="No transactions yet"
              description="Add transactions to see them here"
              compact
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="glass-card-subtle flex items-center justify-between rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{tx.description}</p>
                    <p className="text-xs text-text-muted">
                      {new Date(tx.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <p className={cn(
                    "text-sm font-semibold",
                    tx.type === "income"
                      ? "text-green-400"
                      : tx.type === "transfer"
                      ? "text-blue-400"
                      : "text-red-400"
                  )}>
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                    {formatCurrency(tx.amount, tx.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Savings goals */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
            Savings Goals
          </h3>
          {goalsLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : topGoals.length === 0 ? (
            <EmptyState
              character="rosie"
              expression="thinking"
              title="No goals yet"
              description="Create savings goals to track progress"
              compact
            />
          ) : (
            <div className="flex flex-col gap-4">
              {topGoals.map((goal) => {
                const current = parseFloat(goal.currentAmount ?? "0");
                const target = parseFloat(goal.targetAmount ?? "0");
                const percentage = goal.progressPercent;
                return (
                  <div key={goal.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-text">
                        {goal.emoji ? `${goal.emoji} ` : ""}{goal.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {Math.round(percentage)}%
                      </p>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          percentage >= 100 ? "bg-green-500" : "bg-accent"
                        )}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-text-muted">
                      {formatCurrency(current)} / {formatCurrency(target)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FinancesContent (main export) ────────────────────────────────────────────

export function FinancesContent() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      {/* Page header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-text">Finances</h1>
        <p className="mt-1 text-text-muted">
          Manage accounts, budgets, bills, and savings goals for your household.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface/30 p-1">
        {TABS.map((tab) => {
          const IconComp = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text"
              )}
            >
              <IconComp size={16} className="shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "accounts" && <AccountsTab />}
      {activeTab === "transactions" && <TransactionsTab />}
      {activeTab === "budgets" && <BudgetsTab />}
      {activeTab === "bills" && <BillsTab />}
      {activeTab === "goals" && <GoalsTab />}
    </motion.div>
  );
}
