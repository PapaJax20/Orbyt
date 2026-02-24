export const BILL_CATEGORY_PRESETS = [
  "housing",
  "utilities",
  "insurance",
  "transportation",
  "subscriptions",
  "food",
  "healthcare",
  "other",
] as const;

export type BillCategory = string;

export type BillPaymentStatus = "paid" | "pending" | "overdue";

export interface Bill {
  id: string;
  householdId: string;
  createdBy: string;
  name: string;
  category: BillCategory;
  amount: string; // stored as string to avoid floating point issues
  currency: string;
  dueDay: number; // day of month 1-31
  rrule: string; // recurrence rule
  autoPay: boolean;
  notes: string | null;
  url: string | null; // payment portal URL
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillPayment {
  id: string;
  billId: string;
  paidBy: string;
  amount: string;
  paidAt: Date;
  dueDate: Date;
  status: BillPaymentStatus;
  notes: string | null;
  receiptUrl: string | null;
  createdAt: Date;
}

export interface BillWithPayments extends Bill {
  payments: BillPayment[];
  nextDueDate: Date | null;
  lastPayment: BillPayment | null;
  currentStatus: BillPaymentStatus;
}

export interface MonthlyFinancialOverview {
  month: string; // "YYYY-MM"
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  byCategory: Record<BillCategory, number>;
}
