import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createDbClient } from "@orbyt/db/client";

/**
 * Cron job handler for renewing expiring webhook subscriptions.
 * Invoked daily at 06:00 UTC by Vercel Cron (see vercel.json).
 * Secured by CRON_SECRET to prevent unauthorized calls.
 *
 * Renews all active Google Calendar watch channels and Microsoft Graph
 * subscriptions that expire within the next 24 hours.
 *
 * To invoke locally:
 *   curl -X POST http://localhost:3000/api/cron/renew-webhooks \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 */

// Force dynamic so Next.js never statically renders this route.
export const dynamic = "force-dynamic";

let db: ReturnType<typeof createDbClient>;
function getDb() {
  if (!db) {
    db = createDbClient(process.env["DATABASE_URL"]!);
  }
  return db;
}

export async function POST(request: NextRequest) {
  // Validate CRON_SECRET to prevent unauthorized invocations.
  const authHeader = request.headers.get("authorization");
  const expected = process.env["CRON_SECRET"];
  if (!expected || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expectedFull = `Bearer ${expected}`;
  if (authHeader.length !== expectedFull.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedFull))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { renewExpiringSubscriptions } = await import("@orbyt/api/routers/integrations");
    const result = await renewExpiringSubscriptions(getDb());
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/renew-webhooks] failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
