"use client";

import { createTRPCClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@orbyt/api";

/**
 * Vanilla (non-React) tRPC client for use outside of TRPCProvider context.
 * Used in auth forms (register, login) where TRPCProvider isn't available.
 */
export const trpcVanilla = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const householdId =
          typeof window !== "undefined"
            ? localStorage.getItem("orbyt-household-id")
            : null;
        return {
          "x-trpc-source": "vanilla-client",
          ...(householdId ? { "x-household-id": householdId } : {}),
        };
      },
    }),
  ],
});
