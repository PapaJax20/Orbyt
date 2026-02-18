import { z } from "zod";
import { eq, and, ilike, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { contacts, contactRelationships, contactNotes } from "@orbyt/db/schema";
import {
  CreateContactSchema,
  UpdateContactSchema,
  AddContactNoteSchema,
  LinkRelationshipSchema,
} from "@orbyt/shared/validators";
import { getNextBirthday, getDaysUntilBirthday } from "@orbyt/shared/utils";
import { router, householdProcedure } from "../trpc";

export const contactsRouter = router({
  /**
   * List contacts with optional search and filtering.
   */
  list: householdProcedure
    .input(
      z.object({
        search: z.string().optional(),
        relationshipType: z.string().optional(),
        sortBy: z.enum(["name", "birthday", "createdAt"]).default("name"),
      })
    )
    .query(async ({ ctx, input }) => {
      const allContacts = await ctx.db.query.contacts.findMany({
        where: and(
          eq(contacts.householdId, ctx.householdId),
          input.search
            ? or(
                ilike(contacts.firstName, `%${input.search}%`),
                ilike(contacts.lastName, `%${input.search}%`),
                ilike(contacts.email, `%${input.search}%`)
              )
            : undefined,
          input.relationshipType
            ? eq(contacts.relationshipType, input.relationshipType)
            : undefined
        ),
        orderBy: (c, { asc }) => [asc(c.firstName), asc(c.lastName)],
      });

      return allContacts.map((contact) => ({
        ...contact,
        upcomingBirthday: contact.birthday ? getNextBirthday(contact.birthday) : null,
        daysUntilBirthday: contact.birthday ? getDaysUntilBirthday(contact.birthday) : null,
      }));
    }),

  /**
   * Get a single contact with full details.
   */
  getById: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const contact = await ctx.db.query.contacts.findFirst({
        where: and(eq(contacts.id, input.id), eq(contacts.householdId, ctx.householdId)),
        with: {
          relationships: {
            with: {
              toContact: true,
            },
          },
          notes: {
            with: { profile: true },
            orderBy: (n, { desc }) => [desc(n.noteDate)],
          },
        },
      });
      if (!contact) throw new TRPCError({ code: "NOT_FOUND" });
      return contact;
    }),

  /**
   * Create a new contact.
   */
  create: householdProcedure.input(CreateContactSchema).mutation(async ({ ctx, input }) => {
    const [contact] = await ctx.db
      .insert(contacts)
      .values({
        ...input,
        householdId: ctx.householdId,
        createdBy: ctx.user.id,
      })
      .returning();
    return contact;
  }),

  /**
   * Update a contact.
   */
  update: householdProcedure
    .input(z.object({ id: z.string().uuid(), data: UpdateContactSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(contacts)
        .set({ ...input.data, updatedAt: new Date() })
        .where(and(eq(contacts.id, input.id), eq(contacts.householdId, ctx.householdId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /**
   * Delete a contact.
   */
  delete: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(contacts)
        .where(and(eq(contacts.id, input.id), eq(contacts.householdId, ctx.householdId)));
      return { success: true };
    }),

  /**
   * Add a note to a contact.
   */
  addNote: householdProcedure.input(AddContactNoteSchema).mutation(async ({ ctx, input }) => {
    const contact = await ctx.db.query.contacts.findFirst({
      where: and(eq(contacts.id, input.contactId), eq(contacts.householdId, ctx.householdId)),
    });
    if (!contact) throw new TRPCError({ code: "NOT_FOUND" });

    const [note] = await ctx.db
      .insert(contactNotes)
      .values({
        contactId: input.contactId,
        userId: ctx.user.id,
        content: input.content,
        noteDate: input.noteDate ? new Date(input.noteDate) : new Date(),
      })
      .returning();

    return note;
  }),

  /**
   * Link two contacts with a relationship label.
   */
  linkRelationship: householdProcedure
    .input(LinkRelationshipSchema)
    .mutation(async ({ ctx, input }) => {
      const [relationship] = await ctx.db
        .insert(contactRelationships)
        .values({
          householdId: ctx.householdId,
          fromContactId: input.fromContactId,
          toContactId: input.toContactId,
          relationshipLabel: input.label,
        })
        .returning();
      return relationship;
    }),

  /**
   * Get contacts with upcoming birthdays within N days.
   */
  getUpcomingBirthdays: householdProcedure
    .input(z.object({ daysAhead: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const allContacts = await ctx.db.query.contacts.findMany({
        where: and(
          eq(contacts.householdId, ctx.householdId),
          // Filter to contacts that have a birthday set
          // (SQL-level birthday filtering is complex due to year-agnostic comparison)
        ),
      });

      return allContacts
        .filter((c) => c.birthday !== null)
        .map((c) => ({
          ...c,
          daysUntilBirthday: getDaysUntilBirthday(c.birthday!),
          nextBirthday: getNextBirthday(c.birthday!),
        }))
        .filter((c) => c.daysUntilBirthday !== null && c.daysUntilBirthday <= input.daysAhead)
        .sort((a, b) => (a.daysUntilBirthday ?? 0) - (b.daysUntilBirthday ?? 0));
    }),
});
