import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createDbClient } from "@orbyt/db/client";
import { eq } from "@orbyt/db/orm";

/**
 * Daily cron job to sync all active Plaid Items.
 * Catches any transactions missed by webhooks.
 * Invoked daily at 07:00 UTC by Vercel Cron (see vercel.json).
 * Secured by CRON_SECRET.
 */

export const dynamic = "force-dynamic";

let db: ReturnType<typeof createDbClient>;
function getDb() {
  if (!db) {
    db = createDbClient(process.env["DATABASE_URL"]!);
  }
  return db;
}

export async function POST(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const expected = process.env["CRON_SECRET"];
  if (!expected || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expectedFull = `Bearer ${expected}`;
  if (
    authHeader.length !== expectedFull.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedFull))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { plaidItems } = await import("@orbyt/db/schema");
    const { syncPlaidTransactionsForItem } = await import("@orbyt/api/routers/plaid");

    const items = await getDb().query.plaidItems.findMany({
      where: eq(plaidItems.isActive, true),
    });

    let synced = 0;
    let errors = 0;

    for (const item of items) {
      try {
        await syncPlaidTransactionsForItem(getDb(), item);
        synced++;
      } catch (err) {
        errors++;
        console.error(
          `[cron/sync-plaid] Failed to sync item ${item.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return NextResponse.json({ success: true, synced, errors });
  } catch (error) {
    console.error("[cron/sync-plaid] failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
