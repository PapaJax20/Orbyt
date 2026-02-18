import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  households,
  householdMembers,
  invitations,
  profiles,
} from "@orbyt/db/schema";
import {
  CreateHouseholdSchema,
  UpdateHouseholdSchema,
  InviteMemberSchema,
  UpdateProfileSchema,
} from "@orbyt/shared/validators";
import { router, protectedProcedure, householdProcedure, adminProcedure } from "../trpc";
import { stringToColor } from "@orbyt/shared/utils";
import { addDays } from "@orbyt/shared/utils";

export const householdRouter = router({
  /**
   * Create a new household and make the creator an admin.
   */
  create: protectedProcedure
    .input(CreateHouseholdSchema)
    .mutation(async ({ ctx, input }) => {
      const [household] = await ctx.db
        .insert(households)
        .values({
          name: input.name,
          timezone: input.timezone,
        })
        .returning();

      if (!household) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Add creator as admin with a default color
      await ctx.db.insert(householdMembers).values({
        householdId: household.id,
        userId: ctx.user!.id,
        role: "admin",
        displayColor: stringToColor(ctx.user!.id),
      });

      return household;
    }),

  /**
   * Get all households the current user is a member of.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.householdMembers.findMany({
      where: eq(householdMembers.userId, ctx.user!.id),
      with: {
        household: true,
      },
    });
    return memberships.map((m) => ({ ...m.household, role: m.role }));
  }),

  /**
   * Get the current household with all members.
   */
  getCurrent: householdProcedure.query(async ({ ctx }) => {
    const household = await ctx.db.query.households.findFirst({
      where: eq(households.id, ctx.householdId),
    });
    if (!household) throw new TRPCError({ code: "NOT_FOUND" });

    const members = await ctx.db.query.householdMembers.findMany({
      where: eq(householdMembers.householdId, ctx.householdId),
      with: { profile: true },
    });

    return { ...household, members };
  }),

  /**
   * Update household settings (admin only).
   */
  update: adminProcedure
    .input(UpdateHouseholdSchema)
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(households)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(households.id, ctx.householdId))
        .returning();
      return updated;
    }),

  /**
   * Send an invitation email to a new member.
   */
  inviteMember: adminProcedure
    .input(InviteMemberSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if already a member
      const existingProfile = await ctx.db.query.profiles.findFirst({
        where: eq(profiles.email, input.email),
      });

      if (existingProfile) {
        const existing = await ctx.db.query.householdMembers.findFirst({
          where: and(
            eq(householdMembers.householdId, ctx.householdId),
            eq(householdMembers.userId, existingProfile.id)
          ),
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This person is already a member of your household",
          });
        }
      }

      const [invitation] = await ctx.db
        .insert(invitations)
        .values({
          householdId: ctx.householdId,
          invitedEmail: input.email,
          invitedBy: ctx.user!.id,
          role: input.role,
          expiresAt: addDays(new Date(), 7), // 7-day expiry
        })
        .returning();

      // TODO: Send invitation email via Resend (Phase 1 completion step)
      // await sendInvitationEmail(invitation, ctx.user!.displayName, household.name);

      return invitation;
    }),

  /**
   * Accept an invitation by token.
   */
  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.query.invitations.findFirst({
        where: eq(invitations.token, input.token),
      });

      if (!invitation || invitation.status !== "pending") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired invitation" });
      }

      if (invitation.expiresAt < new Date()) {
        await ctx.db
          .update(invitations)
          .set({ status: "expired" })
          .where(eq(invitations.id, invitation.id));
        throw new TRPCError({ code: "GONE", message: "This invitation has expired" });
      }

      // Add user to household
      await ctx.db.insert(householdMembers).values({
        householdId: invitation.householdId,
        userId: ctx.user!.id,
        role: invitation.role,
        displayColor: stringToColor(ctx.user!.id),
      });

      // Mark invitation as accepted
      await ctx.db
        .update(invitations)
        .set({ status: "accepted" })
        .where(eq(invitations.id, invitation.id));

      return { householdId: invitation.householdId };
    }),

  /**
   * Remove a member (admin only, cannot remove yourself if last admin).
   */
  removeMember: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, ctx.householdId),
            eq(householdMembers.userId, input.userId)
          )
        );
    }),

  /**
   * Update the current user's profile.
   */
  updateProfile: protectedProcedure
    .input(UpdateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(profiles)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(profiles.id, ctx.user!.id))
        .returning();
      return updated;
    }),
});
