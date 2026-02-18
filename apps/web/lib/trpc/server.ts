import "server-only";

import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@orbyt/api";

/**
 * Server-side tRPC caller for use in React Server Components and Server Actions.
 * Does NOT support subscriptions or streaming.
 */
export function createServerTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      loggerLink({
        enabled: (op) =>
          process.env["NODE_ENV"] === "development" ||
          (op.direction === "down" && op.result instanceof Error),
      }),
      httpBatchLink({
        url: `${process.env["NEXT_PUBLIC_APP_URL"]}/api/trpc`,
        transformer: superjson,
        headers() {
          return {
            "x-trpc-source": "rsc",
          };
        },
      }),
    ],
  });
}
