/**
 * Re-exports drizzle-orm operators for use in packages that depend on @orbyt/db
 * but don't declare drizzle-orm as a direct dependency.
 */
export {
  eq,
  and,
  or,
  not,
  gt,
  gte,
  lt,
  lte,
  ne,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  like,
  ilike,
  sql,
  desc,
  asc,
  count,
  sum,
  avg,
  max,
  min,
} from "drizzle-orm";
