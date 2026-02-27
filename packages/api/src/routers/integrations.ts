import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { eq, and, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
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
import {
  ConnectAccountSchema,
  HandleCallbackSchema,
  DisconnectAccountSchema,
  SyncCalendarSchema,
  ListExternalEventsSchema,
  CheckScopesSchema,
  WriteBackEventSchema,
  RegisterWebhookSchema,
  LinkEventSchema,
  UnlinkEventSchema,
} from "@orbyt/shared/validators";
import { router, protectedProcedure } from "../trpc";
// @ts-ignore — Turbopack .js→.ts resolution
import { encrypt, decrypt } from "../lib/encryption";
// @ts-ignore — Turbopack .js→.ts resolution
import { writeBackToConnectedAccounts } from "../lib/calendar-writeback";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
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

      // Sign state with HMAC for server-side verification
      const encryptionKey = process.env["INTEGRATION_ENCRYPTION_KEY"];
      if (!encryptionKey) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing encryption key" });
      }
      const hmac = createHmac("sha256", encryptionKey).update(state).digest("hex");
      const signedState = `${state}.${hmac}`;

      if (input.provider === "google") {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Google Calendar integration is not yet configured. Please add OAuth credentials.",
          });
        }
        const oauth2Client = buildGoogleOAuthClient();
        const url = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/userinfo.email",
          ],
          state: signedState,
          prompt: "consent",
        });
        return { url, state: signedState };
      }

      // Microsoft
      if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Outlook Calendar integration is not yet configured. Please add OAuth credentials.",
        });
      }
      const cca = buildMsalApp();
      const url = await cca.getAuthCodeUrl({
        scopes: ["Calendars.ReadWrite"],
        redirectUri: `${getBaseUrl()}/api/auth/callback/microsoft`,
        state: signedState,
      });
      return { url, state: signedState };
    }),

  /**
   * Exchange an OAuth authorization code for tokens and store them.
   * Encrypts the refresh token before persisting.
   * Returns the new connected account ID.
   */
  handleCallback: protectedProcedure
    .input(HandleCallbackSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify HMAC on state
      const encryptionKey = process.env["INTEGRATION_ENCRYPTION_KEY"];
      if (!encryptionKey) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing encryption key" });
      }

      const parts = input.state.split(".");
      if (parts.length !== 2) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid OAuth state" });
      }

      const [stateValue, receivedHmac] = parts;
      const expectedHmac = createHmac("sha256", encryptionKey).update(stateValue!).digest("hex");

      if (
        receivedHmac!.length !== expectedHmac.length ||
        !timingSafeEqual(Buffer.from(receivedHmac!), Buffer.from(expectedHmac))
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid OAuth state" });
      }

      const userId = ctx.user.id;

      if (input.provider === "google") {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Google Calendar integration is not yet configured. Please add OAuth credentials.",
          });
        }
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
            scopes: "https://www.googleapis.com/auth/calendar",
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
              scopes: "https://www.googleapis.com/auth/calendar",
              isActive: true,
              syncError: null,
              updatedAt: new Date(),
            },
          })
          .returning({ id: connectedAccounts.id });

        return { success: true, accountId: account!.id };
      }

      // Microsoft
      if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Outlook Calendar integration is not yet configured. Please add OAuth credentials.",
        });
      }
      const cca = buildMsalApp();
      const tokenResponse = await cca.acquireTokenByCode({
        code: input.code,
        scopes: ["Calendars.ReadWrite"],
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
      const me = (await graphClient.api("/me").get()) as {
        id?: string;
        mail?: string;
        userPrincipalName?: string;
      };

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
          scopes: "Calendars.ReadWrite",
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
            scopes: "Calendars.ReadWrite",
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
        scopes: true,
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
   * Uses incremental sync (syncToken/deltaLink) when available.
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

          // Always try to refresh the token when syncing
          if (!account.refreshToken) {
            throw new Error("No refresh token available for Google sync");
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

          const calendar = google.calendar({ version: "v3", auth: oauth2Client });

          // Look up the user's primary household once for auto-import
          const membershipRow = await ctx.db.query.householdMembers.findFirst({
            where: eq(householdMembers.userId, ctx.user.id),
            orderBy: (table, { asc }) => [asc(table.joinedAt)],
            columns: { householdId: true },
          });
          const userHouseholdId = membershipRow?.householdId ?? null;

          // Incremental sync: use syncToken if available
          let fullSync = !account.syncToken;

          if (!fullSync && account.syncToken) {
            try {
              const response = await calendar.events.list({
                calendarId: "primary",
                syncToken: account.syncToken,
                maxResults: 500,
              });

              const items = response.data.items ?? [];
              for (const item of items) {
                if (!item.id) continue;

                // Handle cancelled/deleted events
                if (item.status === "cancelled") {
                  await ctx.db
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
                    ? new Date(item.start.date + "T00:00:00")
                    : null;
                const endAt = item.end?.dateTime
                  ? new Date(item.end.dateTime)
                  : item.end?.date
                    ? new Date(item.end.date + "T00:00:00")
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

                // Auto-import: create a linked Orbyt event if not already linked
                if (userHouseholdId) {
                  const extRowInc = await ctx.db.query.externalEvents.findFirst({
                    where: and(
                      eq(externalEvents.connectedAccountId, account.id),
                      eq(externalEvents.externalId, item.id)
                    ),
                    columns: { id: true, orbytEventId: true },
                  });

                  if (extRowInc && !extRowInc.orbytEventId) {
                    const [newEvent] = await ctx.db
                      .insert(events)
                      .values({
                        householdId: userHouseholdId,
                        createdBy: ctx.user.id,
                        title: item.summary ?? "Untitled",
                        startAt,
                        endAt,
                        allDay,
                        category: "other",
                        description: item.description ?? null,
                        location: item.location ?? null,
                        externalEventId: item.id,
                        connectedAccountId: account.id,
                        lastSyncedAt: new Date(),
                      })
                      .returning({ id: events.id });

                    if (newEvent) {
                      await ctx.db
                        .update(externalEvents)
                        .set({ orbytEventId: newEvent.id, updatedAt: new Date() })
                        .where(eq(externalEvents.id, extRowInc.id));
                    }
                  }
                }

                syncedCount++;
              }

              // Store new sync token
              if (response.data.nextSyncToken) {
                await ctx.db
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
                // Clear the stale syncToken
                await ctx.db
                  .update(connectedAccounts)
                  .set({ syncToken: null, updatedAt: new Date() })
                  .where(eq(connectedAccounts.id, account.id));
              } else {
                throw err;
              }
            }
          }

          if (fullSync) {
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
                  ? new Date(item.start.date + "T00:00:00")
                  : null;
              const endAt = item.end?.dateTime
                ? new Date(item.end.dateTime)
                : item.end?.date
                  ? new Date(item.end.date + "T00:00:00")
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

              // Auto-import: create a linked Orbyt event if not already linked
              if (userHouseholdId) {
                const extRowFull = await ctx.db.query.externalEvents.findFirst({
                  where: and(
                    eq(externalEvents.connectedAccountId, account.id),
                    eq(externalEvents.externalId, item.id)
                  ),
                  columns: { id: true, orbytEventId: true },
                });

                if (extRowFull && !extRowFull.orbytEventId) {
                  const [newEvent] = await ctx.db
                    .insert(events)
                    .values({
                      householdId: userHouseholdId,
                      createdBy: ctx.user.id,
                      title: item.summary ?? "Untitled",
                      startAt,
                      endAt,
                      allDay,
                      category: "other",
                      description: item.description ?? null,
                      location: item.location ?? null,
                      externalEventId: item.id,
                      connectedAccountId: account.id,
                      lastSyncedAt: new Date(),
                    })
                    .returning({ id: events.id });

                  if (newEvent) {
                    await ctx.db
                      .update(externalEvents)
                      .set({ orbytEventId: newEvent.id, updatedAt: new Date() })
                      .where(eq(externalEvents.id, extRowFull.id));
                  }
                }
              }

              syncedCount++;
            }

            // Store the new sync token for future incremental syncs
            if (response.data.nextSyncToken) {
              await ctx.db
                .update(connectedAccounts)
                .set({
                  syncToken: response.data.nextSyncToken,
                  lastSyncAt: new Date(),
                  syncError: null,
                  updatedAt: new Date(),
                })
                .where(eq(connectedAccounts.id, account.id));
              return { synced: syncedCount };
            }
          }
        } else {
          // Microsoft
          const cca = buildMsalApp();

          if (!account.refreshToken) {
            throw new Error("No refresh token available for Microsoft sync");
          }

          const tokenResponse = await cca.acquireTokenByRefreshToken({
            refreshToken: decrypt(account.refreshToken),
            scopes: ["Calendars.ReadWrite"],
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

          // Incremental sync: use deltaLink if available
          let newDeltaLink: string | null = null;

          if (account.deltaLink) {
            try {
              // Follow the delta link for incremental sync
              const deltaResponse = (await graphClient
                .api(account.deltaLink)
                .get()) as {
                value?: Array<{
                  id: string;
                  subject?: string;
                  body?: { content?: string };
                  location?: { displayName?: string };
                  start?: { dateTime?: string };
                  end?: { dateTime?: string };
                  isAllDay?: boolean;
                  showAs?: string;
                  "@removed"?: { reason?: string };
                }>;
                "@odata.deltaLink"?: string;
              };

              const items = deltaResponse.value ?? [];

              for (const item of items) {
                if (!item.id) continue;

                // Handle deleted events — Microsoft marks them with @removed
                const removed = (item as Record<string, unknown>)["@removed"];
                if (removed) {
                  await ctx.db
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

                if (!item.subject) continue;

                const startAt = item.start?.dateTime ? new Date(item.start.dateTime) : null;
                const endAt = item.end?.dateTime ? new Date(item.end.dateTime) : null;
                if (!startAt) continue;

                const allDay = item.isAllDay ?? false;
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
                    metadata: { showAs: item.showAs } as Record<string, unknown>,
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

              newDeltaLink = deltaResponse["@odata.deltaLink"] ?? null;
            } catch {
              // Delta link expired — fall through to full sync
              newDeltaLink = null;
            }
          }

          if (!newDeltaLink) {
            // Full sync with delta request to get a new deltaLink
            const response = (await graphClient
              .api("/me/calendarView/delta")
              .query({
                startDateTime: now.toISOString(),
                endDateTime: timeMax.toISOString(),
                $top: 500,
                $select: "id,subject,body,location,start,end,isAllDay,showAs",
              })
              .get()) as {
              value?: Array<{
                id: string;
                subject?: string;
                body?: { content?: string };
                location?: { displayName?: string };
                start?: { dateTime?: string };
                end?: { dateTime?: string };
                isAllDay?: boolean;
                showAs?: string;
              }>;
              "@odata.deltaLink"?: string;
            };

            const items = response.value ?? [];

            for (const item of items) {
              if (!item.id || !item.subject) continue;

              const startAt = item.start?.dateTime ? new Date(item.start.dateTime) : null;
              const endAt = item.end?.dateTime ? new Date(item.end.dateTime) : null;

              if (!startAt) continue;

              const allDay = item.isAllDay ?? false;
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
                  metadata: { showAs: item.showAs } as Record<string, unknown>,
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

            newDeltaLink = response["@odata.deltaLink"] ?? null;
          }

          // Store the new delta link
          await ctx.db
            .update(connectedAccounts)
            .set({
              deltaLink: newDeltaLink,
              lastSyncAt: new Date(),
              syncError: null,
              updatedAt: new Date(),
            })
            .where(eq(connectedAccounts.id, account.id));

          return { synced: syncedCount };
        }

        // Mark sync as successful (Google full sync fallthrough)
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

      const externalEvtList = await ctx.db.query.externalEvents.findMany({
        where: and(
          eq(externalEvents.userId, ctx.user.id),
          gte(externalEvents.startAt, startDate),
          lte(externalEvents.startAt, endDate)
        ),
        orderBy: (table, { asc }) => [asc(table.startAt)],
      });

      return externalEvtList;
    }),

  /**
   * Check whether a connected account has write scopes for calendar events.
   */
  checkScopes: protectedProcedure
    .input(CheckScopesSchema)
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.query.connectedAccounts.findFirst({
        where: and(
          eq(connectedAccounts.id, input.accountId),
          eq(connectedAccounts.userId, ctx.user.id)
        ),
      });
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      const scopes = account.scopes ?? "";
      const hasWriteScope =
        account.provider === "google"
          ? scopes.includes("calendar")
          : scopes.includes("ReadWrite");

      return { hasWriteScope, currentScopes: scopes, needsReauth: !hasWriteScope };
    }),

  /**
   * Manually push an Orbyt event to an external calendar account.
   */
  writeBackEvent: protectedProcedure
    .input(WriteBackEventSchema)
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.query.connectedAccounts.findFirst({
        where: and(
          eq(connectedAccounts.id, input.accountId),
          eq(connectedAccounts.userId, ctx.user.id),
          eq(connectedAccounts.isActive, true)
        ),
      });
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      const event = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.eventId),
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });

      // Verify the caller is a member of the event's household
      const membership = await ctx.db.query.householdMembers.findFirst({
        where: and(
          eq(householdMembers.householdId, event.householdId),
          eq(householdMembers.userId, ctx.user.id)
        ),
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this event's household",
        });
      }

      const action = event.externalEventId ? "update" : "create";
      await writeBackToConnectedAccounts(
        ctx.db,
        ctx.user.id,
        {
          id: event.id,
          title: event.title,
          description: event.description ?? null,
          location: event.location ?? null,
          startAt: new Date(event.startAt),
          endAt: event.endAt ? new Date(event.endAt) : null,
          allDay: event.allDay,
          rrule: event.rrule ?? null,
          color: event.color ?? null,
        },
        action
      );

      return { success: true };
    }),

  /**
   * Register a push-notification webhook subscription with Google or Microsoft.
   * Persists the subscription in webhook_subscriptions.
   */
  registerWebhook: protectedProcedure
    .input(RegisterWebhookSchema)
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.query.connectedAccounts.findFirst({
        where: and(
          eq(connectedAccounts.id, input.accountId),
          eq(connectedAccounts.userId, ctx.user.id),
          eq(connectedAccounts.isActive, true)
        ),
      });
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      const baseUrl = getBaseUrl();

      const channelId = randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      if (account.provider === "google") {
        if (!account.refreshToken) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No refresh token" });
        }

        const oauth2Client = buildGoogleOAuthClient();
        oauth2Client.setCredentials({ refresh_token: decrypt(account.refreshToken) });
        const { credentials } = await oauth2Client.refreshAccessToken();
        if (credentials.access_token) {
          oauth2Client.setCredentials(credentials);
        }

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        const response = await calendar.events.watch({
          calendarId: "primary",
          requestBody: {
            id: channelId,
            type: "web_hook",
            address: `${baseUrl}/api/webhooks/google`,
            expiration: String(expiresAt.getTime()),
          },
        });

        await ctx.db
          .insert(webhookSubscriptions)
          .values({
            connectedAccountId: account.id,
            provider: "google",
            subscriptionId: channelId,
            resourceId: response.data.resourceId ?? null,
            notificationUrl: `${baseUrl}/api/webhooks/google`,
            expiresAt,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [webhookSubscriptions.connectedAccountId, webhookSubscriptions.provider],
            set: {
              subscriptionId: channelId,
              resourceId: response.data.resourceId ?? null,
              expiresAt,
              isActive: true,
              updatedAt: new Date(),
            },
          });
      } else {
        // Microsoft
        if (!account.refreshToken) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No refresh token" });
        }

        const cca = buildMsalApp();
        const tokenResponse = await cca.acquireTokenByRefreshToken({
          refreshToken: decrypt(account.refreshToken),
          scopes: ["Calendars.ReadWrite"],
        });
        if (!tokenResponse) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to refresh Microsoft token",
          });
        }

        const graphClient = Client.init({
          authProvider: (done: (err: Error | null, token: string | null) => void) => {
            done(null, tokenResponse.accessToken);
          },
        });

        const msExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days for Microsoft
        const subscription = (await graphClient.api("/subscriptions").post({
          changeType: "created,updated,deleted",
          notificationUrl: `${baseUrl}/api/webhooks/microsoft`,
          resource: "/me/events",
          expirationDateTime: msExpiresAt.toISOString(),
          clientState: channelId, // use as verification token
        })) as { id?: string };

        await ctx.db
          .insert(webhookSubscriptions)
          .values({
            connectedAccountId: account.id,
            provider: "microsoft",
            subscriptionId: subscription.id ?? channelId,
            notificationUrl: `${baseUrl}/api/webhooks/microsoft`,
            expiresAt: msExpiresAt,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [webhookSubscriptions.connectedAccountId, webhookSubscriptions.provider],
            set: {
              subscriptionId: subscription.id ?? channelId,
              expiresAt: msExpiresAt,
              isActive: true,
              updatedAt: new Date(),
            },
          });

        return { success: true, expiresAt: msExpiresAt };
      }

      return { success: true, expiresAt };
    }),

  /**
   * Unregister a push-notification webhook subscription.
   */
  unregisterWebhook: protectedProcedure
    .input(RegisterWebhookSchema) // same input shape — just needs accountId
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.query.connectedAccounts.findFirst({
        where: and(
          eq(connectedAccounts.id, input.accountId),
          eq(connectedAccounts.userId, ctx.user.id)
        ),
      });
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      const sub = await ctx.db.query.webhookSubscriptions.findFirst({
        where: and(
          eq(webhookSubscriptions.connectedAccountId, input.accountId),
          eq(webhookSubscriptions.isActive, true)
        ),
      });
      if (!sub) return { success: true }; // Already unregistered

      try {
        if (account.provider === "google" && sub.resourceId) {
          const oauth2Client = buildGoogleOAuthClient();
          if (account.refreshToken) {
            oauth2Client.setCredentials({ refresh_token: decrypt(account.refreshToken) });
            await oauth2Client.refreshAccessToken();
          }
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });
          await calendar.channels.stop({
            requestBody: {
              id: sub.subscriptionId,
              resourceId: sub.resourceId,
            },
          });
        } else if (account.provider === "microsoft" && account.refreshToken) {
          const cca = buildMsalApp();
          const tokenResponse = await cca.acquireTokenByRefreshToken({
            refreshToken: decrypt(account.refreshToken),
            scopes: ["Calendars.ReadWrite"],
          });
          if (tokenResponse) {
            const graphClient = Client.init({
              authProvider: (done: (err: Error | null, token: string | null) => void) => {
                done(null, tokenResponse.accessToken);
              },
            });
            await graphClient.api(`/subscriptions/${sub.subscriptionId}`).delete();
          }
        }
      } catch (err) {
        // If external unregister fails, still mark local as inactive
        console.error(
          "[webhook] Unregister failed:",
          err instanceof Error ? err.message : err
        );
      }

      await ctx.db
        .update(webhookSubscriptions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(webhookSubscriptions.id, sub.id));

      return { success: true };
    }),

  /**
   * Bidirectionally link an Orbyt event to an imported external event.
   */
  linkEvent: protectedProcedure
    .input(LinkEventSchema)
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.eventId),
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });

      // Verify the caller is a member of the event's household
      const membership = await ctx.db.query.householdMembers.findFirst({
        where: and(
          eq(householdMembers.householdId, event.householdId),
          eq(householdMembers.userId, ctx.user.id)
        ),
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this event's household",
        });
      }

      const extEvent = await ctx.db.query.externalEvents.findFirst({
        where: and(
          eq(externalEvents.id, input.externalEventId),
          eq(externalEvents.userId, ctx.user.id)
        ),
      });
      if (!extEvent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "External event not found" });
      }

      // Link Orbyt event → external
      await ctx.db
        .update(events)
        .set({
          externalEventId: extEvent.externalId,
          externalProvider: extEvent.connectedAccountId ? "linked" : null,
          connectedAccountId: extEvent.connectedAccountId,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(events.id, input.eventId));

      // Link external event → Orbyt
      await ctx.db
        .update(externalEvents)
        .set({ orbytEventId: input.eventId, updatedAt: new Date() })
        .where(eq(externalEvents.id, input.externalEventId));

      return { success: true };
    }),

  /**
   * Remove the bidirectional link between an Orbyt event and its external counterpart.
   */
  unlinkEvent: protectedProcedure
    .input(UnlinkEventSchema)
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.eventId),
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });

      // Verify the caller is a member of the event's household
      const membership = await ctx.db.query.householdMembers.findFirst({
        where: and(
          eq(householdMembers.householdId, event.householdId),
          eq(householdMembers.userId, ctx.user.id)
        ),
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this event's household",
        });
      }

      // Clear the link on the Orbyt event
      await ctx.db
        .update(events)
        .set({
          externalEventId: null,
          externalProvider: null,
          connectedAccountId: null,
          externalEtag: null,
          lastSyncedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(events.id, input.eventId));

      // Clear the link on any external event pointing to this Orbyt event
      await ctx.db
        .update(externalEvents)
        .set({ orbytEventId: null, updatedAt: new Date() })
        .where(eq(externalEvents.orbytEventId, input.eventId));

      return { success: true };
    }),
});

// ---------------------------------------------------------------------------
// Cron helper: renew expiring webhook subscriptions
// Called from /api/cron/renew-webhooks route.
// ---------------------------------------------------------------------------

export async function renewExpiringSubscriptions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle db type
  db: any
): Promise<{ renewed: number; errors: string[] }> {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const errors: string[] = [];
  let renewed = 0;

  // Find all active subscriptions expiring within 24 hours
  const expiring = await db.query.webhookSubscriptions.findMany({
    where: and(
      eq(webhookSubscriptions.isActive, true),
      lte(webhookSubscriptions.expiresAt, tomorrow)
    ),
    with: {
      connectedAccount: true,
    },
  });

  for (const sub of expiring) {
    try {
      const account = sub.connectedAccount;
      if (!account || !account.isActive || !account.refreshToken) {
        await db
          .update(webhookSubscriptions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(webhookSubscriptions.id, sub.id));
        continue;
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      if (account.provider === "google") {
        try {
          const oauth2Client = buildGoogleOAuthClient();
          oauth2Client.setCredentials({ refresh_token: decrypt(account.refreshToken) });
          await oauth2Client.refreshAccessToken();
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });

          // Stop old channel
          if (sub.resourceId) {
            await calendar.channels.stop({
              requestBody: { id: sub.subscriptionId, resourceId: sub.resourceId },
            });
          }

          // Create new channel
          const channelId = randomBytes(16).toString("hex");
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const response = await calendar.events.watch({
            calendarId: "primary",
            requestBody: {
              id: channelId,
              type: "web_hook",
              address: `${baseUrl}/api/webhooks/google`,
              expiration: String(expiresAt.getTime()),
            },
          });

          await db
            .update(webhookSubscriptions)
            .set({
              subscriptionId: channelId,
              resourceId: response.data.resourceId ?? null,
              expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(webhookSubscriptions.id, sub.id));

          renewed++;
        } catch (err) {
          errors.push(
            `Google renewal failed for ${sub.id}: ${err instanceof Error ? err.message : err}`
          );
        }
      } else {
        // Microsoft
        try {
          const cca = buildMsalApp();
          const tokenResponse = await cca.acquireTokenByRefreshToken({
            refreshToken: decrypt(account.refreshToken),
            scopes: ["Calendars.ReadWrite"],
          });
          if (!tokenResponse) throw new Error("Token refresh failed");

          const graphClient = Client.init({
            authProvider: (done: (err: Error | null, token: string | null) => void) => {
              done(null, tokenResponse.accessToken);
            },
          });

          // Delete old subscription (may already be expired — ignore errors)
          try {
            await graphClient.api(`/subscriptions/${sub.subscriptionId}`).delete();
          } catch {
            /* Already expired — continue to create new one */
          }

          // Create new subscription
          const msExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          const newSub = (await graphClient.api("/subscriptions").post({
            changeType: "created,updated,deleted",
            notificationUrl: `${baseUrl}/api/webhooks/microsoft`,
            resource: "/me/events",
            expirationDateTime: msExpiresAt.toISOString(),
            clientState: randomBytes(16).toString("hex"),
          })) as { id?: string };

          await db
            .update(webhookSubscriptions)
            .set({
              subscriptionId: newSub.id ?? sub.subscriptionId,
              expiresAt: msExpiresAt,
              updatedAt: new Date(),
            })
            .where(eq(webhookSubscriptions.id, sub.id));

          renewed++;
        } catch (err) {
          errors.push(
            `Microsoft renewal failed for ${sub.id}: ${err instanceof Error ? err.message : err}`
          );
        }
      }
    } catch (err) {
      errors.push(
        `Renewal error for ${sub.id}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  return { renewed, errors };
}
