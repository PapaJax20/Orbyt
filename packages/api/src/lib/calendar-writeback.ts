import { eq, and } from "drizzle-orm";
import { google } from "googleapis";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { connectedAccounts, events } from "@orbyt/db/schema";
// @ts-ignore — Turbopack .js→.ts resolution
import { encrypt, decrypt } from "./encryption";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle db type passed from tRPC ctx
type AnyDb = any;

export interface OrbytEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  rrule: string | null;
  color: string | null;
}

export type WriteBackAction = "create" | "update" | "delete";

// ---------------------------------------------------------------------------
// OAuth client builders
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
// Event field mappers
// ---------------------------------------------------------------------------

/**
 * Map Orbyt event fields to Google Calendar event format.
 */
function mapToGoogleEvent(event: OrbytEvent): Record<string, unknown> {
  const base: Record<string, unknown> = {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
  };

  if (event.allDay) {
    const dateStr = event.startAt.toISOString().split("T")[0];
    base.start = { date: dateStr };
    base.end = event.endAt
      ? { date: event.endAt.toISOString().split("T")[0] }
      : { date: dateStr };
  } else {
    base.start = { dateTime: event.startAt.toISOString() };
    base.end = event.endAt
      ? { dateTime: event.endAt.toISOString() }
      : { dateTime: event.startAt.toISOString() };
  }

  return base;
}

/**
 * Map Orbyt event fields to Microsoft Graph event format.
 */
function mapToMicrosoftEvent(event: OrbytEvent): Record<string, unknown> {
  return {
    subject: event.title,
    body: event.description
      ? { contentType: "text", content: event.description }
      : undefined,
    location: event.location ? { displayName: event.location } : undefined,
    isAllDay: event.allDay,
    start: {
      dateTime: event.startAt.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: (event.endAt ?? event.startAt).toISOString(),
      timeZone: "UTC",
    },
  };
}

// ---------------------------------------------------------------------------
// Per-provider write-back helpers
// ---------------------------------------------------------------------------

/**
 * Write back an Orbyt event to a single Google Calendar account.
 * Returns the external event ID on create, or null.
 */
async function writeBackToGoogle(
  db: AnyDb,
  account: typeof connectedAccounts.$inferSelect,
  event: OrbytEvent,
  action: WriteBackAction
): Promise<string | null> {
  if (!account.refreshToken) return null;

  const oauth2Client = buildGoogleOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: decrypt(account.refreshToken),
  });

  // Refresh access token
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (credentials.access_token) {
    const newEncryptedAccess = encrypt(credentials.access_token);
    await db
      .update(connectedAccounts)
      .set({
        accessToken: newEncryptedAccess,
        tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        updatedAt: new Date(),
      })
      .where(eq(connectedAccounts.id, account.id));
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  if (action === "create") {
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: mapToGoogleEvent(event),
    });
    return response.data.id ?? null;
  }

  // For update/delete, we need the external event ID from the events table
  const orbytEvent = await db.query.events.findFirst({
    where: eq(events.id, event.id),
    columns: { externalEventId: true },
  });

  if (!orbytEvent?.externalEventId) return null;

  if (action === "update") {
    const response = await calendar.events.update({
      calendarId: "primary",
      eventId: orbytEvent.externalEventId,
      requestBody: mapToGoogleEvent(event),
    });
    return response.data.id ?? orbytEvent.externalEventId;
  }

  if (action === "delete") {
    await calendar.events.delete({
      calendarId: "primary",
      eventId: orbytEvent.externalEventId,
    });
    return null;
  }

  return null;
}

/**
 * Write back an Orbyt event to a single Microsoft Graph account.
 */
async function writeBackToMicrosoft(
  db: AnyDb,
  account: typeof connectedAccounts.$inferSelect,
  event: OrbytEvent,
  action: WriteBackAction
): Promise<string | null> {
  if (!account.refreshToken) return null;

  const cca = buildMsalApp();
  const tokenResponse = await cca.acquireTokenByRefreshToken({
    refreshToken: decrypt(account.refreshToken),
    scopes: ["Calendars.ReadWrite"],
  });

  if (!tokenResponse) return null;

  // Update stored token
  const newEncryptedAccess = encrypt(tokenResponse.accessToken);
  await db
    .update(connectedAccounts)
    .set({
      accessToken: newEncryptedAccess,
      tokenExpiresAt: tokenResponse.expiresOn ?? null,
      updatedAt: new Date(),
    })
    .where(eq(connectedAccounts.id, account.id));

  const graphClient = Client.init({
    authProvider: (done: (err: Error | null, token: string | null) => void) => {
      done(null, tokenResponse.accessToken);
    },
  });

  if (action === "create") {
    const response = (await graphClient
      .api("/me/events")
      .post(mapToMicrosoftEvent(event))) as { id?: string };
    return response.id ?? null;
  }

  // For update/delete, look up the external event ID
  const orbytEvent = await db.query.events.findFirst({
    where: eq(events.id, event.id),
    columns: { externalEventId: true },
  });

  if (!orbytEvent?.externalEventId) return null;

  if (action === "update") {
    await graphClient
      .api(`/me/events/${orbytEvent.externalEventId}`)
      .patch(mapToMicrosoftEvent(event));
    return orbytEvent.externalEventId;
  }

  if (action === "delete") {
    await graphClient.api(`/me/events/${orbytEvent.externalEventId}`).delete();
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Write back an Orbyt event to ALL connected accounts with write scopes.
 * This is async fire-and-forget — never throws to the caller.
 *
 * Call with `void writeBackToConnectedAccounts(...)` from mutation handlers.
 */
export async function writeBackToConnectedAccounts(
  db: AnyDb,
  userId: string,
  event: OrbytEvent,
  action: WriteBackAction
): Promise<void> {
  try {
    const accounts = await db.query.connectedAccounts.findMany({
      where: and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.isActive, true)
      ),
    });

    for (const account of accounts) {
      // Check if account has write scopes
      const scopes = account.scopes ?? "";
      const hasWriteScope =
        account.provider === "google"
          ? scopes.includes("calendar.events")
          : scopes.includes("ReadWrite");

      if (!hasWriteScope) continue;

      try {
        let externalId: string | null = null;

        if (account.provider === "google") {
          externalId = await writeBackToGoogle(db, account, event, action);
        } else if (account.provider === "microsoft") {
          externalId = await writeBackToMicrosoft(db, account, event, action);
        }

        // Store the external event ID on the Orbyt event for future updates/deletes
        if (externalId && action === "create") {
          await db
            .update(events)
            .set({
              externalEventId: externalId,
              externalProvider: account.provider,
              connectedAccountId: account.id,
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(events.id, event.id));
        } else if (action !== "delete") {
          await db
            .update(events)
            .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
            .where(eq(events.id, event.id));
        }
      } catch (err) {
        // Log but don't throw — fire-and-forget
        console.error(
          `[write-back] ${action} failed for account ${account.id} (${account.provider}):`,
          err instanceof Error ? err.message : err
        );
      }
    }
  } catch (err) {
    console.error(
      "[write-back] Fatal error:",
      err instanceof Error ? err.message : err
    );
  }
}
