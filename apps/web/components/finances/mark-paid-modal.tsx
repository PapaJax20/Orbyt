"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

interface MarkPaidModalProps {
  billId: string;
  billName: string;
  defaultAmount: string;
  currency: string;
  open: boolean;
  onClose: () => void;
  currentMonth: string;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function MarkPaidModal({
  billId,
  billName,
  defaultAmount,
  currency,
  open,
  onClose,
  currentMonth,
}: MarkPaidModalProps) {
  const utils = trpc.useUtils();

  const [amount, setAmount] = useState(defaultAmount);
  const [date, setDate] = useState(todayISODate());
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");

  const markPaid = trpc.finances.markPaid.useMutation({
    onSuccess: () => {
      utils.finances.listBills.invalidate();
      utils.finances.getMonthlyOverview.invalidate({ month: currentMonth });
      toast.success("Bill marked as paid");
      setAmount(defaultAmount);
      setDate(todayISODate());
      setNotes("");
      setReceiptUrl("");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to mark bill as paid");
    },
  });

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onClose();
  }

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    const trimmedAmount = amount.trim();
    if (!trimmedAmount || !/^\d+(\.\d{1,2})?$/.test(trimmedAmount)) {
      toast.error("Enter a valid amount (e.g., 1500.00)");
      return;
    }
    const paidAt = date ? new Date(date + "T12:00:00.000Z").toISOString() : undefined;
    markPaid.mutate({
      billId,
      amount: trimmedAmount,
      paidAt,
      notes: notes.trim() || null,
      receiptUrl: receiptUrl.trim() || null,
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
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
                aria-describedby="mark-paid-description"
              >
                <motion.div
                  className="glass-card fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <Dialog.Title className="font-display text-xl font-bold text-text">
                    Mark as Paid
                  </Dialog.Title>
                  <Dialog.Description
                    id="mark-paid-description"
                    className="mt-1 text-sm text-text-muted"
                  >
                    Record a payment for{" "}
                    <span className="font-semibold text-text">{billName}</span>.
                  </Dialog.Description>

                  <form onSubmit={handleConfirm} className="mt-5 flex flex-col gap-4">
                    {/* Amount */}
                    <div>
                      <label className="orbyt-label" htmlFor="paid-amount">
                        Amount ({currency})
                      </label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                          $
                        </span>
                        <input
                          id="paid-amount"
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

                    {/* Date */}
                    <div>
                      <label className="orbyt-label" htmlFor="paid-date">
                        Payment Date
                      </label>
                      <input
                        id="paid-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="orbyt-input mt-1 w-full"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="orbyt-label" htmlFor="paid-notes">
                        Notes <span className="text-text-muted">(optional)</span>
                      </label>
                      <textarea
                        id="paid-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="orbyt-input mt-1 w-full resize-none"
                        rows={2}
                        placeholder="e.g. paid via bank transfer"
                        maxLength={500}
                      />
                    </div>

                    {/* Receipt URL */}
                    <div>
                      <label className="orbyt-label" htmlFor="paid-receipt-url">
                        Receipt URL <span className="text-text-muted">(optional)</span>
                      </label>
                      <input
                        id="paid-receipt-url"
                        type="url"
                        value={receiptUrl}
                        onChange={(e) => setReceiptUrl(e.target.value)}
                        className="orbyt-input mt-1 w-full"
                        placeholder="https://example.com/receipt.pdf"
                      />
                    </div>

                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={markPaid.isPending}
                        className="orbyt-button-ghost flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={markPaid.isPending || !amount.trim()}
                        className="orbyt-button-accent flex-1"
                      >
                        {markPaid.isPending ? "Saving…" : "Confirm Payment"}
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
