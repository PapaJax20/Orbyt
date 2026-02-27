import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, importJWK, type JWK } from "jose";
import { createHash } from "crypto";

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
 *   https://plaid.com/docs/api/webhooks/webhook-verification/
 */

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// JWK cache: key_id -> { jwk, fetchedAt }
// ---------------------------------------------------------------------------
const jwkCache = new Map<string, { jwk: JWK; fetchedAt: number }>();
const JWK_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getPlaidBaseUrl(): string {
  const env = process.env.PLAID_ENV || "sandbox";
  return env === "production"
    ? "https://production.plaid.com"
    : "https://sandbox.plaid.com";
}

async function getPlaidJWK(keyId: string): Promise<JWK> {
  const cached = jwkCache.get(keyId);
  if (cached && Date.now() - cached.fetchedAt < JWK_CACHE_TTL) {
    return cached.jwk;
  }

  const response = await fetch(
    `${getPlaidBaseUrl()}/webhook_verification_key/get`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.PLAID_CLIENT_ID,
        secret: process.env.PLAID_SECRET,
        key_id: keyId,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Plaid JWK: ${response.status}`);
  }

  const data = (await response.json()) as { key: JWK };
  const jwk = data.key;
  jwkCache.set(keyId, { jwk, fetchedAt: Date.now() });
  return jwk;
}

async function verifyPlaidWebhook(
  request: NextRequest,
  rawBody: string
): Promise<boolean> {
  // Sandbox webhooks are not signed — skip verification
  if (process.env.PLAID_ENV === "sandbox") return true;

  const signedJwt = request.headers.get("plaid-verification");
  if (!signedJwt) return false;

  try {
    // Decode the JWT header to extract the key ID (kid)
    const [headerB64] = signedJwt.split(".");
    if (!headerB64) return false;

    const header = JSON.parse(
      Buffer.from(headerB64, "base64url").toString()
    ) as { kid?: string; alg?: string };
    const keyId = header.kid;
    if (!keyId) return false;

    // Fetch the JWK from Plaid (cached for 24h)
    const jwk = await getPlaidJWK(keyId);
    const key = await importJWK(jwk, header.alg || "ES256");

    // Verify the JWT signature
    const { payload } = await jwtVerify(signedJwt, key);

    // Verify the request body hash matches
    const expectedHash = createHash("sha256").update(rawBody).digest("hex");
    if (payload.request_body_sha256 !== expectedHash) return false;

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// DB singleton (lazy)
// ---------------------------------------------------------------------------
let db:
  | Awaited<
      ReturnType<typeof import("@orbyt/db/client")["createDbClient"]>
    >
  | undefined;
function getDb() {
  if (!db) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy singleton
    const { createDbClient } = require("@orbyt/db/client") as typeof import("@orbyt/db/client");
    db = createDbClient(process.env["DATABASE_URL"]!);
  }
  return db;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Read raw body first for signature verification, then parse JSON
    const rawBody = await request.text();

    // Verify webhook JWT signature (skipped in sandbox)
    const isValid = await verifyPlaidWebhook(request, rawBody);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody) as {
      webhook_type?: string;
      webhook_code?: string;
      item_id?: string;
      error?: { error_code?: string; error_message?: string } | null;
    };

    const { webhook_type, webhook_code, item_id } = body;

    if (!webhook_type || !webhook_code || !item_id) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { handlePlaidWebhook } = await import(
      "@orbyt/api/lib/plaid-webhook-handler"
    );
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
