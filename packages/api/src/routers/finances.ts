import { z } from "zod";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { bills, billPayments } from "@orbyt/db/schema";
import {
  CreateBillSchema,
  UpdateBillSchema,
  MarkBillPaidSchema,
  GetMonthlyOverviewSchema,
} from "@orbyt/shared/validators";
import { getNextBillDueDate } from "@orbyt/shared/utils";
import { router, householdProcedure } from "../trpc";

export const financesRouter = router({
  /**
   * List all active bills for the household.
   */
  listBills: householdProcedure.query(async ({ ctx }) => {
    const allBills = await ctx.db.query.bills.findMany({
      where: and(eq(bills.householdId, ctx.householdId), eq(bills.isActive, true)),
      orderBy: (b, { asc }) => [asc(b.dueDay), asc(b.name)],
    });

    // Attach computed next due date and last payment status
    const billsWithPayments = await Promise.all(
      allBills.map(async (bill) => {
        const lastPayment = await ctx.db.query.billPayments.findFirst({
          where: eq(billPayments.billId, bill.id),
          orderBy: (p, { desc }) => [desc(p.paidAt)],
        });

        const nextDueDate = getNextBillDueDate(bill.dueDay);
        const today = new Date();
        const isOverdue = nextDueDate < today && lastPayment?.dueDate.getMonth() !== today.getMonth();

        return {
          ...bill,
          nextDueDate,
          lastPayment,
          currentStatus: isOverdue ? "overdue" : "upcoming",
        };
      })
    );

    return billsWithPayments;
  }),

  /**
   * Get a single bill with its payment history.
   */
  getBillById: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bill = await ctx.db.query.bills.findFirst({
        where: and(eq(bills.id, input.id), eq(bills.householdId, ctx.householdId)),
      });
      if (!bill) throw new TRPCError({ code: "NOT_FOUND" });

      const payments = await ctx.db.query.billPayments.findMany({
        where: eq(billPayments.billId, input.id),
        orderBy: (p, { desc }) => [desc(p.paidAt)],
      });

      return { ...bill, payments };
    }),

  /**
   * Create a new bill.
   */
  createBill: householdProcedure.input(CreateBillSchema).mutation(async ({ ctx, input }) => {
    const [bill] = await ctx.db
      .insert(bills)
      .values({
        ...input,
        householdId: ctx.householdId,
        createdBy: ctx.user.id,
      })
      .returning();
    return bill;
  }),

  /**
   * Update a bill.
   */
  updateBill: householdProcedure
    .input(z.object({ id: z.string().uuid(), data: UpdateBillSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(bills)
        .set({ ...input.data, updatedAt: new Date() })
        .where(and(eq(bills.id, input.id), eq(bills.householdId, ctx.householdId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /**
   * Archive (soft-delete) a bill.
   */
  deleteBill: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(bills)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(bills.id, input.id), eq(bills.householdId, ctx.householdId)));
      return { success: true };
    }),

  /**
   * Mark a bill as paid for the current period.
   */
  markPaid: householdProcedure.input(MarkBillPaidSchema).mutation(async ({ ctx, input }) => {
    const bill = await ctx.db.query.bills.findFirst({
      where: and(eq(bills.id, input.billId), eq(bills.householdId, ctx.householdId)),
    });
    if (!bill) throw new TRPCError({ code: "NOT_FOUND" });

    const [payment] = await ctx.db
      .insert(billPayments)
      .values({
        billId: input.billId,
        paidBy: ctx.user.id,
        amount: input.amount,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        dueDate: getNextBillDueDate(bill.dueDay),
        status: "paid",
        notes: input.notes,
        receiptUrl: input.receiptUrl,
      })
      .returning();

    return payment;
  }),

  /**
   * Get a monthly financial overview (totals by category, paid vs. pending).
   */
  getMonthlyOverview: householdProcedure
    .input(GetMonthlyOverviewSchema)
    .query(async ({ ctx, input }) => {
      const [year, month] = input.month.split("-").map(Number) as [number, number];
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);

      const allBills = await ctx.db.query.bills.findMany({
        where: and(eq(bills.householdId, ctx.householdId), eq(bills.isActive, true)),
      });

      const payments = await ctx.db.query.billPayments.findMany({
        where: and(
          eq(billPayments.billId, bills.id),
          gte(billPayments.paidAt, startOfMonth),
          lte(billPayments.paidAt, endOfMonth)
        ),
      });

      const totalBilled = allBills.reduce((sum, b) => sum + parseFloat(b.amount ?? "0"), 0);
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount ?? "0"), 0);

      return {
        month: input.month,
        totalBilled,
        totalPaid,
        totalPending: totalBilled - totalPaid,
        billCount: allBills.length,
        paidCount: payments.length,
      };
    }),

  /**
   * Get upcoming bills (due within N days).
   */
  getUpcoming: householdProcedure
    .input(z.object({ daysAhead: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const allBills = await ctx.db.query.bills.findMany({
        where: and(eq(bills.householdId, ctx.householdId), eq(bills.isActive, true)),
      });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + input.daysAhead);

      return allBills
        .map((bill) => ({
          ...bill,
          nextDueDate: getNextBillDueDate(bill.dueDay),
        }))
        .filter((b) => b.nextDueDate <= cutoff)
        .sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
    }),
});
