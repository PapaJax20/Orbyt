import { NextRequest, NextResponse } from "next/server";

/**
 * Microsoft Graph change notification webhook.
 *
 * Two request types arrive here:
 *
 * 1. Subscription validation (GET or POST with ?validationToken=xxx):
 *    Microsoft sends this when creating/renewing a subscription to confirm that
 *    we own the endpoint. Must echo the token back as text/plain with 200.
 *
 * 2. Change notifications (POST with JSON body):
 *    Microsoft delivers notifications as `{ value: [...] }`. Each notification
 *    includes the subscriptionId, changeType, and resource path so we can fetch
 *    the specific event that changed.
 *
 * No bearer auth is required — Microsoft validates ownership via the
 * clientState field stored on the subscription row.
 *
 * Reference:
 *   https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
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
  // Step 1: Subscription validation — Microsoft sends ?validationToken=xxx.
  // Must respond with the raw token as text/plain within 10 seconds.
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    // Validate token format (Microsoft tokens are URL-safe base64, max ~512 chars)
    if (!/^[A-Za-z0-9\-_=+/.]{1,512}$/.test(validationToken)) {
      return new NextResponse("Invalid token", { status: 400 });
    }
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Step 2: Process change notifications.
  try {
    const body = (await request.json()) as {
      value?: Array<{
        subscriptionId?: string;
        changeType?: string;
        resource?: string;
        clientState?: string;
      }>;
    };

    const notifications = body.value ?? [];

    const { handleMicrosoftWebhook } = await import("@orbyt/api/lib/webhook-handlers");

    for (const notification of notifications) {
      const { subscriptionId, changeType, resource, clientState } = notification;

      if (!subscriptionId || !changeType || !resource) {
        // Skip malformed notifications rather than failing the whole batch.
        continue;
      }

      try {
        // handleMicrosoftWebhook validates the subscription exists (subscriptionId)
        // before processing. Unknown subscriptions are silently ignored.
        await handleMicrosoftWebhook(getDb(), subscriptionId, changeType, resource, clientState ?? undefined);
      } catch (error) {
        // Log per-notification errors so one bad notification doesn't abort the rest.
        console.error(
          "[webhook/microsoft] Notification error:",
          error instanceof Error ? error.message : error
        );
      }
    }
  } catch (error) {
    // Log parse/top-level errors but still return 202 — Microsoft would retry on 4xx/5xx.
    console.error(
      "[webhook/microsoft] Error:",
      error instanceof Error ? error.message : error
    );
  }

  // Microsoft expects 202 Accepted for change notifications.
  return NextResponse.json({ ok: true }, { status: 202 });
}
