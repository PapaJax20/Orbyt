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

export type CreateBillInput = z.infer<typeof CreateBillSchema>;
export type MarkBillPaidInput = z.infer<typeof MarkBillPaidSchema>;
