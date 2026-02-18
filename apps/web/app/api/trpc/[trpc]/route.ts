import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { appRouter } from "@orbyt/api";
import { createClient } from "@/lib/supabase/server";
import { createDbClient } from "@orbyt/db/client";

/**
 * tRPC route handler for Next.js App Router.
 * Handles all tRPC requests at /api/trpc/[procedure].
 */
const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const supabase = await createClient();

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      const db = createDbClient(process.env["DATABASE_URL"]!);

      let profile = null;
      if (authUser) {
        // Fetch or create the user profile
        const { profile: fetchedProfile } = await db.query.profiles
          .findFirst({
            where: (p, { eq }) => eq(p.id, authUser.id),
          })
          .then((p) => ({ profile: p ?? null }));
        profile = fetchedProfile;
      }

      // Active household from cookie/header
      const householdId =
        req.headers.get("x-household-id") ??
        req.cookies.get("orbyt-household-id")?.value ??
        null;

      return {
        db,
        user: profile,
        householdId,
      };
    },
    onError: ({ path, error }) => {
      if (process.env["NODE_ENV"] === "development") {
        console.error(`❌ tRPC error on ${path}:`, error);
      }
    },
  });

export { handler as GET, handler as POST };
