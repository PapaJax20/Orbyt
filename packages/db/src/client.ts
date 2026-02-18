import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Create a Drizzle ORM client connected to the Supabase Postgres database.
 * Uses a connection pool suitable for server-side usage (Next.js API routes, edge functions).
 */
export function createDbClient(connectionString: string) {
  const sql = postgres(connectionString, {
    // Connection pool settings
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Required for Supabase session-based auth (RLS)
    prepare: false,
  });

  return drizzle(sql, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;

// Export schema for query building
export { schema };
