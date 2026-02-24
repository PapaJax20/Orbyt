import { NextRequest, NextResponse } from "next/server";

/**
 * Google OAuth callback handler.
 * Receives the authorization code from Google and forwards it
 * to the integrations.handleCallback tRPC procedure.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?tab=integrations&error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?tab=integrations&error=missing_params", request.url)
    );
  }

  // Forward to settings page with the code — the client will call handleCallback
  return NextResponse.redirect(
    new URL(
      `/settings?tab=integrations&provider=google&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      request.url
    )
  );
}
