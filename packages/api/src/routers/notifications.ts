import { z } from "zod";
import { eq, and, isNull, desc, gte, lte } from "drizzle-orm";
import { notifications, pushTokens, profiles, events, eventAttendees } from "@orbyt/db/schema";
import { router, householdProcedure, protectedProcedure, publicProcedure } from "../trpc";
import type { DbClient } from "@orbyt/db";

// ---------------------------------------------------------------------------
// Internal utility: createNotification
// Inserts a notification row and returns it. Not a tRPC procedure — call from
// within other routers to fan-out notifications.
// ---------------------------------------------------------------------------
export async function createNotification(
  db: DbClient,
  params: {
    userId: string;
    householdId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    channels?: string[];
  }
): Promise<typeof notifications.$inferInsert> {
  const channels = params.channels ?? ["in_app"];

  const [row] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      householdId: params.householdId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: (params.data ?? {}) as { route?: string; entityId?: string; entityType?: string },
      channels,
      sentAt: new Date(),
    })
    .returning();

  return row!;
}

// ---------------------------------------------------------------------------
// Internal utility: sendPush
// Looks up all push tokens for a user and calls web-push for each one.
// Expired tokens (HTTP 410) are deleted. Safe to call even if web-push is
// not yet installed — logs a warning and returns silently in that case.
// ---------------------------------------------------------------------------
export async function sendPush(
  db: DbClient,
  userId: string,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  // Dynamic import so a missing package doesn't hard-crash the server at boot.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- web-push has no bundled types in all setups
  let webpush: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    webpush = require("web-push");
  } catch {
    console.warn("[sendPush] web-push is not installed — skipping push notification");
    return;
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidContact = process.env.VAPID_CONTACT_EMAIL;

  if (!vapidPublicKey || !vapidPrivateKey || !vapidContact) {
    console.warn("[sendPush] VAPID keys not configured — skipping push notification");
    return;
  }

  webpush.setVapidDetails(`mailto:${vapidContact}`, vapidPublicKey, vapidPrivateKey);

  const tokens = await db.query.pushTokens.findMany({
    where: eq(pushTokens.userId, userId),
  });

  if (tokens.length === 0) return;

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  });

  await Promise.all(
    tokens.map(async (tokenRow) => {
      try {
        await webpush.sendNotification(JSON.parse(tokenRow.token), notificationPayload);
      } catch (err: unknown) {
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : null;

        if (statusCode === 410) {
          // Token expired — remove it
          await db.delete(pushTokens).where(eq(pushTokens.id, tokenRow.id));
        } else {
          console.error("[sendPush] Failed to send push notification:", err);
        }
      }
    })
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
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

  /**
   * Get notification preferences for the current user.
   * Uses opt-out model: {} means all enabled.
   */
  getPreferences: householdProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.query.profiles.findFirst({
      where: eq(profiles.id, ctx.user.id),
      columns: { notificationPreferences: true },
    });

    return profile?.notificationPreferences ?? {};
  }),

  /**
   * Update notification preferences for the current user.
   * Merges with existing preferences (patch semantics).
   */
  updatePreferences: householdProcedure
    .input(
      z.object({
        billDue: z.boolean().optional(),
        taskAssigned: z.boolean().optional(),
        taskCompleted: z.boolean().optional(),
        eventReminder: z.boolean().optional(),
        birthdayReminder: z.boolean().optional(),
        memberJoined: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch current prefs to merge
      const current = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.id, ctx.user.id),
        columns: { notificationPreferences: true },
      });

      const existing = current?.notificationPreferences ?? {};
      const merged = { ...existing, ...input };

      await ctx.db
        .update(profiles)
        .set({
          notificationPreferences: merged,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, ctx.user.id));

      return merged;
    }),

  /**
   * checkReminders — called by a Vercel cron route.
   * Scans events whose reminderMinutes windows fall within the last 5 minutes,
   * creates in-app notifications, and fires push notifications for opted-in users.
   *
   * The calling cron route must validate CRON_SECRET before invoking this procedure.
   */
  checkReminders: publicProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    // Look-back window: 5 minutes
    const windowMs = 24 * 60 * 60 * 1000;

    // Fetch future events that have at least one reminderMinutes value.
    // We use a broad query and filter in JS to avoid complex SQL on array columns.
    const upcomingEvents = await ctx.db.query.events.findMany({
      where: gte(events.startAt, now),
      with: {
        attendees: true,
      },
    });

    let sent = 0;

    for (const event of upcomingEvents) {
      if (!event.reminderMinutes || event.reminderMinutes.length === 0) continue;

      for (const minutes of event.reminderMinutes) {
        // The moment this reminder should fire
        const reminderFireAt = new Date(event.startAt.getTime() - minutes * 60 * 1000);

        // Check if the reminder window falls within (now - 5min, now]
        const windowStart = new Date(now.getTime() - windowMs);
        if (reminderFireAt <= windowStart || reminderFireAt > now) continue;

        // Fire notification for each attendee
        for (const attendee of event.attendees) {
          if (!attendee.userId) continue;

          // Load the attendee's profile to check notification preferences
          const profile = await ctx.db.query.profiles.findFirst({
            where: eq(profiles.id, attendee.userId),
            columns: { notificationPreferences: true },
          });

          const prefs = profile?.notificationPreferences ?? {};

          // Opt-out model: undefined means enabled; false means disabled
          if (prefs.eventReminder === false) continue;

          const title = `Reminder: ${event.title}`;
          const body =
            minutes === 0
              ? "This event is starting now."
              : `This event starts in ${minutes < 60 ? `${minutes} minute${minutes !== 1 ? "s" : ""}` : `${Math.round(minutes / 60)} hour${Math.round(minutes / 60) !== 1 ? "s" : ""}`}.`;

          await createNotification(ctx.db, {
            userId: attendee.userId,
            householdId: event.householdId,
            type: "event_reminder",
            title,
            body,
            data: {
              entityType: "event",
              entityId: event.id,
              route: `/calendar`,
            },
            channels: prefs.pushEnabled === false ? ["in_app"] : ["in_app", "push"],
          });

          // Send push notification if push is not disabled
          if (prefs.pushEnabled !== false) {
            await sendPush(ctx.db, attendee.userId, { title, body, data: { eventId: event.id } });
          }

          sent++;
        }
      }
    }

    return { sent };
  }),
});
