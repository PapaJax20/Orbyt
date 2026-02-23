"use client";

import { useState } from "react";
import {
  Plus,
  Home,
  Zap,
  Shield,
  Tv,
  UtensilsCrossed,
  Car,
  Wifi,
  Droplets,
  Phone,
  CreditCard,
} from "lucide-react";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BillDrawer } from "./bill-drawer";

// ── Types ──────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type Bill = RouterOutput["finances"]["listBills"][number];
type MonthlyOverview = RouterOutput["finances"]["getMonthlyOverview"];

// ── Utilities ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

// ── Category Icons ─────────────────────────────────────────────────────────────

type IconComponent = React.FC<{ size?: number; className?: string }>;

const CATEGORY_ICONS: Record<string, IconComponent> = {
  housing: Home,
  utilities: Zap,
  insurance: Shield,
  subscriptions: Tv,
  food: UtensilsCrossed,
  transport: Car,
  transportation: Car,
  internet: Wifi,
  water: Droplets,
  phone: Phone,
  other: CreditCard,
  healthcare: CreditCard,
};

const CATEGORY_COLORS: Record<string, string> = {
  housing: "text-blue-400",
  utilities: "text-yellow-400",
  insurance: "text-purple-400",
  subscriptions: "text-pink-400",
  food: "text-orange-400",
  transport: "text-cyan-400",
  transportation: "text-cyan-400",
  internet: "text-indigo-400",
  water: "text-sky-400",
  phone: "text-green-400",
  other: "text-text-muted",
  healthcare: "text-red-400",
};

// ── StatCard ───────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  valueClassName,
}: {
  title: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{title}</p>
      <p className={cn("text-2xl font-bold font-display text-text", valueClassName)}>{value}</p>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <Skeleton className="h-24 rounded-2xl" />
  );
}

// ── BillCard ───────────────────────────────────────────────────────────────────

function BillCard({ bill, onClick }: { bill: Bill; onClick: () => void }) {
  const IconComp = CATEGORY_ICONS[bill.category] ?? CreditCard;
  const iconColor = CATEGORY_COLORS[bill.category] ?? "text-text-muted";
  const isOverdue = bill.currentStatus === "overdue";

  return (
    <button
      onClick={onClick}
      className={cn(
        "glass-card glass-card-hover rounded-2xl p-4 text-left transition-all flex flex-col gap-3 w-full",
        isOverdue && "ring-1 ring-red-500/50",
      )}
    >
      {/* Top row: icon + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className={cn("rounded-xl bg-white/5 p-2", iconColor)}>
          <IconComp size={20} className={iconColor} />
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          {bill.autoPay && (
            <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-500">
              Auto-pay
            </span>
          )}
          {bill.currency !== "USD" && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-text-muted">
              {bill.currency}
            </span>
          )}
          {isOverdue && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-500">
              Overdue
            </span>
          )}
          {!isOverdue && bill.currentStatus === "upcoming" && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-text-muted">
              Due soon
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <div>
        <p className="font-semibold text-text leading-tight">{bill.name}</p>
        <p className="text-xs text-text-muted mt-0.5">Due day {bill.dueDay}</p>
      </div>

      {/* Amount */}
      <p className="text-xl font-bold text-accent font-display">
        {formatCurrency(bill.amount, bill.currency)}
      </p>

      {/* Last paid */}
      {bill.lastPayment && (
        <p className="text-xs text-text-muted">
          Last paid {new Date(bill.lastPayment.paidAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}
    </button>
  );
}

function BillCardSkeleton() {
  return <Skeleton className="h-40 rounded-2xl" />;
}

// ── BillsTab (main export) ──────────────────────────────────────────────────

export function BillsTab() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: bills, isLoading: billsLoading } = trpc.finances.listBills.useQuery();
  const { data: overview, isLoading: overviewLoading } =
    trpc.finances.getMonthlyOverview.useQuery({ month: currentMonth });

  const isLoading = billsLoading || overviewLoading;

  function openCreate() {
    setSelectedBillId(null);
    setDrawerOpen(true);
  }

  function openBill(id: string) {
    setSelectedBillId(id);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setSelectedBillId(null), 300);
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header with Add Bill button */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-text-muted text-sm">
            Track bills, subscriptions, and recurring payments.
          </p>
          <button onClick={openCreate} className="orbyt-button-accent flex items-center gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add Bill
          </button>
        </div>

        {/* Stat Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Total Monthly"
              value={formatCurrency(overview?.totalBilled ?? 0)}
            />
            <StatCard
              title="Paid This Month"
              value={formatCurrency(overview?.totalPaid ?? 0)}
              valueClassName="text-green-500"
            />
            <StatCard
              title="Outstanding"
              value={formatCurrency(overview?.totalPending ?? 0)}
              valueClassName={(overview?.totalPending ?? 0) > 0 ? "text-red-500" : undefined}
            />
          </div>
        )}

        {/* Bill Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <BillCardSkeleton key={i} />
            ))}
          </div>
        ) : !bills || bills.length === 0 ? (
          <EmptyState
            character="rosie"
            expression="thinking"
            title="No bills being tracked."
            description="Add your household bills and I'll keep an eye on what's due."
            actionLabel="Add Bill"
            onAction={openCreate}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bills.map((bill) => (
              <BillCard key={bill.id} bill={bill} onClick={() => openBill(bill.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Bill Drawer */}
      <BillDrawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        billId={selectedBillId}
        currentMonth={currentMonth}
      />
    </>
  );
}
