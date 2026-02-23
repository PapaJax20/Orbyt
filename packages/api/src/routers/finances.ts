import { z } from "zod";
import { eq, and, gte, lte, desc, asc, sql, count, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { DbClient } from "@orbyt/db";
import { bills, billPayments, accounts, transactions, budgets, savingsGoals, expenseSplits, profiles, householdMembers, tasks, taskAssignees, notifications, netWorthSnapshots } from "@orbyt/db/schema";
import {
  CreateBillSchema,
  UpdateBillSchema,
  MarkBillPaidSchema,
  GetMonthlyOverviewSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  CreateTransactionSchema,
  UpdateTransactionSchema,
  ListTransactionsFilterSchema,
  CreateBudgetSchema,
  UpdateBudgetSchema,
  CreateSavingsGoalSchema,
  UpdateSavingsGoalSchema,
  ContributeToGoalSchema,
  CreateExpenseSplitSchema,
  SettleUpSchema,
  GetBalanceSchema,
  GetNetWorthHistorySchema,
  GetSpendingByCategorySchema,
  GetMonthlyTrendSchema,
  ImportTransactionsSchema,
} from "@orbyt/shared/validators";
import { getNextBillDueDate } from "@orbyt/shared/utils";
import { router, householdProcedure } from "../trpc";

/**
 * Auto-create a task linked to a bill for the assigned member.
 * Includes dedup guard to prevent duplicate active tasks for the same bill.
 */
async function createBillTask(
  db: DbClient,
  bill: { id: string; name: string; dueDay: number; householdId: string; createdBy: string; assignedTo: string | null },
) {
  if (!bill.assignedTo) return null;

  // Dedup guard: don't create if an active task already exists for this bill
  const existing = await db.query.tasks.findFirst({
    where: and(
      eq(tasks.sourceBillId, bill.id),
      inArray(tasks.status, ["todo", "in_progress"]),
    ),
  });
  if (existing) return null;

  const nextDueDate = getNextBillDueDate(bill.dueDay);

  const [task] = await db
    .insert(tasks)
    .values({
      householdId: bill.householdId,
      createdBy: bill.createdBy,
      title: `Pay ${bill.name}`,
      description: `Auto-created task for bill: ${bill.name}`,
      status: "todo",
      priority: "medium",
      dueAt: nextDueDate,
      sourceBillId: bill.id,
      tags: ["bill"],
    })
    .returning();

  if (task) {
    await db.insert(taskAssignees).values({
      taskId: task.id,
      userId: bill.assignedTo,
    });
  }

  return task;
}

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
    // Validate assignedTo is a household member
    if (input.assignedTo) {
      const member = await ctx.db.query.householdMembers.findFirst({
        where: and(
          eq(householdMembers.householdId, ctx.householdId),
          eq(householdMembers.userId, input.assignedTo),
        ),
      });
      if (!member) throw new TRPCError({ code: "BAD_REQUEST", message: "Assigned user is not a household member" });
    }

    const [bill] = await ctx.db
      .insert(bills)
      .values({
        ...input,
        householdId: ctx.householdId,
        createdBy: ctx.user.id,
      })
      .returning();

    // Auto-create linked task if bill has an assignee
    if (bill && bill.assignedTo) {
      await createBillTask(ctx.db, bill);
    }

    return bill;
  }),

  /**
   * Update a bill.
   */
  updateBill: householdProcedure
    .input(z.object({ id: z.string().uuid(), data: UpdateBillSchema }))
    .mutation(async ({ ctx, input }) => {
      // Validate assignedTo is a household member
      if (input.data.assignedTo) {
        const member = await ctx.db.query.householdMembers.findFirst({
          where: and(
            eq(householdMembers.householdId, ctx.householdId),
            eq(householdMembers.userId, input.data.assignedTo),
          ),
        });
        if (!member) throw new TRPCError({ code: "BAD_REQUEST", message: "Assigned user is not a household member" });
      }

      // Fetch old bill to detect assignee changes
      const oldBill = await ctx.db.query.bills.findFirst({
        where: and(eq(bills.id, input.id), eq(bills.householdId, ctx.householdId)),
      });
      if (!oldBill) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db
        .update(bills)
        .set({ ...input.data, updatedAt: new Date() })
        .where(and(eq(bills.id, input.id), eq(bills.householdId, ctx.householdId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      // Handle assignee changes -> task lifecycle
      const oldAssignee = oldBill.assignedTo;
      const newAssignee = input.data.assignedTo !== undefined ? input.data.assignedTo : oldAssignee;

      if (oldAssignee !== newAssignee) {
        // Cancel old linked task(s)
        await ctx.db
          .update(tasks)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(
            and(
              eq(tasks.sourceBillId, input.id),
              inArray(tasks.status, ["todo", "in_progress"]),
            )
          );

        // Create new task for the new assignee
        if (newAssignee) {
          await createBillTask(ctx.db, { ...updated, assignedTo: newAssignee });
        }
      }

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

      // Cancel any active linked tasks
      await ctx.db
        .update(tasks)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(tasks.sourceBillId, input.id),
            inArray(tasks.status, ["todo", "in_progress"]),
          )
        );

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

    // Auto-complete linked task
    const linkedTask = await ctx.db.query.tasks.findFirst({
      where: and(
        eq(tasks.sourceBillId, input.billId),
        inArray(tasks.status, ["todo", "in_progress"]),
      ),
    });

    if (linkedTask) {
      await ctx.db
        .update(tasks)
        .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(tasks.id, linkedTask.id));
    }

    // Create next cycle's task (dedup guard inside createBillTask prevents duplicates)
    if (bill.assignedTo && bill.isActive) {
      await createBillTask(ctx.db, bill);
    }

    // Send notifications to notifyOnPaid members
    const notifyMembers = (bill.notifyOnPaid ?? []) as string[];
    if (notifyMembers.length > 0) {
      // Validate notifyOnPaid members belong to this household
      const householdMemberRows = await ctx.db.query.householdMembers.findMany({
        where: eq(householdMembers.householdId, ctx.householdId),
      });
      const validMemberIds = new Set(householdMemberRows.map((m) => m.userId));
      const validNotifyMembers = notifyMembers.filter((id) => validMemberIds.has(id));

      if (validNotifyMembers.length > 0) {
        await ctx.db.insert(notifications).values(
          validNotifyMembers.map((userId) => ({
            userId,
            householdId: ctx.householdId,
            type: "bill_paid",
            title: `${bill.name} has been paid`,
            body: `${bill.name} was marked as paid ($${input.amount}).`,
            data: {
              route: "/finances",
              entityId: bill.id,
              entityType: "bill",
            },
            channels: ["in_app"],
          })),
        );
      }
    }

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

      const billIds = allBills.map((b) => b.id);

      const payments = billIds.length
        ? await ctx.db.query.billPayments.findMany({
            where: and(
              inArray(billPayments.billId, billIds),
              gte(billPayments.paidAt, startOfMonth),
              lte(billPayments.paidAt, endOfMonth)
            ),
          })
        : [];

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

  // ================================================================
  // Account Procedures
  // ================================================================

  /**
   * List all active accounts for the household, ordered by type then name.
   * Includes total balance sum.
   */
  listAccounts: householdProcedure
    .input(z.object({
      ownership: z.enum(["mine", "theirs", "ours"]).optional(),
      memberId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(accounts.householdId, ctx.householdId),
        eq(accounts.isActive, true),
      ];

      if (input?.ownership) {
        conditions.push(eq(accounts.ownership, input.ownership));
      }
      if (input?.memberId) {
        conditions.push(eq(accounts.ownerId, input.memberId));
      }

      const allAccounts = await ctx.db.query.accounts.findMany({
        where: and(...conditions),
        orderBy: [asc(accounts.type), asc(accounts.name)],
      });

      const totalBalance = allAccounts.reduce(
        (sum, a) => sum + parseFloat(a.balance ?? "0"),
        0
      );

      return {
        accounts: allAccounts,
        totalBalance,
      };
    }),

  /**
   * Get a single account by ID with recent transactions (last 10).
   */
  getAccountById: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.query.accounts.findFirst({
        where: and(
          eq(accounts.id, input.id),
          eq(accounts.householdId, ctx.householdId)
        ),
      });
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      const recentTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.accountId, input.id),
          eq(transactions.householdId, ctx.householdId)
        ),
        orderBy: (t, { desc }) => [desc(t.date)],
        limit: 10,
      });

      return { ...account, recentTransactions };
    }),

  /**
   * Create a new account.
   */
  createAccount: householdProcedure
    .input(CreateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const [account] = await ctx.db
        .insert(accounts)
        .values({
          ...input,
          householdId: ctx.householdId,
          createdBy: ctx.user.id,
        })
        .returning();
      return account;
    }),

  /**
   * Update an account.
   */
  updateAccount: householdProcedure
    .input(z.object({ id: z.string().uuid(), data: UpdateAccountSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(accounts)
        .set({ ...input.data, updatedAt: new Date() })
        .where(
          and(eq(accounts.id, input.id), eq(accounts.householdId, ctx.householdId))
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /**
   * Soft-delete an account (set isActive = false).
   */
  deleteAccount: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(accounts)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(eq(accounts.id, input.id), eq(accounts.householdId, ctx.householdId))
        );
      return { success: true };
    }),

  /**
   * Quick balance update without touching other fields.
   */
  updateBalance: householdProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        balance: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Invalid balance"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(accounts)
        .set({ balance: input.balance, updatedAt: new Date() })
        .where(
          and(eq(accounts.id, input.id), eq(accounts.householdId, ctx.householdId))
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  // ================================================================
  // Transaction Procedures
  // ================================================================

  /**
   * List transactions with optional filters, pagination, and total count.
   */
  listTransactions: householdProcedure
    .input(ListTransactionsFilterSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(transactions.householdId, ctx.householdId)];

      if (input.startDate) {
        conditions.push(gte(transactions.date, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(transactions.date, input.endDate));
      }
      if (input.category) {
        conditions.push(eq(transactions.category, input.category));
      }
      if (input.type) {
        conditions.push(eq(transactions.type, input.type));
      }
      if (input.accountId) {
        conditions.push(eq(transactions.accountId, input.accountId));
      }
      if (input.ownership) {
        conditions.push(eq(transactions.ownership, input.ownership));
      }
      if (input.memberId) {
        conditions.push(eq(transactions.createdBy, input.memberId));
      }

      const whereClause = and(...conditions);

      const [items, totalResult] = await Promise.all([
        ctx.db.query.transactions.findMany({
          where: whereClause,
          orderBy: (t, { desc }) => [desc(t.date)],
          limit: input.limit,
          offset: input.offset,
        }),
        ctx.db
          .select({ total: count() })
          .from(transactions)
          .where(whereClause),
      ]);

      return {
        transactions: items,
        total: totalResult[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /**
   * Create a transaction and update account balance if applicable.
   * expense: subtract from account balance
   * income: add to account balance
   * transfer: skip balance adjustment (handled separately)
   */
  createTransaction: householdProcedure
    .input(CreateTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      const [transaction] = await ctx.db
        .insert(transactions)
        .values({
          ...input,
          householdId: ctx.householdId,
          createdBy: ctx.user.id,
        })
        .returning();

      // Update account balance if linked to an account
      if (input.accountId && input.type !== "transfer") {
        const balanceAdjustment =
          input.type === "expense"
            ? sql`${accounts.balance}::numeric - ${input.amount}::numeric`
            : sql`${accounts.balance}::numeric + ${input.amount}::numeric`;

        await ctx.db
          .update(accounts)
          .set({
            balance: sql`${balanceAdjustment}`,
            updatedAt: new Date(),
          })
          .where(and(eq(accounts.id, input.accountId), eq(accounts.householdId, ctx.householdId)));
      }

      return transaction;
    }),

  /**
   * Update a transaction. If amount or type changed and accountId exists,
   * reverse the old balance impact and apply the new one.
   */
  updateTransaction: householdProcedure
    .input(z.object({ id: z.string().uuid(), data: UpdateTransactionSchema }))
    .mutation(async ({ ctx, input }) => {
      // Fetch the existing transaction first
      const existing = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.id),
          eq(transactions.householdId, ctx.householdId)
        ),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db
        .update(transactions)
        .set({ ...input.data })
        .where(
          and(
            eq(transactions.id, input.id),
            eq(transactions.householdId, ctx.householdId)
          )
        )
        .returning();

      // Recalculate balance if amount or type changed and account is linked
      const effectiveAccountId = input.data.accountId ?? existing.accountId;
      const newAmount = input.data.amount ?? existing.amount;
      const newType = input.data.type ?? existing.type;

      if (
        effectiveAccountId &&
        (input.data.amount !== undefined || input.data.type !== undefined)
      ) {
        // Reverse old impact (only if old type was not transfer)
        if (existing.accountId && existing.type !== "transfer") {
          const reversal =
            existing.type === "expense"
              ? sql`${accounts.balance}::numeric + ${existing.amount}::numeric`
              : sql`${accounts.balance}::numeric - ${existing.amount}::numeric`;

          await ctx.db
            .update(accounts)
            .set({ balance: sql`${reversal}`, updatedAt: new Date() })
            .where(and(eq(accounts.id, existing.accountId), eq(accounts.householdId, ctx.householdId)));
        }

        // Apply new impact (only if new type is not transfer)
        if (newType !== "transfer") {
          const newImpact =
            newType === "expense"
              ? sql`${accounts.balance}::numeric - ${newAmount}::numeric`
              : sql`${accounts.balance}::numeric + ${newAmount}::numeric`;

          await ctx.db
            .update(accounts)
            .set({ balance: sql`${newImpact}`, updatedAt: new Date() })
            .where(and(eq(accounts.id, effectiveAccountId), eq(accounts.householdId, ctx.householdId)));
        }
      }

      return updated;
    }),

  /**
   * Delete a transaction and reverse the balance impact on the linked account.
   */
  deleteTransaction: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch the transaction to reverse its balance impact
      const existing = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.id),
          eq(transactions.householdId, ctx.householdId)
        ),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, input.id),
            eq(transactions.householdId, ctx.householdId)
          )
        );

      // Reverse balance impact if linked to an account
      if (existing.accountId && existing.type !== "transfer") {
        const reversal =
          existing.type === "expense"
            ? sql`${accounts.balance}::numeric + ${existing.amount}::numeric`
            : sql`${accounts.balance}::numeric - ${existing.amount}::numeric`;

        await ctx.db
          .update(accounts)
          .set({ balance: sql`${reversal}`, updatedAt: new Date() })
          .where(and(eq(accounts.id, existing.accountId), eq(accounts.householdId, ctx.householdId)));
      }

      return { success: true };
    }),

  /**
   * Get spending grouped by category for a given month (YYYY-MM).
   * Returns array of { category, total, count } for expense transactions.
   */
  getSpendingByCategory: householdProcedure
    .input(GetSpendingByCategorySchema)
    .query(async ({ ctx, input }) => {
      // Parse the month into date range
      const startDate = new Date(`${input.month}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const result = await ctx.db
        .select({
          category: transactions.category,
          total: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC(12,2)))`,
          count: count(),
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, ctx.householdId),
            eq(transactions.type, "expense"),
            gte(transactions.date, startDate.toISOString()),
            sql`${transactions.date} < ${endDate.toISOString()}`,
          )
        )
        .groupBy(transactions.category);

      return result.map((r) => ({
        category: r.category,
        total: r.total ?? "0",
        count: Number(r.count),
      }));
    }),

  // =====================
  // Budget Procedures
  // =====================

  /**
   * List all active budgets for the household, with current month spent amounts.
   */
  listBudgets: householdProcedure.query(async ({ ctx }) => {
    const allBudgets = await ctx.db.query.budgets.findMany({
      where: and(eq(budgets.householdId, ctx.householdId), eq(budgets.isActive, true)),
      orderBy: (b, { asc }) => [asc(b.category)],
    });

    // Calculate spent for current month per category
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const startStr = startOfMonth.toISOString().split("T")[0]!;
    const endStr = endOfMonth.toISOString().split("T")[0]!;

    const budgetsWithSpent = await Promise.all(
      allBudgets.map(async (budget) => {
        const categoryTransactions = await ctx.db.query.transactions.findMany({
          where: and(
            eq(transactions.householdId, ctx.householdId),
            eq(transactions.type, "expense"),
            eq(transactions.category, budget.category),
            gte(transactions.date, startStr),
            lte(transactions.date, endStr)
          ),
        });

        const spent = categoryTransactions.reduce(
          (sum, t) => sum + parseFloat(t.amount ?? "0"),
          0
        );

        return {
          ...budget,
          spent: spent.toFixed(2),
        };
      })
    );

    return budgetsWithSpent;
  }),

  /**
   * Create a new budget.
   */
  createBudget: householdProcedure.input(CreateBudgetSchema).mutation(async ({ ctx, input }) => {
    const [budget] = await ctx.db
      .insert(budgets)
      .values({
        ...input,
        householdId: ctx.householdId,
      })
      .returning();
    return budget;
  }),

  /**
   * Update a budget.
   */
  updateBudget: householdProcedure
    .input(z.object({ id: z.string().uuid(), data: UpdateBudgetSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(budgets)
        .set({ ...input.data, updatedAt: new Date() })
        .where(and(eq(budgets.id, input.id), eq(budgets.householdId, ctx.householdId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /**
   * Archive (soft-delete) a budget.
   */
  deleteBudget: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(budgets)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(budgets.id, input.id), eq(budgets.householdId, ctx.householdId)));
      return { success: true };
    }),

  /**
   * Get budget progress for a given month.
   * Returns each active budget with spent, remaining, and percentage.
   */
  getBudgetProgress: householdProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format") }))
    .query(async ({ ctx, input }) => {
      const [year, month] = input.month.split("-").map(Number) as [number, number];
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      const startStr = startOfMonth.toISOString().split("T")[0]!;
      const endStr = endOfMonth.toISOString().split("T")[0]!;

      const allBudgets = await ctx.db.query.budgets.findMany({
        where: and(eq(budgets.householdId, ctx.householdId), eq(budgets.isActive, true)),
      });

      const progress = await Promise.all(
        allBudgets.map(async (budget) => {
          const categoryTransactions = await ctx.db.query.transactions.findMany({
            where: and(
              eq(transactions.householdId, ctx.householdId),
              eq(transactions.type, "expense"),
              eq(transactions.category, budget.category),
              gte(transactions.date, startStr),
              lte(transactions.date, endStr)
            ),
          });

          const spent = categoryTransactions.reduce(
            (sum, t) => sum + parseFloat(t.amount ?? "0"),
            0
          );
          const monthlyLimit = parseFloat(budget.monthlyLimit ?? "0");
          const remaining = monthlyLimit - spent;
          const percentage = monthlyLimit > 0 ? (spent / monthlyLimit) * 100 : 0;

          return {
            id: budget.id,
            category: budget.category,
            monthlyLimit: budget.monthlyLimit,
            rollover: budget.rollover,
            spent: spent.toFixed(2),
            remaining: remaining.toFixed(2),
            percentage: Math.round(percentage * 100) / 100,
          };
        })
      );

      return progress;
    }),

  // =====================
  // Savings Goal Procedures
  // =====================

  /**
   * List all active savings goals for the household.
   * Includes progress percentage, on-track status, and months remaining.
   */
  listGoals: householdProcedure.query(async ({ ctx }) => {
    const allGoals = await ctx.db.query.savingsGoals.findMany({
      where: and(eq(savingsGoals.householdId, ctx.householdId), eq(savingsGoals.isActive, true)),
    });

    return allGoals.map((goal) => {
      const current = parseFloat(goal.currentAmount ?? "0");
      const target = parseFloat(goal.targetAmount ?? "0");
      const progressPercent = target > 0 ? Math.round((current / target) * 10000) / 100 : 0;

      let onTrack: boolean | null = null;
      let monthsRemaining: number | null = null;

      if (goal.targetDate) {
        const targetDate = new Date(goal.targetDate);
        const now = new Date();
        const msPerMonth = 1000 * 60 * 60 * 24 * 30.44;
        monthsRemaining = Math.max(
          0,
          Math.ceil((targetDate.getTime() - now.getTime()) / msPerMonth)
        );

        if (monthsRemaining > 0) {
          const amountNeeded = target - current;
          const requiredPerMonth = amountNeeded / monthsRemaining;
          const monthlyContrib = parseFloat(goal.monthlyContribution ?? "0");
          onTrack = monthlyContrib >= requiredPerMonth;
        } else {
          // Past target date: on track only if already met
          onTrack = current >= target;
        }
      }

      return {
        ...goal,
        progressPercent,
        onTrack,
        monthsRemaining,
      };
    });
  }),

  /**
   * Create a new savings goal.
   */
  createGoal: householdProcedure.input(CreateSavingsGoalSchema).mutation(async ({ ctx, input }) => {
    const [goal] = await ctx.db
      .insert(savingsGoals)
      .values({
        ...input,
        householdId: ctx.householdId,
        createdBy: ctx.user.id,
      })
      .returning();
    return goal;
  }),

  /**
   * Update a savings goal.
   */
  updateGoal: householdProcedure
    .input(z.object({ id: z.string().uuid(), data: UpdateSavingsGoalSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(savingsGoals)
        .set({ ...input.data, updatedAt: new Date() })
        .where(and(eq(savingsGoals.id, input.id), eq(savingsGoals.householdId, ctx.householdId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /**
   * Archive (soft-delete) a savings goal.
   */
  deleteGoal: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(savingsGoals)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(savingsGoals.id, input.id), eq(savingsGoals.householdId, ctx.householdId)));
      return { success: true };
    }),

  /**
   * Contribute to a savings goal.
   * Adds amount to currentAmount; if linkedAccountId exists, subtracts from that account's balance.
   */
  contributeToGoal: householdProcedure
    .input(ContributeToGoalSchema)
    .mutation(async ({ ctx, input }) => {
      const goal = await ctx.db.query.savingsGoals.findFirst({
        where: and(
          eq(savingsGoals.id, input.goalId),
          eq(savingsGoals.householdId, ctx.householdId)
        ),
      });
      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      const currentAmount = parseFloat(goal.currentAmount ?? "0");
      const contribution = parseFloat(input.amount);
      const newAmount = (currentAmount + contribution).toFixed(2);

      const [updated] = await ctx.db
        .update(savingsGoals)
        .set({ currentAmount: newAmount, updatedAt: new Date() })
        .where(eq(savingsGoals.id, input.goalId))
        .returning();

      // If linked to an account, subtract from that account's balance
      if (goal.linkedAccountId) {
        const account = await ctx.db.query.accounts.findFirst({
          where: and(eq(accounts.id, goal.linkedAccountId), eq(accounts.householdId, ctx.householdId)),
        });
        if (account) {
          const accountBalance = parseFloat(account.balance ?? "0");
          const newBalance = (accountBalance - contribution).toFixed(2);
          await ctx.db
            .update(accounts)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(and(eq(accounts.id, goal.linkedAccountId), eq(accounts.householdId, ctx.householdId)));
        }
      }

      return updated;
    }),

  // =====================
  // Financial Overview
  // =====================

  /**
   * Get a comprehensive financial overview for a given month.
   */
  getFinancialOverview: householdProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format") }))
    .query(async ({ ctx, input }) => {
      const [year, month] = input.month.split("-").map(Number) as [number, number];
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      const startStr = startOfMonth.toISOString().split("T")[0]!;
      const endStr = endOfMonth.toISOString().split("T")[0]!;

      // Fetch all active accounts
      const allAccounts = await ctx.db.query.accounts.findMany({
        where: and(eq(accounts.householdId, ctx.householdId), eq(accounts.isActive, true)),
      });

      // totalBalance: sum of all active account balances
      const totalBalance = allAccounts.reduce(
        (sum, a) => sum + parseFloat(a.balance ?? "0"),
        0
      );

      // totalAssets: checking + savings + investment + cash
      const assetTypes = ["checking", "savings", "investment", "cash"];
      const totalAssets = allAccounts
        .filter((a) => assetTypes.includes(a.type))
        .reduce((sum, a) => sum + parseFloat(a.balance ?? "0"), 0);

      // totalLiabilities: credit_card + loan
      const liabilityTypes = ["credit_card", "loan"];
      const totalLiabilities = allAccounts
        .filter((a) => liabilityTypes.includes(a.type))
        .reduce((sum, a) => sum + parseFloat(a.balance ?? "0"), 0);

      // Fetch transactions for the month
      const monthTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.householdId, ctx.householdId),
          gte(transactions.date, startStr),
          lte(transactions.date, endStr)
        ),
      });

      // monthlyIncome: sum of income transactions
      const monthlyIncome = monthTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + parseFloat(t.amount ?? "0"), 0);

      // monthlyExpenses: sum of expense transactions
      const monthlyExpenses = monthTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + parseFloat(t.amount ?? "0"), 0);

      // Fetch active budgets
      const allBudgets = await ctx.db.query.budgets.findMany({
        where: and(eq(budgets.householdId, ctx.householdId), eq(budgets.isActive, true)),
      });

      // Calculate available to spend: income - expenses - unspent budget allocation
      // Sum of budget limits that haven't been fully spent
      const budgetRemaining = await Promise.all(
        allBudgets.map(async (budget) => {
          const spent = monthTransactions
            .filter((t) => t.type === "expense" && t.category === budget.category)
            .reduce((sum, t) => sum + parseFloat(t.amount ?? "0"), 0);
          const limit = parseFloat(budget.monthlyLimit ?? "0");
          return Math.max(0, limit - spent);
        })
      );
      const totalBudgetRemaining = budgetRemaining.reduce((sum, r) => sum + r, 0);
      const availableToSpend = monthlyIncome - monthlyExpenses - totalBudgetRemaining;

      // Budget count
      const budgetCount = allBudgets.length;

      // Goal count
      const allGoals = await ctx.db.query.savingsGoals.findMany({
        where: and(eq(savingsGoals.householdId, ctx.householdId), eq(savingsGoals.isActive, true)),
      });
      const goalCount = allGoals.length;

      // Bills due this month: count bills with dueDay in this month
      const allBills = await ctx.db.query.bills.findMany({
        where: and(eq(bills.householdId, ctx.householdId), eq(bills.isActive, true)),
      });
      const billsDueThisMonth = allBills.filter(
        (b) => b.dueDay >= 1 && b.dueDay <= endOfMonth.getDate()
      ).length;

      return {
        month: input.month,
        totalBalance: totalBalance.toFixed(2),
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        monthlyIncome: monthlyIncome.toFixed(2),
        monthlyExpenses: monthlyExpenses.toFixed(2),
        availableToSpend: availableToSpend.toFixed(2),
        budgetCount,
        goalCount,
        billsDueThisMonth,
      };
    }),

  // ================================================================
  // Expense Splitting Procedures
  // ================================================================

  /**
   * Create expense splits for a transaction.
   * Takes a transaction ID and an array of splits (owedBy, owedTo, amount).
   */
  createExpenseSplits: householdProcedure
    .input(CreateExpenseSplitSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify transaction belongs to this household
      const transaction = await ctx.db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, input.transactionId),
          eq(transactions.householdId, ctx.householdId)
        ),
      });
      if (!transaction) throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });

      // Validate all split members are household members
      const memberRows = await ctx.db.query.householdMembers.findMany({
        where: eq(householdMembers.householdId, ctx.householdId),
      });
      const validIds = new Set(memberRows.map((m) => m.userId));
      for (const split of input.splits) {
        if (!validIds.has(split.owedBy) || !validIds.has(split.owedTo)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Split members must be household members" });
        }
      }

      const created = await Promise.all(
        input.splits.map((split) =>
          ctx.db
            .insert(expenseSplits)
            .values({
              householdId: ctx.householdId,
              transactionId: input.transactionId,
              owedBy: split.owedBy,
              owedTo: split.owedTo,
              amount: split.amount,
            })
            .returning()
        )
      );

      return created.flat();
    }),

  /**
   * List expense splits for a transaction.
   */
  listExpenseSplits: householdProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const splits = await ctx.db.query.expenseSplits.findMany({
        where: and(
          eq(expenseSplits.transactionId, input.transactionId),
          eq(expenseSplits.householdId, ctx.householdId)
        ),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      });
      return splits;
    }),

  /**
   * Get balance between household members.
   * Returns net amounts: who owes whom across all unsettled splits.
   */
  getBalanceBetweenMembers: householdProcedure
    .input(GetBalanceSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(expenseSplits.householdId, ctx.householdId),
        eq(expenseSplits.settled, false),
      ];

      if (input.memberId) {
        // Show only splits involving this member
        conditions.push(
          sql`(${expenseSplits.owedBy} = ${input.memberId} OR ${expenseSplits.owedTo} = ${input.memberId})`
        );
      }

      const unsettledSplits = await ctx.db.query.expenseSplits.findMany({
        where: and(...conditions),
      });

      // Calculate net balances between each pair
      const balanceMap = new Map<string, number>();

      for (const split of unsettledSplits) {
        const key = [split.owedBy, split.owedTo].sort().join(":");
        const amount = parseFloat(split.amount ?? "0");
        const existing = balanceMap.get(key) ?? 0;

        // If owedBy < owedTo (sorted), positive means first person owes second
        if (split.owedBy < split.owedTo) {
          balanceMap.set(key, existing + amount);
        } else {
          balanceMap.set(key, existing - amount);
        }
      }

      // Fetch member profiles for display names
      const members = await ctx.db.query.householdMembers.findMany({
        where: eq(householdMembers.householdId, ctx.householdId),
        with: { profile: true },
      });
      const profileMap = new Map(
        members.map((m) => [m.userId, m.profile])
      );

      const balances = Array.from(balanceMap.entries()).map(([key, netAmount]) => {
        const [id1, id2] = key.split(":") as [string, string];
        const owedBy = netAmount > 0 ? id1 : id2;
        const owedTo = netAmount > 0 ? id2 : id1;
        const absAmount = Math.abs(netAmount);

        return {
          owedBy,
          owedTo,
          owedByName: profileMap.get(owedBy)?.displayName ?? "Unknown",
          owedToName: profileMap.get(owedTo)?.displayName ?? "Unknown",
          amount: absAmount.toFixed(2),
        };
      }).filter((b) => parseFloat(b.amount) > 0);

      return balances;
    }),

  /**
   * Settle up: mark specific splits as settled.
   */
  settleUp: householdProcedure
    .input(SettleUpSchema)
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      await Promise.all(
        input.splitIds.map((splitId) =>
          ctx.db
            .update(expenseSplits)
            .set({ settled: true, settledAt: now })
            .where(
              and(
                eq(expenseSplits.id, splitId),
                eq(expenseSplits.householdId, ctx.householdId)
              )
            )
        )
      );

      return { success: true, settledCount: input.splitIds.length };
    }),

  /**
   * Settle all unsettled splits between two members.
   */
  settleAllBetween: householdProcedure
    .input(z.object({
      memberId1: z.string().uuid(),
      memberId2: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate both members are in this household
      const memberRows = await ctx.db.query.householdMembers.findMany({
        where: eq(householdMembers.householdId, ctx.householdId),
      });
      const validIds = new Set(memberRows.map((m) => m.userId));
      if (!validIds.has(input.memberId1) || !validIds.has(input.memberId2)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Both members must be in this household" });
      }

      const now = new Date();

      // Find all unsettled splits between these two members
      const unsettled = await ctx.db.query.expenseSplits.findMany({
        where: and(
          eq(expenseSplits.householdId, ctx.householdId),
          eq(expenseSplits.settled, false),
          sql`(
            (${expenseSplits.owedBy} = ${input.memberId1} AND ${expenseSplits.owedTo} = ${input.memberId2})
            OR
            (${expenseSplits.owedBy} = ${input.memberId2} AND ${expenseSplits.owedTo} = ${input.memberId1})
          )`
        ),
      });

      if (unsettled.length === 0) {
        return { success: true, settledCount: 0 };
      }

      await Promise.all(
        unsettled.map((split) =>
          ctx.db
            .update(expenseSplits)
            .set({ settled: true, settledAt: now })
            .where(eq(expenseSplits.id, split.id))
        )
      );

      return { success: true, settledCount: unsettled.length };
    }),

  /**
   * Get spending breakdown by household member for a given month.
   */
  getSpendingByMember: householdProcedure
    .input(z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format"),
    }))
    .query(async ({ ctx, input }) => {
      const [year, month] = input.month.split("-").map(Number) as [number, number];
      const startStr = new Date(year, month - 1, 1).toISOString().split("T")[0]!;
      const endStr = new Date(year, month, 0).toISOString().split("T")[0]!;

      // Get all expense transactions for the month
      const monthExpenses = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.householdId, ctx.householdId),
          eq(transactions.type, "expense"),
          gte(transactions.date, startStr),
          lte(transactions.date, endStr)
        ),
      });

      // Get member profiles
      const members = await ctx.db.query.householdMembers.findMany({
        where: eq(householdMembers.householdId, ctx.householdId),
        with: { profile: true },
      });

      // Group spending by member (createdBy)
      const spendingByMember = new Map<string, number>();
      for (const tx of monthExpenses) {
        const current = spendingByMember.get(tx.createdBy) ?? 0;
        spendingByMember.set(tx.createdBy, current + parseFloat(tx.amount ?? "0"));
      }

      return members.map((m) => ({
        memberId: m.userId,
        memberName: m.profile?.displayName ?? "Unknown",
        totalSpent: (spendingByMember.get(m.userId) ?? 0).toFixed(2),
        transactionCount: monthExpenses.filter((tx) => tx.createdBy === m.userId).length,
      }));
    }),

  /**
   * List household members (for member filter dropdowns on the frontend).
   */
  listHouseholdMembers: householdProcedure.query(async ({ ctx }) => {
    const members = await ctx.db.query.householdMembers.findMany({
      where: eq(householdMembers.householdId, ctx.householdId),
      with: { profile: true },
    });
    return members.map((m) => ({
      id: m.userId,
      name: m.profile?.displayName ?? "Unknown",
      avatarUrl: m.profile?.avatarUrl ?? null,
      role: m.role,
    }));
  }),

  // ================================================================
  // Net Worth Procedures
  // ================================================================

  /**
   * Calculate current net worth from all active accounts.
   * Assets = checking + savings + investment + cash
   * Liabilities = credit_card + loan (absolute values)
   * Auto-takes a daily snapshot.
   */
  calculateNetWorth: householdProcedure.query(async ({ ctx }) => {
    const allAccounts = await ctx.db.query.accounts.findMany({
      where: and(eq(accounts.householdId, ctx.householdId), eq(accounts.isActive, true)),
    });

    const assetTypes = ["checking", "savings", "investment", "cash"];
    const liabilityTypes = ["credit_card", "loan"];

    const breakdown: Record<string, string> = {};
    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const account of allAccounts) {
      const balance = parseFloat(account.balance ?? "0");
      const type = account.type;
      breakdown[type] = ((parseFloat(breakdown[type] ?? "0")) + balance).toFixed(2);

      if (assetTypes.includes(type)) {
        totalAssets += balance;
      } else if (liabilityTypes.includes(type)) {
        totalLiabilities += Math.abs(balance);
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    // Auto-snapshot once per day (fire-and-forget, don't block response)
    const today = new Date().toISOString().split("T")[0]!;
    ctx.db
      .insert(netWorthSnapshots)
      .values({
        householdId: ctx.householdId,
        snapshotDate: today,
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        netWorth: netWorth.toFixed(2),
        breakdown,
      })
      .onConflictDoUpdate({
        target: [netWorthSnapshots.householdId, netWorthSnapshots.snapshotDate],
        set: {
          totalAssets: totalAssets.toFixed(2),
          totalLiabilities: totalLiabilities.toFixed(2),
          netWorth: netWorth.toFixed(2),
          breakdown,
        },
      })
      .catch(() => {}); // silent — snapshot is best-effort

    return {
      totalAssets: totalAssets.toFixed(2),
      totalLiabilities: totalLiabilities.toFixed(2),
      netWorth: netWorth.toFixed(2),
      breakdown,
    };
  }),

  /**
   * Manually take a net worth snapshot for today.
   */
  takeNetWorthSnapshot: householdProcedure.mutation(async ({ ctx }) => {
    const allAccounts = await ctx.db.query.accounts.findMany({
      where: and(eq(accounts.householdId, ctx.householdId), eq(accounts.isActive, true)),
    });

    const assetTypes = ["checking", "savings", "investment", "cash"];
    const liabilityTypes = ["credit_card", "loan"];

    const breakdown: Record<string, string> = {};
    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const account of allAccounts) {
      const balance = parseFloat(account.balance ?? "0");
      const type = account.type;
      breakdown[type] = ((parseFloat(breakdown[type] ?? "0")) + balance).toFixed(2);

      if (assetTypes.includes(type)) {
        totalAssets += balance;
      } else if (liabilityTypes.includes(type)) {
        totalLiabilities += Math.abs(balance);
      }
    }

    const netWorth = totalAssets - totalLiabilities;
    const today = new Date().toISOString().split("T")[0]!;

    const [snapshot] = await ctx.db
      .insert(netWorthSnapshots)
      .values({
        householdId: ctx.householdId,
        snapshotDate: today,
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        netWorth: netWorth.toFixed(2),
        breakdown,
      })
      .onConflictDoUpdate({
        target: [netWorthSnapshots.householdId, netWorthSnapshots.snapshotDate],
        set: {
          totalAssets: totalAssets.toFixed(2),
          totalLiabilities: totalLiabilities.toFixed(2),
          netWorth: netWorth.toFixed(2),
          breakdown,
        },
      })
      .returning();

    return snapshot;
  }),

  /**
   * Get historical net worth snapshots for the last N months.
   */
  getNetWorthHistory: householdProcedure
    .input(GetNetWorthHistorySchema)
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - input.months);
      const cutoffStr = cutoffDate.toISOString().split("T")[0]!;

      const snapshots = await ctx.db.query.netWorthSnapshots.findMany({
        where: and(
          eq(netWorthSnapshots.householdId, ctx.householdId),
          gte(netWorthSnapshots.snapshotDate, cutoffStr),
        ),
        orderBy: (s, { asc }) => [asc(s.snapshotDate)],
      });

      return snapshots;
    }),

  // ================================================================
  // Analytics Procedures
  // ================================================================

  /**
   * Get monthly income/expense trend for the last N months.
   * Returns array of { month, income, expenses, net }.
   */
  getMonthlyTrend: householdProcedure
    .input(GetMonthlyTrendSchema)
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - input.months);
      const cutoffStr = cutoffDate.toISOString();

      const result = await ctx.db
        .select({
          month: sql<string>`TO_CHAR(${transactions.date}::timestamptz, 'YYYY-MM')`,
          type: transactions.type,
          total: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC(12,2)))`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, ctx.householdId),
            gte(transactions.date, cutoffStr),
          )
        )
        .groupBy(sql`TO_CHAR(${transactions.date}::timestamptz, 'YYYY-MM')`, transactions.type)
        .orderBy(sql`TO_CHAR(${transactions.date}::timestamptz, 'YYYY-MM')`);

      // Pivot into { month, income, expenses, net } shape
      const monthMap = new Map<string, { income: number; expenses: number }>();
      for (const row of result) {
        const existing = monthMap.get(row.month) ?? { income: 0, expenses: 0 };
        const amount = parseFloat(row.total ?? "0");
        if (row.type === "income") {
          existing.income += amount;
        } else if (row.type === "expense") {
          existing.expenses += amount;
        }
        monthMap.set(row.month, existing);
      }

      return Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          income: data.income.toFixed(2),
          expenses: data.expenses.toFixed(2),
          net: (data.income - data.expenses).toFixed(2),
        }));
    }),

  /**
   * Bulk import transactions. Optionally update a linked account balance.
   */
  importTransactions: householdProcedure
    .input(ImportTransactionsSchema)
    .mutation(async ({ ctx, input }) => {
      const values = input.transactions.map((t) => ({
        householdId: ctx.householdId,
        createdBy: ctx.user.id,
        accountId: input.accountId ?? null,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        category: t.category,
        description: t.description,
        date: t.date,
        notes: t.notes ?? null,
        ownership: "ours" as const,
      }));

      const inserted = await ctx.db
        .insert(transactions)
        .values(values)
        .returning();

      // Update account balance if accountId provided
      if (input.accountId) {
        let netChange = 0;
        for (const t of input.transactions) {
          const amount = parseFloat(t.amount);
          if (t.type === "income") {
            netChange += amount;
          } else if (t.type === "expense") {
            netChange -= amount;
          }
        }

        if (netChange !== 0) {
          await ctx.db
            .update(accounts)
            .set({
              balance: sql`CAST(CAST(${accounts.balance} AS NUMERIC(12,2)) + ${netChange} AS TEXT)`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(accounts.id, input.accountId),
                eq(accounts.householdId, ctx.householdId),
              )
            );
        }
      }

      return { count: inserted.length };
    }),
});
