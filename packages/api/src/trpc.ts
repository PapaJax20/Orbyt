import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { eq, and } from "drizzle-orm";
import { householdMembers } from "@orbyt/db/schema";
import type { Context } from "./context";

/**
 * Initialize tRPC with our context and SuperJSON transformer.
 * SuperJSON enables passing Dates, Maps, Sets, etc. over the wire.
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof Error && "flatten" in error.cause
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (error.cause as any).flatten()
            : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;

/**
 * Public procedure — no authentication required.
 * Use for: login, register, invite acceptance, health checks.
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure — requires a valid Supabase session.
 * Throws UNAUTHORIZED if no user in context.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Household procedure — requires auth + verified household membership.
 * Injects the member's role into the context.
 * Throws FORBIDDEN if the user is not a member of the requested household.
 */
export const householdProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.householdId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No household selected",
    });
  }

  const member = await ctx.db.query.householdMembers.findFirst({
    where: and(
      eq(householdMembers.userId, ctx.user!.id),
      eq(householdMembers.householdId, ctx.householdId)
    ),
  });

  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this household",
    });
  }

  return next({
    ctx: {
      ...ctx,
      householdId: ctx.householdId,
      memberRole: member.role as "admin" | "member" | "child",
    },
  });
});

/**
 * Admin procedure — requires household membership with admin role.
 * Use for: household settings, member management.
 */
export const createCallerFactory = t.createCallerFactory;

export const adminProcedure = householdProcedure.use(({ ctx, next }) => {
  if (ctx.memberRole !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires admin permissions",
    });
  }
  return next({ ctx });
});
