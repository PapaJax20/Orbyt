import { NextRequest, NextResponse } from "next/server";

/**
 * Microsoft OAuth callback handler.
 * Receives the authorization code from Microsoft and forwards it
 * to the integrations.handleCallback tRPC procedure.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/settings?tab=integrations&error=${encodeURIComponent(errorDescription || error)}`,
        request.url
      )
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?tab=integrations&error=missing_params", request.url)
    );
  }

  return NextResponse.redirect(
    new URL(
      `/settings?tab=integrations&provider=microsoft&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      request.url
    )
  );
}
