import { eq, and } from "drizzle-orm";
import { google } from "googleapis";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import {
  connectedAccounts,
  externalEvents,
  webhookSubscriptions,
  events,
  householdMembers,
} from "@orbyt/db/schema";
import { encrypt, decrypt } from "./encryption.js";
import { createNotification } from "../routers/notifications.js";

// ---------------------------------------------------------------------------
// OAuth client builders (duplicated here to avoid circular imports)
// ---------------------------------------------------------------------------

function buildGoogleOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/auth/callback/google`
  );
}

function buildMsalApp() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? "common"}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up the primary household ID for a user.
 * Returns null if the user has no household (should not happen in practice).
 */
async function getUserHouseholdId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle db type
  db: any,
  userId: string
): Promise<string | null> {
  const membership = await db.query.householdMembers.findFirst({
    where: eq(householdMembers.userId, userId),
    orderBy: (table: typeof householdMembers, { asc }: { asc: (col: unknown) => unknown }) => [
      asc(table.joinedAt),
    ],
    columns: { householdId: true },
  });
  return membership?.householdId ?? null;
}

// ---------------------------------------------------------------------------
// Google event upsert
// ---------------------------------------------------------------------------

async function upsertGoogleEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle db type
  db: any,
  account: typeof connectedAccounts.$inferSelect,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Google Calendar API item shape
  items: any[]
): Promise<void> {
  for (const item of items) {
    if (!item.id) continue;

    // Handle cancelled/deleted events
    if (item.status === "cancelled") {
      await db
        .update(externalEvents)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(externalEvents.connectedAccountId, account.id),
            eq(externalEvents.externalId, item.id)
          )
        );
      continue;
    }

    if (!item.summary) continue;

    const startAt = item.start?.dateTime
      ? new Date(item.start.dateTime)
      : item.start?.date
        ? new Date(item.start.date)
        : null;
    const endAt = item.end?.dateTime
      ? new Date(item.end.dateTime)
      : item.end?.date
        ? new Date(item.end.date)
        : null;

    if (!startAt) continue;

    const allDay = !item.start?.dateTime;
    const lastUpdated = item.updated ? new Date(item.updated) : null;
    const etag = item.etag ?? null;

    await db
      .insert(externalEvents)
      .values({
        connectedAccountId: account.id,
        userId: account.userId,
        externalId: item.id,
        title: item.summary,
        description: item.description ?? null,
        location: item.location ?? null,
        startAt,
        endAt,
        allDay,
        status: (item.status as string) ?? "confirmed",
        metadata: {
          htmlLink: item.htmlLink,
          colorId: item.colorId,
          organizer: item.organizer,
          sequence: item.sequence,
        } as Record<string, unknown>,
        lastUpdatedExternal: lastUpdated,
        etag,
      })
      .onConflictDoUpdate({
        target: [externalEvents.connectedAccountId, externalEvents.externalId],
        set: {
          title: item.summary,
          description: item.description ?? null,
          location: item.location ?? null,
          startAt,
          endAt,
          allDay,
          status: (item.status as string) ?? "confirmed",
          lastUpdatedExternal: lastUpdated,
          etag,
          updatedAt: new Date(),
        },
      });

    // Conflict detection: if this external event is linked to an Orbyt event
    const linked = await db.query.externalEvents.findFirst({
      where: and(
        eq(externalEvents.connectedAccountId, account.id),
        eq(externalEvents.externalId, item.id)
      ),
      columns: { orbytEventId: true },
    });

    if (linked?.orbytEventId && lastUpdated) {
      const orbytEvent = await db.query.events.findFirst({
        where: eq(events.id, linked.orbytEventId),
        columns: { updatedAt: true, lastSyncedAt: true, title: true },
      });

      if (orbytEvent) {
        const orbytUpdated = new Date(orbytEvent.updatedAt).getTime();
        const lastSynced = orbytEvent.lastSyncedAt
          ? new Date(orbytEvent.lastSyncedAt).getTime()
          : 0;
        const externalUpdated = lastUpdated.getTime();

        // Conflict: both sides changed since last sync
        if (orbytUpdated > lastSynced && externalUpdated > lastSynced) {
          // Last-write-wins: if external is newer, update Orbyt event
          if (externalUpdated > orbytUpdated) {
            await db
              .update(events)
              .set({
                title: item.summary,
                description: item.description ?? null,
                location: item.location ?? null,
                startAt,
                endAt,
                allDay,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(events.id, linked.orbytEventId));
          }

          // Create conflict notification — look up user's household
          const householdId = await getUserHouseholdId(db, account.userId);
          if (householdId) {
            await createNotification(db, {
              userId: account.userId,
              householdId,
              type: "sync_conflict",
              title: "Calendar sync conflict",
              body: `"${orbytEvent.title}" was modified in both Orbyt and ${account.provider}. The most recent version was kept.`,
              data: {
                route: "/calendar",
                entityType: "event",
                entityId: linked.orbytEventId,
              },
              channels: ["in_app"],
            });
          }
        } else if (externalUpdated > lastSynced) {
          // Only external changed — update Orbyt event silently
          await db
            .update(events)
            .set({
              title: item.summary,
              description: item.description ?? null,
              location: item.location ?? null,
              startAt,
              endAt,
              allDay,
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(events.id, linked.orbytEventId));
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Handle a Google Calendar push notification.
 * Google webhooks carry NO event payload — changes must be fetched using the
 * syncToken stored on the webhook_subscription row (or the connected_account).
 *
 * @param channelId  X-Goog-Channel-ID header from the notification
 * @param resourceId X-Goog-Resource-ID header from the notification
 */
export async function handleGoogleWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle db type
  db: any,
  channelId: string,
  resourceId: string
): Promise<void> {
  // Find the subscription
  const sub = await db.query.webhookSubscriptions.findFirst({
    where: and(
      eq(webhookSubscriptions.subscriptionId, channelId),
      eq(webhookSubscriptions.isActive, true)
    ),
    with: { connectedAccount: true },
  });

  if (!sub?.connectedAccount) return;
  const account = sub.connectedAccount;

  // Validate resourceId to prevent spoofed webhook notifications
  if (sub.resourceId && resourceId !== sub.resourceId) {
    console.warn("[webhook-google] resourceId mismatch, ignoring");
    return;
  }

  if (!account.refreshToken) return;

  const oauth2Client = buildGoogleOAuthClient();
  oauth2Client.setCredentials({ refresh_token: decrypt(account.refreshToken) });
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (credentials.access_token) {
    await db
      .update(connectedAccounts)
      .set({
        accessToken: encrypt(credentials.access_token),
        tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        updatedAt: new Date(),
      })
      .where(eq(connectedAccounts.id, account.id));
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Try incremental sync with syncToken
  let syncToken = sub.syncToken ?? account.syncToken;
  let fullSync = !syncToken;

  if (!fullSync && syncToken) {
    try {
      const response = await calendar.events.list({
        calendarId: "primary",
        syncToken,
        maxResults: 250,
      });

      const items = response.data.items ?? [];
      await upsertGoogleEvents(db, account, items);

      // Store new sync token on both subscription and account
      if (response.data.nextSyncToken) {
        await db
          .update(webhookSubscriptions)
          .set({ syncToken: response.data.nextSyncToken, updatedAt: new Date() })
          .where(eq(webhookSubscriptions.id, sub.id));
        await db
          .update(connectedAccounts)
          .set({
            syncToken: response.data.nextSyncToken,
            lastSyncAt: new Date(),
            syncError: null,
            updatedAt: new Date(),
          })
          .where(eq(connectedAccounts.id, account.id));
      }
    } catch (err) {
      // 410 GONE means syncToken is expired — fall back to full sync
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: number }).code === 410
      ) {
        fullSync = true;
        syncToken = null;
      } else {
        throw err;
      }
    }
  }

  if (fullSync) {
    const now = new Date();
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 500,
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = response.data.items ?? [];
    await upsertGoogleEvents(db, account, items);

    if (response.data.nextSyncToken) {
      await db
        .update(webhookSubscriptions)
        .set({ syncToken: response.data.nextSyncToken, updatedAt: new Date() })
        .where(eq(webhookSubscriptions.id, sub.id));
      await db
        .update(connectedAccounts)
        .set({
          syncToken: response.data.nextSyncToken,
          lastSyncAt: new Date(),
          syncError: null,
          updatedAt: new Date(),
        })
        .where(eq(connectedAccounts.id, account.id));
    }
  }

}

/**
 * Handle a Microsoft Graph change notification.
 * Microsoft provides the changed resource path in the payload so we can fetch
 * the specific event rather than re-syncing the entire calendar.
 *
 * @param subscriptionId Microsoft Graph subscription ID from the notification
 * @param changeType     "created" | "updated" | "deleted"
 * @param resource       Resource path, e.g. "/me/events/{eventId}"
 */
export async function handleMicrosoftWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle db type
  db: any,
  subscriptionId: string,
  changeType: string,
  resource: string,
  clientState?: string
): Promise<void> {
  const sub = await db.query.webhookSubscriptions.findFirst({
    where: and(
      eq(webhookSubscriptions.subscriptionId, subscriptionId),
      eq(webhookSubscriptions.isActive, true)
    ),
    with: { connectedAccount: true },
  });

  if (!sub?.connectedAccount) return;
  const account = sub.connectedAccount;

  // Verify clientState to prevent spoofed webhook notifications
  if (clientState && clientState !== sub.subscriptionId) {
    console.warn("[webhook-microsoft] clientState mismatch, ignoring");
    return;
  }

  if (!account.refreshToken) return;

  const cca = buildMsalApp();
  const tokenResponse = await cca.acquireTokenByRefreshToken({
    refreshToken: decrypt(account.refreshToken),
    scopes: ["Calendars.ReadWrite"],
  });

  if (!tokenResponse) return;

  // Update stored token
  await db
    .update(connectedAccounts)
    .set({
      accessToken: encrypt(tokenResponse.accessToken),
      tokenExpiresAt: tokenResponse.expiresOn ?? null,
      updatedAt: new Date(),
    })
    .where(eq(connectedAccounts.id, account.id));

  const graphClient = Client.init({
    authProvider: (done: (err: Error | null, token: string | null) => void) => {
      done(null, tokenResponse.accessToken);
    },
  });

  // Extract event ID from resource path (e.g. "/me/events/eventId")
  const eventId = resource.split("/").pop();
  if (!eventId) return;

  if (changeType === "deleted") {
    await db
      .update(externalEvents)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(externalEvents.connectedAccountId, account.id),
          eq(externalEvents.externalId, eventId)
        )
      );
    return;
  }

  // Fetch the full event details from Graph
  try {
    const item = (await graphClient
      .api(`/me/events/${eventId}`)
      .select(
        "id,subject,body,location,start,end,isAllDay,showAs,lastModifiedDateTime,changeKey"
      )
      .get()) as {
      id: string;
      subject?: string;
      body?: { content?: string };
      location?: { displayName?: string };
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      isAllDay?: boolean;
      showAs?: string;
      lastModifiedDateTime?: string;
      changeKey?: string;
    };

    if (!item.subject) return;

    const startAt = item.start?.dateTime ? new Date(item.start.dateTime) : null;
    const endAt = item.end?.dateTime ? new Date(item.end.dateTime) : null;
    if (!startAt) return;

    const allDay = item.isAllDay ?? false;
    const status =
      item.showAs === "tentative"
        ? "tentative"
        : item.showAs === "free"
          ? "cancelled"
          : "confirmed";
    const lastUpdated = item.lastModifiedDateTime
      ? new Date(item.lastModifiedDateTime)
      : null;
    const etag = item.changeKey ?? null;

    await db
      .insert(externalEvents)
      .values({
        connectedAccountId: account.id,
        userId: account.userId,
        externalId: item.id,
        title: item.subject,
        description: item.body?.content ?? null,
        location: item.location?.displayName ?? null,
        startAt,
        endAt,
        allDay,
        status,
        metadata: { showAs: item.showAs } as Record<string, unknown>,
        lastUpdatedExternal: lastUpdated,
        etag,
      })
      .onConflictDoUpdate({
        target: [externalEvents.connectedAccountId, externalEvents.externalId],
        set: {
          title: item.subject,
          description: item.body?.content ?? null,
          location: item.location?.displayName ?? null,
          startAt,
          endAt,
          allDay,
          status,
          lastUpdatedExternal: lastUpdated,
          etag,
          updatedAt: new Date(),
        },
      });

    // Update the connected account sync timestamp
    await db
      .update(connectedAccounts)
      .set({ lastSyncAt: new Date(), syncError: null, updatedAt: new Date() })
      .where(eq(connectedAccounts.id, account.id));
  } catch (err) {
    console.error(
      `[webhook/microsoft] Failed to fetch event ${eventId}:`,
      err instanceof Error ? err.message : err
    );
  }
}
