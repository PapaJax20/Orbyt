import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { appRouter, createCallerFactory } from "@orbyt/api";
import { createDbClient } from "@orbyt/db/client";

/**
 * Cron job handler for push notification reminders.
 * Invoked every 5 minutes by Vercel Cron (see vercel.json).
 * Secured by CRON_SECRET to prevent unauthorized calls.
 *
 * To invoke locally:
 *   curl -X POST http://localhost:3000/api/cron/reminders \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 */

let db: ReturnType<typeof createDbClient>;
function getDb() {
  if (!db) {
    db = createDbClient(process.env["DATABASE_URL"]!);
  }
  return db;
}

// Force dynamic so Next.js never statically renders this route.
export const dynamic = "force-dynamic";

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
    // Build a service-level caller (no authed user — this is a background job).
    const createCaller = createCallerFactory(appRouter);
    const caller = createCaller({
      db: getDb(),
      user: null,
      householdId: null,
    });

    // Delegate to the notifications.checkReminders procedure.
    await caller.notifications.checkReminders({ cronSecret: process.env["CRON_SECRET"]! });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[cron/reminders] failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
