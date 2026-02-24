import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { eq, and, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { google } from "googleapis";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { connectedAccounts, externalEvents } from "@orbyt/db/schema";
import {
  ConnectAccountSchema,
  HandleCallbackSchema,
  DisconnectAccountSchema,
  SyncCalendarSchema,
  ListExternalEventsSchema,
} from "@orbyt/shared/validators";
import { router, protectedProcedure } from "../trpc";

// ---------------------------------------------------------------------------
// Encryption helpers — AES-256-GCM
// INTEGRATION_ENCRYPTION_KEY must be 32 bytes (64 hex chars) in env.
// Format stored: iv:authTag:ciphertext (all hex)
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) throw new Error("INTEGRATION_ENCRYPTION_KEY not configured");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return buf;
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(data: string): string {
  const key = getEncryptionKey();
  const parts = data.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted data format");
  const [ivHex, authTagHex, cipherHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(cipherHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function buildGoogleOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getBaseUrl()}/api/auth/callback/google`
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
// Router
// ---------------------------------------------------------------------------

export const integrationsRouter = router({
  /**
   * Generate an OAuth authorization URL for Google or Microsoft.
   * Returns the URL to redirect the user to and a state token for CSRF protection.
   */
  getOAuthUrl: protectedProcedure
    .input(ConnectAccountSchema)
    .query(async ({ input }) => {
      const state = randomBytes(16).toString("hex");

      if (input.provider === "google") {
        const oauth2Client = buildGoogleOAuthClient();
        const url = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: ["https://www.googleapis.com/auth/calendar.readonly"],
          state,
          prompt: "consent",
        });
        return { url, state };
      }

      // Microsoft
      const cca = buildMsalApp();
      const url = await cca.getAuthCodeUrl({
        scopes: ["Calendars.Read"],
        redirectUri: `${getBaseUrl()}/api/auth/callback/microsoft`,
        state,
      });
      return { url, state };
    }),

  /**
   * Exchange an OAuth authorization code for tokens and store them.
   * Encrypts the refresh token before persisting.
   * Returns the new connected account ID.
   */
  handleCallback: protectedProcedure
    .input(HandleCallbackSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      if (input.provider === "google") {
        const oauth2Client = buildGoogleOAuthClient();

        // Exchange the code for tokens
        const { tokens } = await oauth2Client.getToken(input.code);

        if (!tokens.refresh_token) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "No refresh token returned from Google. Ensure you revoke access and reconnect.",
          });
        }

        // Get user email from Google
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const { data: userInfo } = await oauth2.userinfo.get();

        const providerAccountId = userInfo.id ?? userInfo.email ?? "unknown";
        const encryptedRefresh = encrypt(tokens.refresh_token);
        const encryptedAccess = tokens.access_token ? encrypt(tokens.access_token) : null;
        const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

        const [account] = await ctx.db
          .insert(connectedAccounts)
          .values({
            userId,
            provider: "google",
            providerAccountId,
            email: userInfo.email ?? null,
            accessToken: encryptedAccess,
            refreshToken: encryptedRefresh,
            tokenExpiresAt: expiresAt,
            scopes: "https://www.googleapis.com/auth/calendar.readonly",
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [
              connectedAccounts.userId,
              connectedAccounts.provider,
              connectedAccounts.providerAccountId,
            ],
            set: {
              email: userInfo.email ?? null,
              accessToken: encryptedAccess,
              refreshToken: encryptedRefresh,
              tokenExpiresAt: expiresAt,
              isActive: true,
              syncError: null,
              updatedAt: new Date(),
            },
          })
          .returning({ id: connectedAccounts.id });

        return { success: true, accountId: account!.id };
      }

      // Microsoft
      const cca = buildMsalApp();
      const tokenResponse = await cca.acquireTokenByCode({
        code: input.code,
        scopes: ["Calendars.Read"],
        redirectUri: `${getBaseUrl()}/api/auth/callback/microsoft`,
      });

      if (!tokenResponse) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to acquire token from Microsoft",
        });
      }

      // Get user profile from Microsoft Graph
      const graphClient = Client.init({
        authProvider: (done: (err: Error | null, token: string | null) => void) => {
          done(null, tokenResponse.accessToken);
        },
      });
      const me = await graphClient.api("/me").get() as { id?: string; mail?: string; userPrincipalName?: string };

      const providerAccountId = me.id ?? me.mail ?? "unknown";
      const email = me.mail ?? me.userPrincipalName ?? null;

      // Microsoft MSAL token responses carry the refresh token in the cache;
      // we store what we can — access token encrypted, and note the expiry.
      const encryptedAccess = encrypt(tokenResponse.accessToken);
      // MSAL manages refresh internally via cache; we store the access token
      // and rely on acquireTokenByRefreshToken via the silent flow when syncing.
      // For a persistent refresh token we use the raw cache entry if available.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MSAL internal cache shape
      const cacheData = JSON.parse((cca.getTokenCache() as any).serialize()) as {
        RefreshToken?: Record<string, { secret?: string }>;
      };
      const refreshEntries = Object.values(cacheData.RefreshToken ?? {});
      const rawRefresh = refreshEntries[0]?.secret ?? null;
      const encryptedRefresh = rawRefresh ? encrypt(rawRefresh) : null;
      const expiresAt = tokenResponse.expiresOn ?? null;

      const [account] = await ctx.db
        .insert(connectedAccounts)
        .values({
          userId,
          provider: "microsoft",
          providerAccountId,
          email,
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          tokenExpiresAt: expiresAt,
          scopes: "Calendars.Read",
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [
            connectedAccounts.userId,
            connectedAccounts.provider,
            connectedAccounts.providerAccountId,
          ],
          set: {
            email,
            accessToken: encryptedAccess,
            refreshToken: encryptedRefresh,
            tokenExpiresAt: expiresAt,
            isActive: true,
            syncError: null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: connectedAccounts.id });

      return { success: true, accountId: account!.id };
    }),

  /**
   * List all active connected accounts for the current user.
   * DOES NOT return access or refresh tokens.
   */
  listConnectedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db.query.connectedAccounts.findMany({
      where: and(
        eq(connectedAccounts.userId, ctx.user.id),
        eq(connectedAccounts.isActive, true)
      ),
      columns: {
        id: true,
        provider: true,
        email: true,
        lastSyncAt: true,
        syncError: true,
        isActive: true,
        createdAt: true,
        // Explicitly exclude tokens
        accessToken: false,
        refreshToken: false,
      },
    });

    return accounts;
  }),

  /**
   * Disconnect (delete) a connected account and all its synced external events.
   * Verifies the account belongs to the current user.
   */
  disconnectAccount: protectedProcedure
    .input(DisconnectAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.query.connectedAccounts.findFirst({
        where: and(
          eq(connectedAccounts.id, input.accountId),
          eq(connectedAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connected account not found or does not belong to you",
        });
      }

      // Delete all external events for this account first (FK cascade also handles
      // this, but being explicit avoids relying on DB-level cascade behavior)
      await ctx.db
        .delete(externalEvents)
        .where(eq(externalEvents.connectedAccountId, input.accountId));

      // Delete the connected account record
      await ctx.db
        .delete(connectedAccounts)
        .where(eq(connectedAccounts.id, input.accountId));

      return { success: true };
    }),

  /**
   * Sync calendar events from an external provider into external_events.
   * Fetches the next 90 days of events and upserts them.
   * Refreshes the access token if it is expired.
   */
  syncCalendar: protectedProcedure
    .input(SyncCalendarSchema)
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.query.connectedAccounts.findFirst({
        where: and(
          eq(connectedAccounts.id, input.accountId),
          eq(connectedAccounts.userId, ctx.user.id)
        ),
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connected account not found or does not belong to you",
        });
      }

      // Rate-limit: 1-minute cooldown between syncs
      if (account.lastSyncAt) {
        const msSinceLastSync = Date.now() - account.lastSyncAt.getTime();
        if (msSinceLastSync < 60_000) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Please wait at least 1 minute between syncs.",
          });
        }
      }

      const now = new Date();
      const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      let syncedCount = 0;

      try {
        if (account.provider === "google") {
          const oauth2Client = buildGoogleOAuthClient();

          // Check if the access token is expired and refresh if needed
          if (!account.tokenExpiresAt || account.tokenExpiresAt <= now) {
            if (!account.refreshToken) {
              throw new Error("No refresh token available to refresh Google access token");
            }
            oauth2Client.setCredentials({
              refresh_token: decrypt(account.refreshToken),
            });
            const { credentials } = await oauth2Client.refreshAccessToken();
            const newEncryptedAccess = credentials.access_token
              ? encrypt(credentials.access_token)
              : account.accessToken;
            const newExpiry = credentials.expiry_date
              ? new Date(credentials.expiry_date)
              : account.tokenExpiresAt;

            await ctx.db
              .update(connectedAccounts)
              .set({
                accessToken: newEncryptedAccess,
                tokenExpiresAt: newExpiry,
                updatedAt: new Date(),
              })
              .where(eq(connectedAccounts.id, account.id));

            // Use the new credentials for the API call
            // oauth2Client already has refreshed credentials set above
          } else if (account.accessToken) {
            oauth2Client.setCredentials({
              access_token: decrypt(account.accessToken),
              refresh_token: account.refreshToken ? decrypt(account.refreshToken) : undefined,
            });
          } else {
            throw new Error("No access token available for Google sync");
          }

          const calendar = google.calendar({ version: "v3", auth: oauth2Client });
          const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: timeMax.toISOString(),
            maxResults: 500,
            singleEvents: true,
            orderBy: "startTime",
          });

          const items = response.data.items ?? [];

          for (const item of items) {
            if (!item.id || !item.summary) continue;

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

            await ctx.db
              .insert(externalEvents)
              .values({
                connectedAccountId: account.id,
                userId: ctx.user.id,
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
                } as Record<string, unknown>,
                lastUpdatedExternal: lastUpdated,
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
                  updatedAt: new Date(),
                },
              });

            syncedCount++;
          }
        } else {
          // Microsoft
          const cca = buildMsalApp();

          if (!account.refreshToken) {
            throw new Error("No refresh token available for Microsoft sync");
          }

          const tokenResponse = await cca.acquireTokenByRefreshToken({
            refreshToken: decrypt(account.refreshToken),
            scopes: ["Calendars.Read"],
          });

          if (!tokenResponse) {
            throw new Error("Failed to refresh Microsoft access token");
          }

          // Update stored token
          const newEncryptedAccess = encrypt(tokenResponse.accessToken);
          await ctx.db
            .update(connectedAccounts)
            .set({
              accessToken: newEncryptedAccess,
              tokenExpiresAt: tokenResponse.expiresOn ?? account.tokenExpiresAt,
              updatedAt: new Date(),
            })
            .where(eq(connectedAccounts.id, account.id));

          const graphClient = Client.init({
            authProvider: (done: (err: Error | null, token: string | null) => void) => {
              done(null, tokenResponse.accessToken);
            },
          });

          const response = await graphClient
            .api("/me/calendarView")
            .query({
              startDateTime: now.toISOString(),
              endDateTime: timeMax.toISOString(),
              $top: 500,
              $select: "id,subject,body,location,start,end,isAllDay,showAs",
            })
            .get() as {
              value?: Array<{
                id: string;
                subject?: string;
                body?: { content?: string };
                location?: { displayName?: string };
                start?: { dateTime?: string; timeZone?: string };
                end?: { dateTime?: string; timeZone?: string };
                isAllDay?: boolean;
                showAs?: string;
              }>;
            };

          const items = response.value ?? [];

          for (const item of items) {
            if (!item.id || !item.subject) continue;

            const startAt = item.start?.dateTime ? new Date(item.start.dateTime) : null;
            const endAt = item.end?.dateTime ? new Date(item.end.dateTime) : null;

            if (!startAt) continue;

            const allDay = item.isAllDay ?? false;

            // Map showAs to a status string
            const status =
              item.showAs === "tentative"
                ? "tentative"
                : item.showAs === "free"
                  ? "cancelled"
                  : "confirmed";

            await ctx.db
              .insert(externalEvents)
              .values({
                connectedAccountId: account.id,
                userId: ctx.user.id,
                externalId: item.id,
                title: item.subject,
                description: item.body?.content ?? null,
                location: item.location?.displayName ?? null,
                startAt,
                endAt,
                allDay,
                status,
                metadata: {
                  showAs: item.showAs,
                } as Record<string, unknown>,
                lastUpdatedExternal: null,
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
                  updatedAt: new Date(),
                },
              });

            syncedCount++;
          }
        }

        // Mark sync as successful
        await ctx.db
          .update(connectedAccounts)
          .set({
            lastSyncAt: new Date(),
            syncError: null,
            updatedAt: new Date(),
          })
          .where(eq(connectedAccounts.id, account.id));
      } catch (err) {
        // Record the sync error and re-throw
        const message = err instanceof Error ? err.message : String(err);
        await ctx.db
          .update(connectedAccounts)
          .set({
            syncError: message,
            updatedAt: new Date(),
          })
          .where(eq(connectedAccounts.id, account.id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Calendar sync failed: ${message}`,
        });
      }

      return { synced: syncedCount };
    }),

  /**
   * List external events for the current user within a date range.
   * Ordered by start time ascending.
   */
  listExternalEvents: protectedProcedure
    .input(ListExternalEventsSchema)
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      const events = await ctx.db.query.externalEvents.findMany({
        where: and(
          eq(externalEvents.userId, ctx.user.id),
          gte(externalEvents.startAt, startDate),
          lte(externalEvents.startAt, endDate)
        ),
        orderBy: (table, { asc }) => [asc(table.startAt)],
      });

      return events;
    }),
});
