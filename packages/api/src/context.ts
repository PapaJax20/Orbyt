import type { DbClient } from "@orbyt/db";
import type { Profile } from "@orbyt/db/schema";

/**
 * The tRPC request context. Populated by the context factory in each app
 * (Next.js middleware → createContext function).
 */
export interface Context {
  db: DbClient;
  user: Profile | null;
  householdId: string | null; // The active household ID from request headers/cookies
}

export interface AuthenticatedContext extends Context {
  user: Profile;
}

export interface HouseholdContext extends AuthenticatedContext {
  householdId: string;
  memberRole: "admin" | "member" | "child";
}
