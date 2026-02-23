"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MarkPaidModal } from "./mark-paid-modal";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";

type RouterOutput = inferRouterOutputs<AppRouter>;
type BillDetail = NonNullable<RouterOutput["finances"]["getBillById"]>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

const CATEGORIES = [
  "housing",
  "utilities",
  "insurance",
  "transportation",
  "subscriptions",
  "food",
  "healthcare",
  "other",
] as const;

type BillCategory = (typeof CATEGORIES)[number];

// ── Bill Form Fields (shared between create and edit) ─────────────────────────

function BillFormFields({
  name,
  setName,
  amount,
  setAmount,
  dueDay,
  setDueDay,
  category,
  setCategory,
  autoPay,
  setAutoPay,
  currency,
  setCurrency,
  notes,
  setNotes,
  url,
  setUrl,
  assignedTo,
  setAssignedTo,
  members,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  name: string;
  setName: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  dueDay: number;
  setDueDay: (v: number) => void;
  category: BillCategory;
  setCategory: (v: BillCategory) => void;
  autoPay: boolean;
  setAutoPay: (v: boolean) => void;
  currency: string;
  setCurrency: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  url: string;
  setUrl: (v: string) => void;
  assignedTo: string;
  setAssignedTo: (v: string) => void;
  members: { id: string; name: string }[];
  submitLabel: string;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 pb-6">
      {/* Name */}
      <div>
        <label className="orbyt-label" htmlFor="bill-name">Bill Name</label>
        <input
          id="bill-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="orbyt-input mt-1 w-full"
          placeholder="e.g. Rent, Netflix"
          required
          maxLength={255}
        />
      </div>

      {/* Amount + Currency */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="orbyt-label" htmlFor="bill-amount">Amount</label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              $
            </span>
            <input
              id="bill-amount"
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
        <div>
          <label className="orbyt-label" htmlFor="bill-currency">Currency</label>
          <select
            id="bill-currency"
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

      {/* Due Day + Category */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="orbyt-label" htmlFor="bill-due-day">Due Day (1-31)</label>
          <input
            id="bill-due-day"
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(e) => setDueDay(Number(e.target.value))}
            className="orbyt-input mt-1 w-full"
            required
          />
        </div>
        <div>
          <label className="orbyt-label" htmlFor="bill-category">Category</label>
          <select
            id="bill-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BillCategory)}
            className="orbyt-input mt-1 w-full capitalize"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Auto-pay (external) toggle */}
      <div className="rounded-xl border border-border bg-surface/50 px-4 py-3">
        <label className="flex cursor-pointer items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text">Auto-pay (external)</span>
            <span className="text-xs text-text-muted">Track bills your bank pays automatically</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={["text-xs font-medium", autoPay ? "text-accent" : "text-text-muted"].join(" ")}>
              {autoPay ? "ON" : "OFF"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoPay}
              onClick={() => setAutoPay(!autoPay)}
              className={[
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
                autoPay ? "bg-accent" : "bg-white/10",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-4 w-4 rounded-full shadow transition-transform",
                  autoPay ? "translate-x-6 bg-white" : "translate-x-1 bg-white/60",
                ].join(" ")}
              />
            </button>
          </div>
        </label>
      </div>

      {/* Assigned To */}
      <div>
        <label className="orbyt-label" htmlFor="bill-assigned-to">
          Assigned To <span className="text-text-muted">(optional)</span>
        </label>
        <select
          id="bill-assigned-to"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="orbyt-input mt-1 w-full"
        >
          <option value="">Anyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* URL */}
      <div>
        <label className="orbyt-label" htmlFor="bill-url">
          Payment URL <span className="text-text-muted">(optional)</span>
        </label>
        <input
          id="bill-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="orbyt-input mt-1 w-full"
          placeholder="https://pay.example.com"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="orbyt-label" htmlFor="bill-notes">
          Notes <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          id="bill-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="orbyt-input mt-1 w-full resize-none"
          rows={2}
          maxLength={2000}
          placeholder="Any additional notes..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || !name.trim() || !amount.trim()}
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

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateBillForm({
  onClose,
  currentMonth,
}: {
  onClose: () => void;
  currentMonth: string;
}) {
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState<number>(1);
  const [category, setCategory] = useState<BillCategory>("other");
  const [autoPay, setAutoPay] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const { data: membersData } = trpc.finances.listHouseholdMembers.useQuery();
  const members = membersData ?? [];

  const createBill = trpc.finances.createBill.useMutation({
    onSuccess: () => {
      utils.finances.listBills.invalidate();
      utils.finances.getMonthlyOverview.invalidate({ month: currentMonth });
      toast.success("Bill added");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create bill");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedAmount = amount.trim();
    if (!trimmedAmount || !/^\d+(\.\d{1,2})?$/.test(trimmedAmount)) {
      toast.error("Enter a valid amount (e.g., 150.00)");
      return;
    }
    createBill.mutate({
      name: name.trim(),
      amount: trimmedAmount,
      dueDay,
      category,
      rrule: "FREQ=MONTHLY",
      autoPay,
      currency,
      notes: notes.trim() || null,
      url: url.trim() || null,
      assignedTo: assignedTo || null,
    });
  }

  return (
    <BillFormFields
      name={name}
      setName={setName}
      amount={amount}
      setAmount={setAmount}
      dueDay={dueDay}
      setDueDay={setDueDay}
      category={category}
      setCategory={setCategory}
      autoPay={autoPay}
      setAutoPay={setAutoPay}
      currency={currency}
      setCurrency={setCurrency}
      notes={notes}
      setNotes={setNotes}
      url={url}
      setUrl={setUrl}
      assignedTo={assignedTo}
      setAssignedTo={setAssignedTo}
      members={members}
      submitLabel="Add Bill"
      isPending={createBill.isPending}
      onSubmit={handleSubmit}
    />
  );
}

// ── Edit Form ─────────────────────────────────────────────────────────────────

function EditBillForm({
  bill,
  onCancel,
  currentMonth,
}: {
  bill: BillDetail;
  onCancel: () => void;
  currentMonth: string;
}) {
  const utils = trpc.useUtils();

  const [name, setName] = useState(bill.name);
  const [amount, setAmount] = useState(bill.amount ?? "");
  const [dueDay, setDueDay] = useState<number>(bill.dueDay);
  const [category, setCategory] = useState<BillCategory>(
    (bill.category as BillCategory) ?? "other",
  );
  const [autoPay, setAutoPay] = useState(bill.autoPay);
  const [currency, setCurrency] = useState(bill.currency ?? "USD");
  const [notes, setNotes] = useState(bill.notes ?? "");
  const [url, setUrl] = useState(bill.url ?? "");
  const [assignedTo, setAssignedTo] = useState(bill.assignedTo ?? "");

  const { data: membersData } = trpc.finances.listHouseholdMembers.useQuery();
  const members = membersData ?? [];

  const updateBill = trpc.finances.updateBill.useMutation({
    onSuccess: () => {
      utils.finances.listBills.invalidate();
      utils.finances.getBillById.invalidate({ id: bill.id });
      utils.finances.getMonthlyOverview.invalidate({ month: currentMonth });
      toast.success("Bill updated");
      onCancel(); // Switch back to view mode
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update bill");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedAmount = amount.trim();
    if (!trimmedAmount || !/^\d+(\.\d{1,2})?$/.test(trimmedAmount)) {
      toast.error("Enter a valid amount (e.g., 150.00)");
      return;
    }
    updateBill.mutate({
      id: bill.id,
      data: {
        name: name.trim(),
        amount: trimmedAmount,
        dueDay,
        category,
        rrule: "FREQ=MONTHLY",
        autoPay,
        currency,
        notes: notes.trim() || null,
        url: url.trim() || null,
        assignedTo: assignedTo || null,
      },
    });
  }

  return (
    <BillFormFields
      name={name}
      setName={setName}
      amount={amount}
      setAmount={setAmount}
      dueDay={dueDay}
      setDueDay={setDueDay}
      category={category}
      setCategory={setCategory}
      autoPay={autoPay}
      setAutoPay={setAutoPay}
      currency={currency}
      setCurrency={setCurrency}
      notes={notes}
      setNotes={setNotes}
      url={url}
      setUrl={setUrl}
      assignedTo={assignedTo}
      setAssignedTo={setAssignedTo}
      members={members}
      submitLabel="Save Changes"
      isPending={updateBill.isPending}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
  );
}

// ── View / Edit Bill ──────────────────────────────────────────────────────────

function ViewBill({
  bill,
  onClose,
  onEdit,
  currentMonth,
}: {
  bill: BillDetail;
  onClose: () => void;
  onEdit: () => void;
  currentMonth: string;
}) {
  const utils = trpc.useUtils();

  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const deleteBill = trpc.finances.deleteBill.useMutation({
    onSuccess: () => {
      utils.finances.listBills.invalidate();
      utils.finances.getMonthlyOverview.invalidate({ month: currentMonth });
      toast.success("Bill archived");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to archive bill");
    },
  });


  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Bill info */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl font-bold text-text">{bill.name}</p>
            <p className="mt-1 text-sm capitalize text-text-muted">{bill.category}</p>
          </div>
          <p className="font-display text-2xl font-bold text-accent">
            {formatCurrency(bill.amount, bill.currency)}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-text-muted">Due Day</p>
            <p className="font-medium text-text">{bill.dueDay}</p>
          </div>
          <div>
            <p className="text-text-muted">Auto-pay (external)</p>
            <p className="font-medium text-text">{bill.autoPay ? "Yes" : "No"}</p>
          </div>
          {bill.currency !== "USD" && (
            <div>
              <p className="text-text-muted">Currency</p>
              <p className="font-medium text-text">{bill.currency}</p>
            </div>
          )}
        </div>
        {bill.notes && (
          <p className="mt-3 text-sm text-text-muted">{bill.notes}</p>
        )}
        {bill.url && (
          <a
            href={bill.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-sm text-accent underline-offset-2 hover:underline"
          >
            Pay online ↗
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowMarkPaid(true)}
          className="orbyt-button-accent flex flex-1 items-center justify-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Mark Paid
        </button>
        <button
          onClick={onEdit}
          className="orbyt-button-ghost flex items-center gap-2"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
        <button
          onClick={() => setShowArchiveConfirm(true)}
          aria-label="Archive bill"
          className="orbyt-button-ghost flex items-center gap-2 text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
          Archive
        </button>
      </div>

      {/* Payment history */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Payment History
        </h3>
        {bill.payments.length === 0 ? (
          <p className="text-sm text-text-muted">No payments recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {bill.payments.map((payment) => (
                <motion.div
                  key={payment.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="glass-card-subtle flex items-center justify-between rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-text">
                      {formatCurrency(payment.amount, bill.currency)}
                    </p>
                    {payment.notes && (
                      <p className="text-xs text-text-muted">{payment.notes}</p>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">
                    {new Date(payment.paidAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Mark Paid Modal */}
      <MarkPaidModal
        billId={bill.id}
        billName={bill.name}
        defaultAmount={bill.amount}
        currency={bill.currency}
        open={showMarkPaid}
        onClose={() => setShowMarkPaid(false)}
        currentMonth={currentMonth}
      />

      {/* Archive Confirm Dialog */}
      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive this bill?"
        description="It will be removed from your active bills. You can still view its payment history."
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => deleteBill.mutate({ id: bill.id })}
        onCancel={() => setShowArchiveConfirm(false)}
      />
    </div>
  );
}

// ── BillDrawer (main export) ──────────────────────────────────────────────────

interface BillDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  billId: string | null;
  currentMonth: string;
}

export function BillDrawer({ isOpen, onClose, billId, currentMonth }: BillDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { data: bill, isLoading } = trpc.finances.getBillById.useQuery(
    { id: billId! },
    { enabled: !!billId },
  );

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  const title = billId
    ? isEditing
      ? "Edit Bill"
      : (bill?.name ?? "Bill Details")
    : "Add Bill";

  return (
    <Drawer open={isOpen} onClose={handleClose} title={title}>
      {billId ? (
        isLoading ? (
          <div className="flex flex-col gap-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : bill ? (
          isEditing ? (
            <EditBillForm
              bill={bill}
              onCancel={() => setIsEditing(false)}
              currentMonth={currentMonth}
            />
          ) : (
            <ViewBill
              bill={bill}
              onClose={handleClose}
              onEdit={() => setIsEditing(true)}
              currentMonth={currentMonth}
            />
          )
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">Bill not found.</p>
        )
      ) : (
        <CreateBillForm onClose={handleClose} currentMonth={currentMonth} />
      )}
    </Drawer>
  );
}
