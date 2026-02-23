import { z } from "zod";

const BillCategorySchema = z.enum([
  "housing",
  "utilities",
  "insurance",
  "transportation",
  "subscriptions",
  "food",
  "healthcare",
  "other",
]);

export const CreateBillSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  category: BillCategorySchema,
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  currency: z.string().length(3).default("USD"),
  dueDay: z.number().int().min(1).max(31),
  rrule: z.string(),
  autoPay: z.boolean().default(false),
  notes: z.string().max(2000).nullable().optional(),
  url: z.string().url().nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  notifyOnPaid: z.array(z.string().uuid()).default([]),
});

export const UpdateBillSchema = CreateBillSchema.partial();

export const MarkBillPaidSchema = z.object({
  billId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  paidAt: z.string().datetime().optional(),
  notes: z.string().max(2000).nullable().optional(),
  receiptUrl: z.string().url().nullable().optional(),
});

export const GetMonthlyOverviewSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format"),
});

// --- Account Validators ---

const AccountTypeSchema = z.enum([
  "checking",
  "savings",
  "credit_card",
  "cash",
  "investment",
  "loan",
  "other",
]);

export const CreateAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: AccountTypeSchema,
  balance: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Invalid balance").default("0"),
  currency: z.string().length(3).default("USD"),
  institution: z.string().max(100).nullable().optional(),
  accountNumber: z.string().max(4).nullable().optional(),
  ownership: z.enum(["mine", "theirs", "ours"]).default("ours"),
  ownerId: z.string().uuid().nullable().optional(),
});

export const UpdateAccountSchema = CreateAccountSchema.partial();

// --- Transaction Validators ---

const TransactionTypeSchema = z.enum(["expense", "income", "transfer"]);

const TransactionCategorySchema = z.enum([
  "housing",
  "utilities",
  "groceries",
  "dining",
  "transportation",
  "healthcare",
  "insurance",
  "entertainment",
  "shopping",
  "education",
  "personal",
  "gifts",
  "income",
  "salary",
  "freelance",
  "investment",
  "transfer",
  "other",
]);

export const CreateTransactionSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  type: TransactionTypeSchema,
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  currency: z.string().length(3).default("USD"),
  category: TransactionCategorySchema,
  description: z.string().min(1, "Description is required").max(255),
  date: z.string().datetime(),
  notes: z.string().max(2000).nullable().optional(),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.string().max(20).nullable().optional(),
  tags: z.array(z.string()).default([]),
  ownership: z.enum(["mine", "theirs", "ours"]).default("ours"),
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

export const ListTransactionsFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  category: TransactionCategorySchema.optional(),
  type: TransactionTypeSchema.optional(),
  accountId: z.string().uuid().optional(),
  ownership: z.enum(["mine", "theirs", "ours"]).optional(),
  memberId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

// --- Budget Validators ---

const BudgetCategorySchema = z.enum([
  "housing",
  "utilities",
  "groceries",
  "dining",
  "transportation",
  "healthcare",
  "insurance",
  "entertainment",
  "shopping",
  "education",
  "personal",
  "subscriptions",
  "savings",
  "other",
]);

export const CreateBudgetSchema = z.object({
  category: BudgetCategorySchema,
  monthlyLimit: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  rollover: z.boolean().default(false),
});

export const UpdateBudgetSchema = CreateBudgetSchema.partial();

// --- Savings Goal Validators ---

export const CreateSavingsGoalSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  targetAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  currentAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount").default("0"),
  targetDate: z.string().nullable().optional(),
  monthlyContribution: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid amount")
    .nullable()
    .optional(),
  category: z.enum(["savings", "sinking_fund", "debt_payoff"]).default("savings"),
  linkedAccountId: z.string().uuid().nullable().optional(),
  emoji: z.string().max(4).nullable().optional(),
});

export const UpdateSavingsGoalSchema = CreateSavingsGoalSchema.partial();

export const ContributeToGoalSchema = z.object({
  goalId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
});

// --- Expense Split Validators ---

export const CreateExpenseSplitSchema = z.object({
  transactionId: z.string().uuid(),
  splits: z.array(z.object({
    owedBy: z.string().uuid(),
    owedTo: z.string().uuid(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  })).min(1, "At least one split is required"),
});

export const SettleUpSchema = z.object({
  splitIds: z.array(z.string().uuid()).min(1),
});

export const GetBalanceSchema = z.object({
  memberId: z.string().uuid().optional(),
});

export type CreateBillInput = z.infer<typeof CreateBillSchema>;
export type MarkBillPaidInput = z.infer<typeof MarkBillPaidSchema>;
export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;
export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;
export type ListTransactionsFilterInput = z.infer<typeof ListTransactionsFilterSchema>;
export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetSchema>;
export type CreateSavingsGoalInput = z.infer<typeof CreateSavingsGoalSchema>;
export type UpdateSavingsGoalInput = z.infer<typeof UpdateSavingsGoalSchema>;
export type ContributeToGoalInput = z.infer<typeof ContributeToGoalSchema>;
export const GetNetWorthHistorySchema = z.object({
  months: z.number().min(1).max(24).default(6),
});

export type GetNetWorthHistoryInput = z.infer<typeof GetNetWorthHistorySchema>;

export type CreateExpenseSplitInput = z.infer<typeof CreateExpenseSplitSchema>;
export type SettleUpInput = z.infer<typeof SettleUpSchema>;
