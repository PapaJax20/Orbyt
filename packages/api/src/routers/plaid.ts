import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
// @ts-ignore — Turbopack .js→.ts resolution
import { router, householdProcedure } from "../trpc";
import { plaidItems, plaidAccounts, accounts, transactions } from "@orbyt/db/schema";
// @ts-ignore — Turbopack .js→.ts resolution
import { encrypt, decrypt } from "../lib/encryption";
// @ts-ignore — Turbopack .js→.ts resolution
import { getPlaidClient } from "../lib/plaid-client";
// @ts-ignore — Turbopack .js→.ts resolution
import { mapPlaidCategory, mapPlaidTransactionType } from "../lib/plaid-category-map";
import {
  ExchangePublicTokenSchema,
  SyncTransactionsSchema,
  RefreshBalancesSchema,
  DisconnectItemSchema,
  UpdateAccountMappingSchema,
} from "@orbyt/shared/validators";
import type { PlaidItem } from "@orbyt/db/schema";
import { Products, CountryCode } from "plaid";

// Rate limit sync: 1 sync per item per minute
const syncCooldowns = new Map<string, number>();
const SYNC_COOLDOWN_MS = 60_000;

function checkSyncCooldown(itemId: string): void {
  const lastSync = syncCooldowns.get(itemId);
  if (lastSync && Date.now() - lastSync < SYNC_COOLDOWN_MS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Please wait before syncing again",
    });
  }
}

/**
 * Sync transactions for a specific Plaid Item using the Transactions Sync API.
 * Exported so the webhook handler can call it directly.
 */
export async function syncPlaidTransactionsForItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle db type passed from tRPC ctx or webhook handler
  db: any,
  item: PlaidItem
): Promise<{ added: number; modified: number; removed: number }> {
  const client = getPlaidClient();
  const accessToken = decrypt(item.accessToken);
  let cursor = item.transactionsCursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  // Build account mapping: plaidAccountId string → plaid_accounts row
  const plaidAccountRows = await db.query.plaidAccounts.findMany({
    where: eq(plaidAccounts.plaidItemId, item.id),
  });
  const accountMap = new Map<string, typeof plaidAccountRows[0]>();
  for (const row of plaidAccountRows) {
    accountMap.set(row.plaidAccountId, row);
  }

  while (hasMore) {
    const response = await client.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });

    const data = response.data;

    // Process added transactions
    for (const txn of data.added) {
      const plaidAccount = accountMap.get(txn.account_id);
      const category = mapPlaidCategory(txn.personal_finance_category?.primary);
      const txnType = mapPlaidTransactionType(
        txn.personal_finance_category?.primary,
        txn.amount
      );

      await db
        .insert(transactions)
        .values({
          householdId: item.householdId,
          accountId: plaidAccount?.orbytAccountId ?? null,
          createdBy: item.userId,
          type: txnType,
          amount: String(Math.abs(txn.amount).toFixed(2)),
          currency: txn.iso_currency_code ?? "USD",
          category,
          description: txn.name ?? txn.merchant_name ?? "Unknown",
          date: txn.date,
          merchantName: txn.merchant_name ?? null,
          plaidTransactionId: txn.transaction_id,
          pending: txn.pending,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Plaid PersonalFinanceCategory is a typed struct; cast via unknown to satisfy JSONB column
          plaidCategory: (txn.personal_finance_category as unknown as Record<string, unknown>) ?? null,
          importSource: "plaid",
        })
        .onConflictDoNothing(); // Skip if plaidTransactionId already exists

      added++;
    }

    // Process modified transactions
    for (const txn of data.modified) {
      const category = mapPlaidCategory(txn.personal_finance_category?.primary);
      const txnType = mapPlaidTransactionType(
        txn.personal_finance_category?.primary,
        txn.amount
      );

      const existing = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.plaidTransactionId, txn.transaction_id),
          eq(transactions.householdId, item.householdId)
        ),
      });

      if (existing) {
        await db
          .update(transactions)
          .set({
            type: txnType,
            amount: String(Math.abs(txn.amount).toFixed(2)),
            category,
            description: txn.name ?? txn.merchant_name ?? "Unknown",
            date: txn.date,
            merchantName: txn.merchant_name ?? null,
            pending: txn.pending,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Plaid PersonalFinanceCategory is a typed struct; cast via unknown to satisfy JSONB column
            plaidCategory: (txn.personal_finance_category as unknown as Record<string, unknown>) ?? null,
          })
          .where(eq(transactions.id, existing.id));
        modified++;
      }
    }

    // Process removed transactions
    for (const removed_txn of data.removed) {
      if (removed_txn.transaction_id) {
        // Soft-remove: mark with a note rather than deleting, preserving any user-linked splits/notes
        const existing = await db.query.transactions.findFirst({
          where: and(
            eq(transactions.plaidTransactionId, removed_txn.transaction_id),
            eq(transactions.householdId, item.householdId)
          ),
        });
        if (existing) {
          await db
            .update(transactions)
            .set({ notes: "[Removed by bank]" })
            .where(eq(transactions.id, existing.id));
          removed++;
        }
      }
    }

    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  // Update the item's cursor and sync timestamp
  await db
    .update(plaidItems)
    .set({
      transactionsCursor: cursor,
      lastSyncAt: new Date(),
      syncError: null,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(plaidItems.id, item.id));

  syncCooldowns.set(item.id, Date.now());

  return { added, modified, removed };
}

// Helper to map Plaid account types to Orbyt account types
function mapPlaidAccountType(type: string, subtype?: string): string {
  switch (type) {
    case "depository":
      return subtype === "savings" ? "savings" : "checking";
    case "credit":
      return "credit_card";
    case "loan":
      return "loan";
    case "investment":
      return "investment";
    default:
      return "other";
  }
}

export const plaidRouter = router({
  /**
   * Create a Plaid Link token for the frontend to open Plaid Link.
   */
  createLinkToken: householdProcedure
    .mutation(async ({ ctx }) => {
      try {
        const client = getPlaidClient();
        const webhookUrl = process.env.PLAID_WEBHOOK_URL;

        const response = await client.linkTokenCreate({
          user: { client_user_id: ctx.user.id },
          client_name: "Orbyt",
          products: [Products.Transactions],
          country_codes: [CountryCode.Us],
          language: "en",
          ...(webhookUrl && webhookUrl.startsWith("https://") ? { webhook: webhookUrl } : {}),
        });

        return { linkToken: response.data.link_token };
      } catch (err: unknown) {
        const plaidError = (err as { response?: { data?: { error_message?: string; error_code?: string } } })?.response?.data;
        console.error("[plaid] createLinkToken failed:", plaidError ?? err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: plaidError?.error_message ?? "Failed to initialize bank connection",
        });
      }
    }),

  /**
   * Exchange a public token from Plaid Link for an access token.
   * Creates the plaid_items row and fetches initial accounts.
   */
  exchangePublicToken: householdProcedure
    .input(ExchangePublicTokenSchema)
    .mutation(async ({ ctx, input }) => {
      let accessToken: string;
      let plaidItemId: string;

      try {
        const client = getPlaidClient();
        const exchangeResponse = await client.itemPublicTokenExchange({
          public_token: input.publicToken,
        });
        accessToken = exchangeResponse.data.access_token;
        plaidItemId = exchangeResponse.data.item_id;
      } catch (err) {
        console.error("[plaid] exchangePublicToken failed:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect bank account. Please try again.",
        });
      }

      // Check if this item already exists (re-link scenario)
      const existing = await ctx.db.query.plaidItems.findFirst({
        where: eq(plaidItems.plaidItemId, plaidItemId),
      });

      if (existing) {
        // Update existing item with new access token
        await ctx.db
          .update(plaidItems)
          .set({
            accessToken: encrypt(accessToken),
            status: "active",
            syncError: null,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(plaidItems.id, existing.id));

        return { itemId: existing.id, isRelink: true };
      }

      // Create new Plaid Item
      const [newItem] = await ctx.db
        .insert(plaidItems)
        .values({
          householdId: ctx.householdId,
          userId: ctx.user.id,
          plaidItemId,
          accessToken: encrypt(accessToken),
          institutionId: input.institutionId ?? null,
          institutionName: input.institutionName ?? null,
          status: "active",
        })
        .returning();

      if (!newItem) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create Plaid item",
        });
      }

      // Fetch accounts from Plaid
      let accountsResponse;
      try {
        const client = getPlaidClient();
        accountsResponse = await client.accountsGet({
          access_token: accessToken,
        });
      } catch (err) {
        console.error("[plaid] accountsGet failed:", err);
        // Item was created but accounts fetch failed — return item, user can sync later
        return { itemId: newItem.id, isRelink: false };
      }

      // Create plaid_accounts rows and auto-create Orbyt accounts
      for (const acct of accountsResponse.data.accounts) {
        const orbytType = mapPlaidAccountType(acct.type, acct.subtype ?? undefined);

        // Auto-create an Orbyt account linked to this Plaid account
        const [orbytAccount] = await ctx.db
          .insert(accounts)
          .values({
            householdId: ctx.householdId,
            createdBy: ctx.user.id,
            name: acct.official_name ?? acct.name,
            type: orbytType,
            balance: String((acct.balances.current ?? 0).toFixed(2)),
            currency: acct.balances.iso_currency_code ?? "USD",
            institution: input.institutionName ?? null,
            accountNumber: acct.mask ?? null,
          })
          .returning();

        // Create plaid_accounts row linking Plaid account to Orbyt account
        await ctx.db.insert(plaidAccounts).values({
          plaidItemId: newItem.id,
          orbytAccountId: orbytAccount?.id ?? null,
          plaidAccountId: acct.account_id,
          name: acct.name,
          officialName: acct.official_name ?? null,
          type: acct.type,
          subtype: acct.subtype ?? null,
          mask: acct.mask ?? null,
          currentBalance: String((acct.balances.current ?? 0).toFixed(2)),
          availableBalance:
            acct.balances.available != null
              ? String(acct.balances.available.toFixed(2))
              : null,
          isoCurrencyCode: acct.balances.iso_currency_code ?? "USD",
        });
      }

      return { itemId: newItem.id, isRelink: false };
    }),

  /**
   * List all Plaid Items (connected banks) for the household.
   * Access tokens are never returned to the client.
   */
  listItems: householdProcedure
    .query(async ({ ctx }) => {
      const items = await ctx.db.query.plaidItems.findMany({
        where: and(
          eq(plaidItems.householdId, ctx.householdId),
          eq(plaidItems.isActive, true)
        ),
        orderBy: [desc(plaidItems.createdAt)],
      });

      // Strip sensitive accessToken — never expose to client
      return items.map((item: PlaidItem) => ({
        id: item.id,
        plaidItemId: item.plaidItemId,
        institutionId: item.institutionId,
        institutionName: item.institutionName,
        status: item.status,
        lastSyncAt: item.lastSyncAt,
        syncError: item.syncError,
        consentExpiresAt: item.consentExpiresAt,
        createdAt: item.createdAt,
      }));
    }),

  /**
   * List Plaid accounts for a specific item.
   */
  listAccounts: householdProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify the item belongs to this household before returning accounts
      const item = await ctx.db.query.plaidItems.findFirst({
        where: and(
          eq(plaidItems.id, input.itemId),
          eq(plaidItems.householdId, ctx.householdId)
        ),
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      return ctx.db.query.plaidAccounts.findMany({
        where: and(
          eq(plaidAccounts.plaidItemId, input.itemId),
          eq(plaidAccounts.isActive, true)
        ),
      });
    }),

  /**
   * Manually trigger a transaction sync for a Plaid Item.
   */
  syncTransactions: householdProcedure
    .input(SyncTransactionsSchema)
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.plaidItems.findFirst({
        where: and(
          eq(plaidItems.id, input.itemId),
          eq(plaidItems.householdId, ctx.householdId),
          eq(plaidItems.isActive, true)
        ),
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      checkSyncCooldown(item.id);

      const result = await syncPlaidTransactionsForItem(ctx.db, item);
      return result;
    }),

  /**
   * Refresh account balances from Plaid (does not sync transactions).
   */
  refreshBalances: householdProcedure
    .input(RefreshBalancesSchema)
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.plaidItems.findFirst({
        where: and(
          eq(plaidItems.id, input.itemId),
          eq(plaidItems.householdId, ctx.householdId),
          eq(plaidItems.isActive, true)
        ),
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      const client = getPlaidClient();
      const accessToken = decrypt(item.accessToken);

      const response = await client.accountsGet({
        access_token: accessToken,
      });

      // Update each plaid_account's balance
      for (const acct of response.data.accounts) {
        await ctx.db
          .update(plaidAccounts)
          .set({
            currentBalance: String((acct.balances.current ?? 0).toFixed(2)),
            availableBalance:
              acct.balances.available != null
                ? String(acct.balances.available.toFixed(2))
                : null,
            updatedAt: new Date(),
          })
          .where(eq(plaidAccounts.plaidAccountId, acct.account_id));

        // Also update the linked Orbyt account's balance for net worth accuracy
        const plaidAccount = await ctx.db.query.plaidAccounts.findFirst({
          where: eq(plaidAccounts.plaidAccountId, acct.account_id),
        });

        if (plaidAccount?.orbytAccountId) {
          await ctx.db
            .update(accounts)
            .set({
              balance: String((acct.balances.current ?? 0).toFixed(2)),
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, plaidAccount.orbytAccountId));
        }
      }

      await ctx.db
        .update(plaidItems)
        .set({ lastSyncAt: new Date(), syncError: null, updatedAt: new Date() })
        .where(eq(plaidItems.id, item.id));

      return { updated: response.data.accounts.length };
    }),

  /**
   * Disconnect a Plaid Item: revokes the access token at Plaid and soft-deletes
   * the item and its accounts. Only the connecting user or a household admin
   * can disconnect.
   */
  disconnectItem: householdProcedure
    .input(DisconnectItemSchema)
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.plaidItems.findFirst({
        where: and(
          eq(plaidItems.id, input.itemId),
          eq(plaidItems.householdId, ctx.householdId)
        ),
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Restrict disconnect to the connecting user or a household admin
      if (item.userId !== ctx.user.id && ctx.memberRole !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the connecting user or an admin can disconnect",
        });
      }

      // Revoke access token at Plaid — best-effort, don't fail if already invalid
      try {
        const client = getPlaidClient();
        await client.itemRemove({
          access_token: decrypt(item.accessToken),
        });
      } catch (err) {
        console.error("[plaid] Failed to revoke access token:", err);
      }

      // Soft delete: mark inactive and clear sensitive access token
      await ctx.db
        .update(plaidItems)
        .set({
          isActive: false,
          status: "disconnected",
          accessToken: "revoked",
          transactionsCursor: null,
          syncError: null,
          updatedAt: new Date(),
        })
        .where(eq(plaidItems.id, item.id));

      // Deactivate all linked plaid accounts
      await ctx.db
        .update(plaidAccounts)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(plaidAccounts.plaidItemId, item.id));

      return { success: true };
    }),

  /**
   * Link or unlink a Plaid account to/from an existing Orbyt account.
   * Set orbytAccountId to null to unlink.
   */
  updateAccountMapping: householdProcedure
    .input(UpdateAccountMappingSchema)
    .mutation(async ({ ctx, input }) => {
      const plaidAccount = await ctx.db.query.plaidAccounts.findFirst({
        where: eq(plaidAccounts.id, input.plaidAccountId),
        with: { plaidItem: true },
      });

      if (!plaidAccount || plaidAccount.plaidItem.householdId !== ctx.householdId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      await ctx.db
        .update(plaidAccounts)
        .set({
          orbytAccountId: input.orbytAccountId,
          updatedAt: new Date(),
        })
        .where(eq(plaidAccounts.id, input.plaidAccountId));

      return { success: true };
    }),

  /**
   * Delete all Plaid-imported transactions for the household and reset sync
   * cursors so the next sync performs a full pull from Plaid.
   */
  wipePlaidTransactions: householdProcedure
    .mutation(async ({ ctx }) => {
      const deleted = await ctx.db
        .delete(transactions)
        .where(
          and(
            eq(transactions.householdId, ctx.householdId),
            eq(transactions.importSource, "plaid")
          )
        )
        .returning({ id: transactions.id });

      // Reset sync cursors so next sync is a full pull
      await ctx.db
        .update(plaidItems)
        .set({ transactionsCursor: null })
        .where(eq(plaidItems.householdId, ctx.householdId));

      return { deleted: deleted.length };
    }),
});
