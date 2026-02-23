import { z } from "zod";
import { eq, and, gte, lte, ilike, or, ne, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { events, eventAttendees } from "@orbyt/db/schema";
import { bills, tasks as tasksTable, contacts } from "@orbyt/db/schema";
import {
  CreateEventSchema,
  UpdateEventSchema,
  ListEventsSchema,
  DeleteEventSchema,
  SearchEventsSchema,
  GetAgendaItemsSchema,
} from "@orbyt/shared/validators";
import {
  expandRecurringEvents,
  getNextBillDueDate,
  getNextBirthday,
} from "@orbyt/shared/utils";
import { router, householdProcedure } from "../trpc";
import { createNotification } from "./notifications";

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
    const expanded = expandRecurringEvents(
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

    // Filter out instances that have been excluded (EXDATES)
    const filtered = expanded.filter((instance) => {
      if (!instance.isRecurringInstance) return true;
      // Find the base event to check exdates
      const baseEvent = categoryFiltered.find((e) => e.id === instance.originalEventId);
      const exdates =
        ((baseEvent?.metadata as Record<string, unknown>)?.exdates as string[]) ?? [];
      if (exdates.length === 0) return true;
      // Check if this instance's date matches any exdate
      return !exdates.some((exdate) => {
        const exdateTime = new Date(exdate).getTime();
        const instanceTime = instance.instanceDate.getTime();
        // Allow 1 minute tolerance for floating point
        return Math.abs(exdateTime - instanceTime) < 60000;
      });
    });

    return filtered;
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
    const { attendeeIds, reminderMinutes, ...eventData } = input;

    const [event] = await ctx.db
      .insert(events)
      .values({
        ...eventData,
        startAt: new Date(input.startAt),
        endAt: input.endAt ? new Date(input.endAt) : null,
        reminderMinutes: reminderMinutes ?? [],
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

      // Notify attendees (except the creator) about the new event
      const otherAttendees = attendeeIds.filter((userId) => userId !== ctx.user.id);
      await Promise.all(
        otherAttendees.map((userId) =>
          createNotification(ctx.db, {
            userId,
            householdId: ctx.householdId,
            type: "event_invite",
            title: `New event: ${event.title}`,
            body: `You've been added to "${event.title}".`,
            data: {
              entityType: "event",
              entityId: event.id,
              route: `/calendar`,
            },
            channels: ["in_app"],
          })
        )
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

      // "this" mode — create a single exception event for this instance
      if (input.updateMode === "this" && existing.rrule) {
        if (!input.instanceDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "instanceDate required for 'this' mode",
          });
        }

        // Create exception event (child)
        const instanceStart = eventData.startAt
          ? new Date(eventData.startAt)
          : new Date(input.instanceDate);
        const duration =
          existing.endAt ? existing.endAt.getTime() - existing.startAt.getTime() : 0;
        const instanceEnd = eventData.endAt
          ? new Date(eventData.endAt)
          : duration > 0
            ? new Date(instanceStart.getTime() + duration)
            : null;

        const [exception] = await ctx.db
          .insert(events)
          .values({
            title: eventData.title ?? existing.title,
            description:
              eventData.description !== undefined
                ? eventData.description
                : existing.description,
            location:
              eventData.location !== undefined ? eventData.location : existing.location,
            category: eventData.category ?? (existing.category as never),
            startAt: instanceStart,
            endAt: instanceEnd,
            allDay: eventData.allDay ?? existing.allDay,
            color: eventData.color !== undefined ? eventData.color : existing.color,
            reminderMinutes: existing.reminderMinutes,
            parentEventId: existing.id,
            householdId: ctx.householdId,
            createdBy: ctx.user.id,
            rrule: null, // exception is not recurring
          })
          .returning();

        // Add EXDATE to parent metadata
        const existingMeta =
          (existing.metadata ?? {}) as Record<string, unknown>;
        const exdates = (existingMeta.exdates as string[]) ?? [];
        exdates.push(new Date(input.instanceDate).toISOString());

        await ctx.db
          .update(events)
          .set({
            metadata: { ...existingMeta, exdates },
            updatedAt: new Date(),
          })
          .where(eq(events.id, existing.id));

        // Add attendees to exception if provided
        if (attendeeIds?.length) {
          await ctx.db.insert(eventAttendees).values(
            attendeeIds.map((userId) => ({
              eventId: exception!.id,
              userId,
              rsvpStatus: userId === ctx.user.id ? "accepted" : "pending",
            }))
          );
        }

        return exception;
      }

      // "this_and_future" mode — truncate parent RRULE and create new series
      if (input.updateMode === "this_and_future" && existing.rrule) {
        if (!input.instanceDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "instanceDate required for 'this_and_future' mode",
          });
        }

        // Truncate parent RRULE with UNTIL (day before instanceDate)
        const untilDate = new Date(
          new Date(input.instanceDate).getTime() - 86400000
        );
        const existingRrule = existing.rrule;
        let truncatedRrule = existingRrule;
        // Remove existing UNTIL or COUNT if present, add new UNTIL
        truncatedRrule = truncatedRrule
          .replace(/;UNTIL=[^;]*/i, "")
          .replace(/;COUNT=[^;]*/i, "");
        truncatedRrule += `;UNTIL=${untilDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

        await ctx.db
          .update(events)
          .set({
            rrule: truncatedRrule,
            updatedAt: new Date(),
          })
          .where(eq(events.id, existing.id));

        // Create new recurring series from instanceDate
        const instanceStart = eventData.startAt
          ? new Date(eventData.startAt)
          : new Date(input.instanceDate);
        const duration =
          existing.endAt ? existing.endAt.getTime() - existing.startAt.getTime() : 0;
        const instanceEnd = eventData.endAt
          ? new Date(eventData.endAt)
          : duration > 0
            ? new Date(instanceStart.getTime() + duration)
            : null;

        // Build new rrule with same frequency but no UNTIL/COUNT
        const newRrule = existingRrule
          .replace(/;UNTIL=[^;]*/i, "")
          .replace(/;COUNT=[^;]*/i, "");

        const [newSeries] = await ctx.db
          .insert(events)
          .values({
            title: eventData.title ?? existing.title,
            description:
              eventData.description !== undefined
                ? eventData.description
                : existing.description,
            location:
              eventData.location !== undefined ? eventData.location : existing.location,
            category: eventData.category ?? (existing.category as never),
            startAt: instanceStart,
            endAt: instanceEnd,
            allDay: eventData.allDay ?? existing.allDay,
            rrule: newRrule,
            color: eventData.color !== undefined ? eventData.color : existing.color,
            reminderMinutes: existing.reminderMinutes,
            parentEventId: existing.id,
            householdId: ctx.householdId,
            createdBy: ctx.user.id,
          })
          .returning();

        // Copy or replace attendees
        if (attendeeIds !== undefined) {
          if (attendeeIds.length > 0) {
            await ctx.db.insert(eventAttendees).values(
              attendeeIds.map((userId) => ({
                eventId: newSeries!.id,
                userId,
                rsvpStatus: userId === ctx.user.id ? "accepted" : "pending",
              }))
            );
          }
        } else {
          // Copy attendees from parent
          const parentAttendees = await ctx.db.query.eventAttendees.findMany({
            where: eq(eventAttendees.eventId, existing.id),
          });
          if (parentAttendees.length > 0) {
            await ctx.db.insert(eventAttendees).values(
              parentAttendees.map((a) => ({
                eventId: newSeries!.id,
                userId: a.userId,
                contactId: a.contactId,
                rsvpStatus: a.rsvpStatus,
              }))
            );
          }
        }

        return newSeries;
      }

      // Fallback — should not be reached, but handle gracefully
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid update mode" });
    }),

  /**
   * Delete an event. For recurring events, supports "this", "this_and_future", "all" modes.
   */
  delete: householdProcedure.input(DeleteEventSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.query.events.findFirst({
      where: and(eq(events.id, input.id), eq(events.householdId, ctx.householdId)),
    });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

    if (!existing.rrule || input.deleteMode === "all") {
      // Non-recurring or "delete all" — hard delete base event (cascade deletes attendees + children)
      await ctx.db.delete(events).where(eq(events.id, input.id));
      return { success: true };
    }

    if (input.deleteMode === "this") {
      // Add EXDATE to parent to skip this instance
      if (!input.instanceDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "instanceDate required for 'this' delete mode",
        });
      }
      const existingMeta =
        (existing.metadata ?? {}) as Record<string, unknown>;
      const exdates = (existingMeta.exdates as string[]) ?? [];
      exdates.push(new Date(input.instanceDate).toISOString());

      await ctx.db
        .update(events)
        .set({
          metadata: { ...existingMeta, exdates },
          updatedAt: new Date(),
        })
        .where(eq(events.id, input.id));

      return { success: true };
    }

    if (input.deleteMode === "this_and_future") {
      if (!input.instanceDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "instanceDate required for 'this_and_future' delete mode",
        });
      }
      // Truncate the RRULE with UNTIL = day before instanceDate
      const untilDate = new Date(
        new Date(input.instanceDate).getTime() - 86400000
      );
      let truncatedRrule = existing.rrule;
      truncatedRrule = truncatedRrule
        .replace(/;UNTIL=[^;]*/i, "")
        .replace(/;COUNT=[^;]*/i, "");
      truncatedRrule += `;UNTIL=${untilDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

      await ctx.db
        .update(events)
        .set({
          rrule: truncatedRrule,
          updatedAt: new Date(),
        })
        .where(eq(events.id, input.id));

      // Delete any child events on or after this date
      const children = await ctx.db.query.events.findMany({
        where: and(
          eq(events.parentEventId, input.id),
          gte(events.startAt, new Date(input.instanceDate))
        ),
      });
      for (const child of children) {
        await ctx.db.delete(events).where(eq(events.id, child.id));
      }

      return { success: true };
    }

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

  /**
   * Get a unified agenda list aggregating events, bills, tasks, and birthdays/anniversaries.
   * All items are sorted by date ascending.
   */
  getAgendaItems: householdProcedure
    .input(GetAgendaItemsSchema)
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      type AgendaItem = {
        type: "event" | "bill" | "task" | "birthday" | "anniversary";
        id: string;
        title: string;
        date: Date;
        allDay: boolean;
        metadata: Record<string, unknown>;
      };

      const agendaItems: AgendaItem[] = [];

      // --- 1. Events ---
      const rawEvents = await ctx.db.query.events.findMany({
        where: and(
          eq(events.householdId, ctx.householdId),
          lte(events.startAt, endDate)
        ),
        with: {
          attendees: true,
        },
      });

      const expandedEvents = expandRecurringEvents(
        rawEvents.map((e) => ({
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

      // Filter out exdated instances
      const filteredEvents = expandedEvents.filter((instance) => {
        if (!instance.isRecurringInstance) return true;
        const baseEvent = rawEvents.find((e) => e.id === instance.originalEventId);
        const exdates =
          ((baseEvent?.metadata as Record<string, unknown>)?.exdates as string[]) ?? [];
        if (exdates.length === 0) return true;
        return !exdates.some((exdate) => {
          const exdateTime = new Date(exdate).getTime();
          const instanceTime = instance.instanceDate.getTime();
          return Math.abs(exdateTime - instanceTime) < 60000;
        });
      });

      for (const instance of filteredEvents) {
        agendaItems.push({
          type: "event",
          id: instance.id,
          title: instance.title,
          date: instance.startAt,
          allDay: instance.allDay,
          metadata: {
            category: instance.category,
            location: instance.location,
            color: instance.color,
            isRecurring: instance.isRecurringInstance,
          },
        });
      }

      // --- 2. Bills ---
      if (input.includeBills) {
        const householdBills = await ctx.db.query.bills.findMany({
          where: and(
            eq(bills.householdId, ctx.householdId),
            // Use ne import for not-equal check
            eq(bills.isActive, true)
          ),
        });

        for (const bill of householdBills) {
          const nextDueDate = getNextBillDueDate(bill.dueDay);
          if (nextDueDate >= startDate && nextDueDate <= endDate) {
            agendaItems.push({
              type: "bill",
              id: bill.id,
              title: bill.name,
              date: nextDueDate,
              allDay: true,
              metadata: {
                amount: bill.amount,
                frequency: bill.rrule,
                category: bill.category,
              },
            });
          }
        }
      }

      // --- 3. Tasks ---
      if (input.includeTasks) {
        const householdTasks = await ctx.db.query.tasks.findMany({
          where: and(
            eq(tasksTable.householdId, ctx.householdId),
            isNotNull(tasksTable.dueAt),
            gte(tasksTable.dueAt, startDate),
            lte(tasksTable.dueAt, endDate),
            ne(tasksTable.status, "completed")
          ),
        });

        for (const task of householdTasks) {
          if (!task.dueAt) continue; // type guard — already filtered above
          agendaItems.push({
            type: "task",
            id: task.id,
            title: task.title,
            date: new Date(task.dueAt),
            allDay: false,
            metadata: {
              priority: task.priority,
              status: task.status,
            },
          });
        }
      }

      // --- 4. Birthdays & Anniversaries ---
      if (input.includeBirthdays) {
        const householdContacts = await ctx.db.query.contacts.findMany({
          where: eq(contacts.householdId, ctx.householdId),
        });

        for (const contact of householdContacts) {
          const fullName = `${contact.firstName}${contact.lastName ? " " + contact.lastName : ""}`;

          // Birthday
          if (contact.birthday) {
            const nextBirthday = getNextBirthday(contact.birthday);
            if (nextBirthday && nextBirthday >= startDate && nextBirthday <= endDate) {
              agendaItems.push({
                type: "birthday",
                id: contact.id,
                title: `${fullName}'s Birthday`,
                date: nextBirthday,
                allDay: true,
                metadata: {
                  contactId: contact.id,
                },
              });
            }
          }

          // Anniversary
          if (contact.anniversary) {
            const nextAnniversary = getNextBirthday(contact.anniversary);
            if (
              nextAnniversary &&
              nextAnniversary >= startDate &&
              nextAnniversary <= endDate
            ) {
              agendaItems.push({
                type: "anniversary",
                id: contact.id,
                title: `${fullName}'s Anniversary`,
                date: nextAnniversary,
                allDay: true,
                metadata: {
                  contactId: contact.id,
                },
              });
            }
          }
        }
      }

      // Sort all items by date ascending
      agendaItems.sort((a, b) => a.date.getTime() - b.date.getTime());

      return agendaItems;
    }),
});
