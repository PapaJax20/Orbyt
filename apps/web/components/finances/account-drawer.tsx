"use client";

import { useState } from "react";
import { Pencil, Trash2, Building2, PiggyBank, CreditCard, Landmark, TrendingUp, Wallet, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";

type RouterOutput = inferRouterOutputs<AppRouter>;
type AccountDetail = NonNullable<RouterOutput["finances"]["getAccountById"]>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit_card",
  "loan",
  "investment",
  "cash",
  "other",
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  loan: "Loan",
  investment: "Investment",
  cash: "Cash",
  other: "Other",
};

const ACCOUNT_TYPE_ICONS: Record<AccountType, React.FC<{ size?: number; className?: string }>> = {
  checking: Building2,
  savings: PiggyBank,
  credit_card: CreditCard,
  loan: Landmark,
  investment: TrendingUp,
  cash: Wallet,
  other: HelpCircle,
};

type Ownership = "mine" | "theirs" | "ours";

// ── Account Form Fields ──────────────────────────────────────────────────────

function AccountFormFields({
  name,
  setName,
  type,
  setType,
  balance,
  setBalance,
  currency,
  setCurrency,
  institution,
  setInstitution,
  accountNumber,
  setAccountNumber,
  ownership,
  setOwnership,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  name: string;
  setName: (v: string) => void;
  type: AccountType;
  setType: (v: AccountType) => void;
  balance: string;
  setBalance: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  institution: string;
  setInstitution: (v: string) => void;
  accountNumber: string;
  setAccountNumber: (v: string) => void;
  ownership: Ownership;
  setOwnership: (v: Ownership) => void;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 pb-6">
      {/* Name */}
      <div>
        <label className="orbyt-label" htmlFor="account-name">Account Name</label>
        <input
          id="account-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="orbyt-input mt-1 w-full"
          placeholder="e.g. Main Checking"
          required
          maxLength={100}
        />
      </div>

      {/* Type */}
      <div>
        <label className="orbyt-label" htmlFor="account-type">Type</label>
        <select
          id="account-type"
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          className="orbyt-input mt-1 w-full"
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Balance + Currency */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="orbyt-label" htmlFor="account-balance">Balance</label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              $
            </span>
            <input
              id="account-balance"
              type="text"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="orbyt-input w-full pl-7"
              placeholder="0.00"
              required
            />
          </div>
        </div>
        <div>
          <label className="orbyt-label" htmlFor="account-currency">Currency</label>
          <select
            id="account-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="orbyt-input mt-1 w-full"
          >
            {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Institution */}
      <div>
        <label className="orbyt-label" htmlFor="account-institution">
          Institution <span className="text-text-muted">(optional)</span>
        </label>
        <input
          id="account-institution"
          type="text"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          className="orbyt-input mt-1 w-full"
          placeholder="e.g. Chase, Wells Fargo"
          maxLength={100}
        />
      </div>

      {/* Last 4 digits */}
      <div>
        <label className="orbyt-label" htmlFor="account-number">
          Last 4 Digits <span className="text-text-muted">(optional)</span>
        </label>
        <input
          id="account-number"
          type="text"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className="orbyt-input mt-1 w-full"
          placeholder="1234"
          maxLength={4}
        />
      </div>

      {/* Ownership */}
      <div>
        <label className="orbyt-label">Ownership</label>
        <div className="mt-1 flex gap-2">
          {(["mine", "theirs", "ours"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOwnership(o)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                ownership === o
                  ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                  : "bg-surface/50 text-text-muted hover:text-text"
              )}
            >
              {o === "mine" ? "Mine" : o === "theirs" ? "Theirs" : "Ours"}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || !name.trim() || !balance.trim()}
          className="orbyt-button-accent flex-1"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="orbyt-button-ghost flex-1"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ── Create Form ──────────────────────────────────────────────────────────────

function CreateAccountForm({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [balance, setBalance] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [institution, setInstitution] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ownership, setOwnership] = useState<Ownership>("ours");

  const createAccount = trpc.finances.createAccount.useMutation({
    onSuccess: () => {
      utils.finances.listAccounts.invalidate();
      utils.finances.getFinancialOverview.invalidate();
      toast.success("Account added");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create account");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedBalance = balance.trim();
    if (!trimmedBalance || !/^-?\d+(\.\d{1,2})?$/.test(trimmedBalance)) {
      toast.error("Enter a valid balance (e.g., 1500.00)");
      return;
    }
    createAccount.mutate({
      name: name.trim(),
      type,
      balance: trimmedBalance,
      currency,
      institution: institution.trim() || null,
      accountNumber: accountNumber.trim() || null,
      ownership,
    });
  }

  return (
    <AccountFormFields
      name={name}
      setName={setName}
      type={type}
      setType={setType}
      balance={balance}
      setBalance={setBalance}
      currency={currency}
      setCurrency={setCurrency}
      institution={institution}
      setInstitution={setInstitution}
      accountNumber={accountNumber}
      setAccountNumber={setAccountNumber}
      ownership={ownership}
      setOwnership={setOwnership}
      submitLabel="Add Account"
      isPending={createAccount.isPending}
      onSubmit={handleSubmit}
    />
  );
}

// ── Edit Form ────────────────────────────────────────────────────────────────

function EditAccountForm({
  account,
  onCancel,
}: {
  account: AccountDetail;
  onCancel: () => void;
}) {
  const utils = trpc.useUtils();

  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>((account.type as AccountType) ?? "checking");
  const [balance, setBalance] = useState(account.balance ?? "0");
  const [currency, setCurrency] = useState(account.currency ?? "USD");
  const [institution, setInstitution] = useState(account.institution ?? "");
  const [accountNumber, setAccountNumber] = useState(account.accountNumber ?? "");
  const [ownership, setOwnership] = useState<Ownership>((account.ownership as Ownership) ?? "ours");

  const updateAccount = trpc.finances.updateAccount.useMutation({
    onSuccess: () => {
      utils.finances.listAccounts.invalidate();
      utils.finances.getAccountById.invalidate({ id: account.id });
      utils.finances.getFinancialOverview.invalidate();
      toast.success("Account updated");
      onCancel();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update account");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedBalance = balance.trim();
    if (!trimmedBalance || !/^-?\d+(\.\d{1,2})?$/.test(trimmedBalance)) {
      toast.error("Enter a valid balance (e.g., 1500.00)");
      return;
    }
    updateAccount.mutate({
      id: account.id,
      data: {
        name: name.trim(),
        type,
        balance: trimmedBalance,
        currency,
        institution: institution.trim() || null,
        accountNumber: accountNumber.trim() || null,
        ownership,
      },
    });
  }

  return (
    <AccountFormFields
      name={name}
      setName={setName}
      type={type}
      setType={setType}
      balance={balance}
      setBalance={setBalance}
      currency={currency}
      setCurrency={setCurrency}
      institution={institution}
      setInstitution={setInstitution}
      accountNumber={accountNumber}
      setAccountNumber={setAccountNumber}
      ownership={ownership}
      setOwnership={setOwnership}
      submitLabel="Save Changes"
      isPending={updateAccount.isPending}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
  );
}

// ── View Account ─────────────────────────────────────────────────────────────

function ViewAccount({
  account,
  onClose,
  onEdit,
}: {
  account: AccountDetail;
  onClose: () => void;
  onEdit: () => void;
}) {
  const utils = trpc.useUtils();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const IconComp = ACCOUNT_TYPE_ICONS[(account.type as AccountType) ?? "other"] ?? HelpCircle;
  const balance = parseFloat(account.balance ?? "0");

  const deleteAccount = trpc.finances.deleteAccount.useMutation({
    onSuccess: () => {
      utils.finances.listAccounts.invalidate();
      utils.finances.getFinancialOverview.invalidate();
      toast.success("Account archived");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to archive account");
    },
  });

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Account info */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/5 p-2 text-accent">
              <IconComp size={20} />
            </div>
            <div>
              <p className="font-display text-xl font-bold text-text">{account.name}</p>
              <p className="mt-0.5 text-sm capitalize text-text-muted">
                {ACCOUNT_TYPE_LABELS[(account.type as AccountType) ?? "other"]}
              </p>
            </div>
          </div>
          <p className={cn(
            "font-display text-2xl font-bold",
            balance >= 0 ? "text-accent" : "text-red-400"
          )}>
            {formatCurrency(account.balance, account.currency)}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          {account.institution && (
            <div>
              <p className="text-text-muted">Institution</p>
              <p className="font-medium text-text">{account.institution}</p>
            </div>
          )}
          {account.accountNumber && (
            <div>
              <p className="text-text-muted">Last 4 Digits</p>
              <p className="font-medium text-text">****{account.accountNumber}</p>
            </div>
          )}
          <div>
            <p className="text-text-muted">Ownership</p>
            <p className="font-medium text-text capitalize">{account.ownership ?? "ours"}</p>
          </div>
          {account.currency !== "USD" && (
            <div>
              <p className="text-text-muted">Currency</p>
              <p className="font-medium text-text">{account.currency}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onEdit}
          className="orbyt-button-accent flex flex-1 items-center justify-center gap-2"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          aria-label="Archive account"
          className="orbyt-button-ghost flex items-center gap-2 text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
          Archive
        </button>
      </div>

      {/* Recent transactions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Recent Transactions
        </h3>
        {account.recentTransactions.length === 0 ? (
          <p className="text-sm text-text-muted">No transactions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {account.recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="glass-card-subtle flex items-center justify-between rounded-xl px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-text">{tx.description}</p>
                  <p className="text-xs text-text-muted capitalize">{tx.category}</p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-semibold",
                    tx.type === "income" ? "text-green-400" : tx.type === "transfer" ? "text-blue-400" : "text-red-400"
                  )}>
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                    {formatCurrency(tx.amount, tx.currency)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(tx.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Archive this account?"
        description="It will be removed from your active accounts. Existing transactions will be preserved."
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => deleteAccount.mutate({ id: account.id })}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

// ── AccountDrawer (main export) ──────────────────────────────────────────────

interface AccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string | null;
}

export function AccountDrawer({ isOpen, onClose, accountId }: AccountDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { data: account, isLoading } = trpc.finances.getAccountById.useQuery(
    { id: accountId! },
    { enabled: !!accountId },
  );

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  const title = accountId
    ? isEditing
      ? "Edit Account"
      : (account?.name ?? "Account Details")
    : "Add Account";

  return (
    <Drawer open={isOpen} onClose={handleClose} title={title}>
      {accountId ? (
        isLoading ? (
          <div className="flex flex-col gap-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : account ? (
          isEditing ? (
            <EditAccountForm
              account={account}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <ViewAccount
              account={account}
              onClose={handleClose}
              onEdit={() => setIsEditing(true)}
            />
          )
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">Account not found.</p>
        )
      ) : (
        <CreateAccountForm onClose={handleClose} />
      )}
    </Drawer>
  );
}
