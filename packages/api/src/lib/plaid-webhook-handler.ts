import { eq } from "drizzle-orm";
import { plaidItems } from "@orbyt/db/schema";
// @ts-ignore — Turbopack .js→.ts resolution
import { syncPlaidTransactionsForItem } from "../routers/plaid";

/**
 * Handle a Plaid webhook notification.
 * Called from /api/webhooks/plaid after JWT verification.
 *
 * @param db           Drizzle DB instance
 * @param webhookType  Plaid webhook_type (e.g. "TRANSACTIONS", "ITEM")
 * @param webhookCode  Plaid webhook_code (e.g. "SYNC_UPDATES_AVAILABLE")
 * @param itemId       Plaid item_id from the webhook payload
 */
export async function handlePlaidWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle db type passed from Next.js route handler
  db: any,
  webhookType: string,
  webhookCode: string,
  itemId: string
): Promise<void> {
  // Find the Plaid Item by its Plaid-issued item_id
  const item = await db.query.plaidItems.findFirst({
    where: eq(plaidItems.plaidItemId, itemId),
  });

  if (!item || !item.isActive) {
    console.warn(`[webhook/plaid] Unknown or inactive item: ${itemId}`);
    return;
  }

  switch (webhookType) {
    case "TRANSACTIONS": {
      if (
        webhookCode === "SYNC_UPDATES_AVAILABLE" ||
        webhookCode === "INITIAL_UPDATE" ||
        webhookCode === "HISTORICAL_UPDATE"
      ) {
        await syncPlaidTransactionsForItem(db, item);
      }
      break;
    }
    case "ITEM": {
      if (
        webhookCode === "LOGIN_REQUIRED" ||
        webhookCode === "PENDING_EXPIRATION"
      ) {
        await db
          .update(plaidItems)
          .set({
            status: "login_required",
            syncError: `Plaid requires re-authentication (${webhookCode})`,
            updatedAt: new Date(),
          })
          .where(eq(plaidItems.id, item.id));
      } else if (webhookCode === "ERROR") {
        await db
          .update(plaidItems)
          .set({
            status: "error",
            syncError: "Plaid reported an item error",
            updatedAt: new Date(),
          })
          .where(eq(plaidItems.id, item.id));
      }
      break;
    }
    default:
      console.log(
        `[webhook/plaid] Unhandled webhook: ${webhookType}/${webhookCode}`
      );
  }
}
