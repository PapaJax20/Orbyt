import { NextRequest, NextResponse } from "next/server";

/**
 * Google Calendar push notification webhook.
 *
 * Google sends a POST to this URL whenever calendar data changes.
 * The notification carries only the channel ID and resource ID in headers —
 * the actual changed events must be fetched via the Google Calendar API using
 * the stored syncToken (handled inside handleGoogleWebhook).
 *
 * No authentication is required here; Google's ownership of the channel is
 * validated via the channelId/resourceId lookup against our DB.
 *
 * Reference:
 *   https://developers.google.com/calendar/api/guides/push
 */

// Force dynamic so Next.js never statically renders this route.
export const dynamic = "force-dynamic";

let db: Awaited<ReturnType<typeof import("@orbyt/db/client")["createDbClient"]>> | undefined;
function getDb() {
  if (!db) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy singleton
    const { createDbClient } = require("@orbyt/db/client") as typeof import("@orbyt/db/client");
    db = createDbClient(process.env["DATABASE_URL"]!);
  }
  return db;
}

export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceId = request.headers.get("x-goog-resource-id");
  const resourceState = request.headers.get("x-goog-resource-state");

  if (!channelId || !resourceId) {
    return NextResponse.json({ error: "Missing headers" }, { status: 400 });
  }

  // "sync" is the initial handshake Google sends when a watch is registered.
  // Just acknowledge it — no work to do yet.
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  try {
    // handleGoogleWebhook validates the subscription exists (channelId + resourceId)
    // before processing. Unknown subscriptions are silently ignored.
    const { handleGoogleWebhook } = await import("@orbyt/api/lib/webhook-handlers");
    await handleGoogleWebhook(getDb(), channelId, resourceId);
  } catch (error) {
    // Log but do not return a non-200 status — Google would retry aggressively
    // if we returned 4xx/5xx, so swallow errors after logging.
    console.error(
      "[webhook/google] Error:",
      error instanceof Error ? error.message : error
    );
  }

  // Always return 200 to prevent Google from retrying the notification.
  return NextResponse.json({ ok: true });
}
