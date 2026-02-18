import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { notifications, pushTokens } from "@orbyt/db/schema";
import { router, householdProcedure, protectedProcedure } from "../trpc";

export const notificationsRouter = router({
  /**
   * List notifications for the current user (newest first).
   */
  list: householdProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().default(false),
        limit: z.number().max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(notifications.userId, ctx.user.id),
        eq(notifications.householdId, ctx.householdId),
      ];

      if (input.unreadOnly) {
        conditions.push(isNull(notifications.readAt));
      }

      return ctx.db.query.notifications.findMany({
        where: and(...conditions),
        orderBy: [desc(notifications.createdAt)],
        limit: input.limit,
      });
    }),

  /**
   * Get unread notification count.
   */
  getUnreadCount: householdProcedure.query(async ({ ctx }) => {
    const unread = await ctx.db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, ctx.user.id),
        eq(notifications.householdId, ctx.householdId),
        isNull(notifications.readAt)
      ),
    });
    return { count: unread.length };
  }),

  /**
   * Mark a notification as read.
   */
  markRead: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),

  /**
   * Mark all notifications as read.
   */
  markAllRead: householdProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.householdId, ctx.householdId),
          isNull(notifications.readAt)
        )
      );
    return { success: true };
  }),

  /**
   * Register a push token for the current device.
   */
  registerPushToken: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1),
        platform: z.enum(["ios", "android", "web"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(pushTokens)
        .values({
          userId: ctx.user!.id,
          token: input.token,
          platform: input.platform,
        })
        .onConflictDoUpdate({
          target: [pushTokens.userId, pushTokens.token],
          set: { updatedAt: new Date() },
        });
      return { success: true };
    }),
});
