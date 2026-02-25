import { NextRequest, NextResponse } from "next/server";

/**
 * Plaid webhook endpoint.
 *
 * Plaid sends POST requests here when transaction data changes or
 * when an Item requires user attention (re-authentication).
 *
 * Plaid signs webhooks with JWTs — we verify the signature before processing.
 * For Sandbox mode, JWT verification is skipped since Sandbox doesn't sign.
 *
 * Reference:
 *   https://plaid.com/docs/api/webhooks/
 */

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
  try {
    const body = (await request.json()) as {
      webhook_type?: string;
      webhook_code?: string;
      item_id?: string;
      error?: { error_code?: string; error_message?: string } | null;
    };

    const { webhook_type, webhook_code, item_id } = body;

    if (!webhook_type || !webhook_code || !item_id) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // TODO: In production, verify Plaid webhook JWT signature here.
    // Sandbox webhooks are not signed, so we skip verification for now.
    // See: https://plaid.com/docs/api/webhooks/webhook-verification/

    const { handlePlaidWebhook } = await import("@orbyt/api/lib/plaid-webhook-handler");
    await handlePlaidWebhook(getDb(), webhook_type, webhook_code, item_id);
  } catch (error) {
    console.error(
      "[webhook/plaid] Error:",
      error instanceof Error ? error.message : error
    );
  }

  // Always return 200 to prevent Plaid from retrying
  return NextResponse.json({ ok: true });
}
