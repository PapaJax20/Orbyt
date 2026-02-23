"use client";

import { useState } from "react";
import {
  Plus,
  Building2,
  PiggyBank,
  CreditCard,
  Landmark,
  TrendingUp,
  Wallet,
  HelpCircle,
} from "lucide-react";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountDrawer } from "./account-drawer";

// ── Types ──────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type AccountList = RouterOutput["finances"]["listAccounts"];
type Account = AccountList["accounts"][number];

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

// ── Constants ────────────────────────────────────────────────────────────────

type AccountType = "checking" | "savings" | "credit_card" | "loan" | "investment" | "cash" | "other";

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

// ── AccountCard ──────────────────────────────────────────────────────────────

function AccountCard({ account, onClick }: { account: Account; onClick: () => void }) {
  const accountType = (account.type as AccountType) ?? "other";
  const IconComp = ACCOUNT_TYPE_ICONS[accountType] ?? HelpCircle;
  const balance = parseFloat(account.balance ?? "0");

  return (
    <button
      onClick={onClick}
      className="glass-card glass-card-hover rounded-2xl p-4 text-left transition-all flex flex-col gap-3 w-full"
    >
      {/* Top row: icon + type */}
      <div className="flex items-start justify-between gap-2">
        <div className="rounded-xl bg-white/5 p-2 text-accent">
          <IconComp size={20} />
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-text-muted capitalize">
            {ACCOUNT_TYPE_LABELS[accountType]}
          </span>
          {account.ownership && account.ownership !== "ours" && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent capitalize">
              {account.ownership}
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <div>
        <p className="font-semibold text-text leading-tight">{account.name}</p>
        {account.institution && (
          <p className="text-xs text-text-muted mt-0.5">{account.institution}</p>
        )}
      </div>

      {/* Balance */}
      <p className={cn(
        "text-xl font-bold font-display",
        balance >= 0 ? "text-accent" : "text-red-400"
      )}>
        {formatCurrency(account.balance, account.currency)}
      </p>

      {/* Last 4 digits */}
      {account.accountNumber && (
        <p className="text-xs text-text-muted">****{account.accountNumber}</p>
      )}
    </button>
  );
}

function AccountCardSkeleton() {
  return <Skeleton className="h-40 rounded-2xl" />;
}

// ── AccountsTab (main export) ────────────────────────────────────────────────

export function AccountsTab() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { data, isLoading } = trpc.finances.listAccounts.useQuery();

  function openCreate() {
    setSelectedAccountId(null);
    setDrawerOpen(true);
  }

  function openAccount(id: string) {
    setSelectedAccountId(id);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setSelectedAccountId(null), 300);
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-text-muted text-sm">
              Manage your bank accounts, credit cards, and other financial accounts.
            </p>
          </div>
          <button onClick={openCreate} className="orbyt-button-accent flex items-center gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        </div>

        {/* Total Balance Stat */}
        {!isLoading && data && data.accounts.length > 0 && (
          <div className="glass-card rounded-2xl p-6 flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Total Balance</p>
            <p className={cn(
              "text-2xl font-bold font-display",
              data.totalBalance >= 0 ? "text-accent" : "text-red-400"
            )}>
              {formatCurrency(data.totalBalance)}
            </p>
          </div>
        )}

        {/* Account Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <AccountCardSkeleton key={i} />
            ))}
          </div>
        ) : !data || data.accounts.length === 0 ? (
          <EmptyState
            character="rosie"
            expression="thinking"
            title="No accounts set up yet."
            description="Add your bank accounts and credit cards to track balances."
            actionLabel="Add Account"
            onAction={openCreate}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onClick={() => openAccount(account.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Account Drawer */}
      <AccountDrawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        accountId={selectedAccountId}
      />
    </>
  );
}
