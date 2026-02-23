"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

// Dynamic import recharts for bundle performance
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const PieChart = dynamic(
  () => import("recharts").then((m) => m.PieChart),
  { ssr: false }
);
const Pie = dynamic(
  () => import("recharts").then((m) => m.Pie),
  { ssr: false }
);
const Cell = dynamic(
  () => import("recharts").then((m) => m.Cell),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const Legend = dynamic(
  () => import("recharts").then((m) => m.Legend),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((m) => m.Line),
  { ssr: false }
);
const ReferenceLine = dynamic(
  () => import("recharts").then((m) => m.ReferenceLine),
  { ssr: false }
);

// ── Helpers ────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

// Category colors for pie chart
const CATEGORY_COLORS: Record<string, string> = {
  housing: "#6366f1",
  utilities: "#f59e0b",
  groceries: "#10b981",
  dining: "#ef4444",
  transportation: "#3b82f6",
  healthcare: "#ec4899",
  insurance: "#8b5cf6",
  entertainment: "#f97316",
  shopping: "#14b8a6",
  education: "#06b6d4",
  personal: "#a855f7",
  gifts: "#f43f5e",
  subscriptions: "#84cc16",
  savings: "#22d3ee",
  other: "#6b7280",
};

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatMonthLong(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ── Trend Period Options ───────────────────────────────────────────────────

const TREND_PERIODS = [
  { label: "3mo", value: 3 },
  { label: "6mo", value: 6 },
  { label: "12mo", value: 12 },
] as const;

// ── AnalyticsTab ───────────────────────────────────────────────────────────

export function AnalyticsTab() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [trendPeriod, setTrendPeriod] = useState<number>(6);

  // ── Queries ────────────────────────────────────────────────────────────

  const { data: spendingData, isLoading: spendingLoading } =
    trpc.finances.getSpendingByCategory.useQuery({ month: selectedMonth });

  const { data: trendData, isLoading: trendLoading } =
    trpc.finances.getMonthlyTrend.useQuery({ months: trendPeriod });

  const { data: budgetData, isLoading: budgetLoading } =
    trpc.finances.getBudgetProgress.useQuery({ month: selectedMonth });

  // ── Derived data ───────────────────────────────────────────────────────

  const pieData = useMemo(() => {
    if (!spendingData || spendingData.length === 0) return [];
    const total = spendingData.reduce((sum, item) => sum + parseFloat(item.total), 0);
    return spendingData.map((item) => ({
      name: item.category,
      value: parseFloat(item.total),
      count: item.count,
      percentage: total > 0 ? ((parseFloat(item.total) / total) * 100).toFixed(1) : "0",
      color: CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.other,
    }));
  }, [spendingData]);

  const barData = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];
    return trendData.map((item) => ({
      month: formatMonth(item.month),
      income: parseFloat(item.income),
      expenses: parseFloat(item.expenses),
    }));
  }, [trendData]);

  const lineData = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];
    return trendData.map((item) => ({
      month: formatMonth(item.month),
      net: parseFloat(item.net),
    }));
  }, [trendData]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      {/* Month selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
            className="orbyt-button-ghost p-2"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <span aria-label="Calendar" className="text-accent">
              <Calendar className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-text">
              {formatMonthLong(selectedMonth)}
            </span>
          </div>
          <button
            onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
            disabled={selectedMonth >= currentMonth}
            className="orbyt-button-ghost p-2 disabled:opacity-40"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Trend period selector */}
        <div className="flex items-center gap-1 rounded-lg bg-surface/30 p-1">
          {TREND_PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setTrendPeriod(p.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                trendPeriod === p.value
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1: Spending by Category */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <span aria-label="Spending by category" className="text-accent">
            <PieChartIcon className="h-5 w-5" />
          </span>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Spending by Category
          </h3>
        </div>

        {spendingLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="mx-auto h-64 w-64 rounded-full" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 rounded-lg" />
              ))}
            </div>
          </div>
        ) : pieData.length === 0 ? (
          <EmptyState
            character="rosie"
            expression="thinking"
            title="No spending data for this month"
            description="Add some expense transactions to see your spending breakdown."
            compact
          />
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            {/* Pie chart */}
            <div className="mx-auto w-full max-w-xs lg:mx-0">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 15, 20, 0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#e0e0e0",
                      fontSize: "13px",
                    }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend list */}
            <div className="flex flex-1 flex-col gap-2">
              {pieData.map((entry) => (
                <div
                  key={entry.name}
                  className="glass-card-subtle flex items-center justify-between rounded-xl px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm font-medium capitalize text-text">
                      {entry.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-text">
                      {formatCurrency(entry.value)}
                    </span>
                    <span className="text-xs text-text-muted">
                      {entry.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Income vs Expenses */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <span aria-label="Income vs expenses" className="text-accent">
            <BarChart3 className="h-5 w-5" />
          </span>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Income vs Expenses
          </h3>
        </div>

        {trendLoading ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : barData.length === 0 ? (
          <EmptyState
            character="rosie"
            expression="thinking"
            title="No trend data available"
            description="Add transactions over multiple months to see trends."
            compact
          />
        ) : (
          <div className="w-full">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 15, 20, 0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#e0e0e0",
                    fontSize: "13px",
                  }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
                />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Section 3: Net Cash Flow */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <span aria-label="Net cash flow" className="text-accent">
            <TrendingUp className="h-5 w-5" />
          </span>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Net Cash Flow
          </h3>
        </div>

        {trendLoading ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : lineData.length === 0 ? (
          <EmptyState
            character="rosie"
            expression="thinking"
            title="No cash flow data available"
            description="Add income and expense transactions to see your net cash flow."
            compact
          />
        ) : (
          <div className="w-full">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 15, 20, 0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#e0e0e0",
                    fontSize: "13px",
                  }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Net Cash Flow"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={{ fill: "#8b5cf6", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Section 4: Budget vs Actual */}
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <span aria-label="Budget vs actual" className="text-accent">
            <BarChart3 className="h-5 w-5" />
          </span>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Budget vs Actual
          </h3>
        </div>

        {budgetLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : !budgetData || budgetData.length === 0 ? (
          <EmptyState
            character="rosie"
            expression="thinking"
            title="No budgets set up"
            description="Create budgets to compare your spending against your limits."
            compact
          />
        ) : (
          <div className="flex flex-col gap-3">
            {budgetData.map((budget) => {
              const spent = parseFloat(budget.spent);
              const limit = parseFloat(budget.monthlyLimit ?? "0");
              const percentage = budget.percentage;
              const maxVal = Math.max(spent, limit);

              const barColor =
                percentage > 100
                  ? "bg-red-500"
                  : percentage >= 80
                  ? "bg-yellow-500"
                  : "bg-green-500";

              const textColor =
                percentage > 100
                  ? "text-red-400"
                  : percentage >= 80
                  ? "text-yellow-400"
                  : "text-green-400";

              const spentWidth = maxVal > 0 ? (spent / maxVal) * 100 : 0;
              const limitWidth = maxVal > 0 ? (limit / maxVal) * 100 : 0;

              return (
                <div
                  key={budget.id}
                  className="glass-card-subtle rounded-xl px-4 py-3"
                >
                  {/* Top row: category + percentage */}
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium capitalize text-text">
                      {budget.category}
                    </p>
                    <span className={cn("text-xs font-semibold", textColor)}>
                      {Math.round(percentage)}%
                    </span>
                  </div>

                  {/* Bar comparison */}
                  <div className="relative h-4 w-full rounded-full bg-white/5">
                    {/* Spent bar */}
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                        barColor
                      )}
                      style={{ width: `${Math.min(spentWidth, 100)}%` }}
                    />
                    {/* Budget limit marker */}
                    {limitWidth > 0 && limitWidth <= 100 && (
                      <div
                        className="absolute top-0 h-full w-0.5 bg-white/40"
                        style={{ left: `${limitWidth}%` }}
                      />
                    )}
                  </div>

                  {/* Bottom row: spent vs limit */}
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-xs text-text-muted">
                      {formatCurrency(spent)} spent
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatCurrency(limit)} budget
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
