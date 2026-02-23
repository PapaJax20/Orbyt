import { z } from "zod";
import { eq, and, gte, lte, ilike, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { events, eventAttendees } from "@orbyt/db/schema";
import {
  CreateEventSchema,
  UpdateEventSchema,
  ListEventsSchema,
  DeleteEventSchema,
  SearchEventsSchema,
} from "@orbyt/shared/validators";
import { expandRecurringEvents } from "@orbyt/shared/utils";
import { router, householdProcedure } from "../trpc";

export const calendarRouter = router({
  /**
   * List events within a date range, with recurring events expanded.
   */
  list: householdProcedure.input(ListEventsSchema).query(async ({ ctx, input }) => {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    // Fetch base events — RRULE events are fetched with their rrule string
    // and expanded client-side / in this query
    const rawEvents = await ctx.db.query.events.findMany({
      where: and(
        eq(events.householdId, ctx.householdId),
        // For recurring events we need events that could have occurrences in range
        // For now, fetch events where startAt is before endDate
        lte(events.startAt, endDate)
      ),
      with: {
        attendees: true,
      },
    });

    // Filter by member if requested
    const filteredEvents = input.memberIds?.length
      ? rawEvents.filter(
          (e) =>
            e.createdBy === input.memberIds![0] ||
            e.attendees.some((a) => input.memberIds!.includes(a.userId ?? ""))
        )
      : rawEvents;

    // Filter by category
    const categoryFiltered = input.categories?.length
      ? filteredEvents.filter((e) => input.categories!.includes(e.category as never))
      : filteredEvents;

    // Expand recurring events into instances
    return expandRecurringEvents(
      categoryFiltered.map((e) => ({
        ...e,
        startAt: new Date(e.startAt),
        endAt: e.endAt ? new Date(e.endAt) : null,
        attendees: e.attendees.map((a) => ({
          ...a,
          rsvpStatus: (a.rsvpStatus ?? "pending") as "pending" | "accepted" | "declined",
        })),
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
        description: e.description ?? null,
        location: e.location ?? null,
        rrule: e.rrule ?? null,
        parentEventId: e.parentEventId ?? null,
        color: e.color ?? null,
        category: e.category as never,
      })),
      startDate,
      endDate
    );
  }),

  /**
   * Get a single event by ID.
   */
  getById: householdProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.query.events.findFirst({
        where: and(eq(events.id, input.id), eq(events.householdId, ctx.householdId)),
        with: { attendees: { with: { profile: true } } },
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      return event;
    }),

  /**
   * Create a new event.
   */
  create: householdProcedure.input(CreateEventSchema).mutation(async ({ ctx, input }) => {
    const { attendeeIds, ...eventData } = input;

    const [event] = await ctx.db
      .insert(events)
      .values({
        ...eventData,
        startAt: new Date(input.startAt),
        endAt: input.endAt ? new Date(input.endAt) : null,
        householdId: ctx.householdId,
        createdBy: ctx.user.id,
      })
      .returning();

    if (!event) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Add attendees
    if (attendeeIds.length > 0) {
      await ctx.db.insert(eventAttendees).values(
        attendeeIds.map((userId) => ({
          eventId: event.id,
          userId,
          rsvpStatus: userId === ctx.user.id ? "accepted" : "pending",
        }))
      );
    }

    return event;
  }),

  /**
   * Update an event. For recurring events, supports "this", "this_and_future", "all" modes.
   */
  update: householdProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        updateMode: z.enum(["this", "this_and_future", "all"]).default("this"),
        instanceDate: z.string().datetime().optional(),
        data: UpdateEventSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.events.findFirst({
        where: and(eq(events.id, input.id), eq(events.householdId, ctx.householdId)),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { attendeeIds, ...eventData } = input.data;

      if (input.updateMode === "all" || !existing.rrule) {
        // Update the base event
        const [updated] = await ctx.db
          .update(events)
          .set({
            ...eventData,
            startAt: eventData.startAt ? new Date(eventData.startAt) : undefined,
            endAt: eventData.endAt ? new Date(eventData.endAt) : undefined,
            updatedAt: new Date(),
          })
          .where(eq(events.id, input.id))
          .returning();

        // Replace attendees if attendeeIds is provided
        if (attendeeIds !== undefined) {
          await ctx.db.delete(eventAttendees).where(eq(eventAttendees.eventId, input.id));
          if (attendeeIds.length > 0) {
            await ctx.db.insert(eventAttendees).values(
              attendeeIds.map((userId) => ({
                eventId: input.id,
                userId,
                rsvpStatus: userId === ctx.user.id ? "accepted" : "pending",
              }))
            );
          }
        }

        return updated;
      }

      // For "this" or "this_and_future", create an exception event
      // TODO: Full recurrence exception handling in Phase 1 completion
      const [updated] = await ctx.db
        .update(events)
        .set({
          ...eventData,
          startAt: eventData.startAt ? new Date(eventData.startAt) : undefined,
          endAt: eventData.endAt ? new Date(eventData.endAt) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(events.id, input.id))
        .returning();

      // Replace attendees if attendeeIds is provided
      if (attendeeIds !== undefined) {
        await ctx.db.delete(eventAttendees).where(eq(eventAttendees.eventId, input.id));
        if (attendeeIds.length > 0) {
          await ctx.db.insert(eventAttendees).values(
            attendeeIds.map((userId) => ({
              eventId: input.id,
              userId,
              rsvpStatus: userId === ctx.user.id ? "accepted" : "pending",
            }))
          );
        }
      }

      return updated;
    }),

  /**
   * Delete an event.
   */
  delete: householdProcedure.input(DeleteEventSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.query.events.findFirst({
      where: and(eq(events.id, input.id), eq(events.householdId, ctx.householdId)),
    });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

    await ctx.db.delete(events).where(eq(events.id, input.id));
    return { success: true };
  }),

  /**
   * Search events by title, description, or location (case-insensitive).
   */
  search: householdProcedure.input(SearchEventsSchema).query(async ({ ctx, input }) => {
    const results = await ctx.db.query.events.findMany({
      where: and(
        eq(events.householdId, ctx.householdId),
        or(
          ilike(events.title, `%${input.query}%`),
          ilike(events.description, `%${input.query}%`),
          ilike(events.location, `%${input.query}%`)
        )
      ),
      with: {
        attendees: true,
      },
      orderBy: (events, { desc }) => [desc(events.startAt)],
      limit: 20,
    });
    return results;
  }),

  /**
   * Update the current user's RSVP status for an event.
   */
  updateRsvp: householdProcedure
    .input(
      z.object({
        eventId: z.string().uuid(),
        status: z.enum(["accepted", "declined", "pending"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const attendee = await ctx.db.query.eventAttendees.findFirst({
        where: and(
          eq(eventAttendees.eventId, input.eventId),
          eq(eventAttendees.userId, ctx.user.id)
        ),
      });

      if (!attendee) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db
        .update(eventAttendees)
        .set({ rsvpStatus: input.status })
        .where(
          and(
            eq(eventAttendees.eventId, input.eventId),
            eq(eventAttendees.userId, ctx.user.id)
          )
        )
        .returning();

      return updated;
    }),
});
