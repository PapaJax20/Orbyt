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
  ParseNaturalLanguageDateSchema,
  ImportICalSchema,
  ExportICalSchema,
} from "@orbyt/shared/validators";
import {
  expandRecurringEvents,
  getNextBillDueDate,
  getNextBirthday,
} from "@orbyt/shared/utils";
import { router, householdProcedure } from "../trpc";
// @ts-ignore — Turbopack .js→.ts resolution
import { createNotification } from "./notifications";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Turbopack can't resolve .js→.ts extensionAlias; bundler resolves .ts directly
import { writeBackToConnectedAccounts } from "../lib/calendar-writeback";
import * as chrono from "chrono-node";
import ICAL from "ical.js";
import icalGenerator from "ical-generator";

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

    // Async write-back to connected external calendars (fire-and-forget)
    void writeBackToConnectedAccounts(
      ctx.db,
      ctx.user.id,
      {
        id: event.id,
        title: event.title,
        description: event.description ?? null,
        location: event.location ?? null,
        startAt: new Date(event.startAt),
        endAt: event.endAt ? new Date(event.endAt) : null,
        allDay: event.allDay,
        rrule: event.rrule ?? null,
        color: event.color ?? null,
      },
      "create"
    );

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

        // Async write-back to connected external calendars (fire-and-forget)
        if (updated) {
          void writeBackToConnectedAccounts(
            ctx.db,
            ctx.user.id,
            {
              id: updated.id,
              title: updated.title,
              description: updated.description ?? null,
              location: updated.location ?? null,
              startAt: new Date(updated.startAt),
              endAt: updated.endAt ? new Date(updated.endAt) : null,
              allDay: updated.allDay,
              rrule: updated.rrule ?? null,
              color: updated.color ?? null,
            },
            "update"
          );
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

        // Async write-back to connected external calendars (fire-and-forget)
        if (exception) {
          void writeBackToConnectedAccounts(
            ctx.db,
            ctx.user.id,
            {
              id: exception.id,
              title: exception.title,
              description: exception.description ?? null,
              location: exception.location ?? null,
              startAt: new Date(exception.startAt),
              endAt: exception.endAt ? new Date(exception.endAt) : null,
              allDay: exception.allDay,
              rrule: exception.rrule ?? null,
              color: exception.color ?? null,
            },
            "create"
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

        // Async write-back to connected external calendars (fire-and-forget)
        if (newSeries) {
          void writeBackToConnectedAccounts(
            ctx.db,
            ctx.user.id,
            {
              id: newSeries.id,
              title: newSeries.title,
              description: newSeries.description ?? null,
              location: newSeries.location ?? null,
              startAt: new Date(newSeries.startAt),
              endAt: newSeries.endAt ? new Date(newSeries.endAt) : null,
              allDay: newSeries.allDay,
              rrule: newSeries.rrule ?? null,
              color: newSeries.color ?? null,
            },
            "create"
          );
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

      // Async write-back to connected external calendars (fire-and-forget)
      void writeBackToConnectedAccounts(
        ctx.db,
        ctx.user.id,
        {
          id: input.id,
          title: existing.title,
          description: existing.description ?? null,
          location: existing.location ?? null,
          startAt: new Date(existing.startAt),
          endAt: existing.endAt ? new Date(existing.endAt) : null,
          allDay: existing.allDay,
          rrule: existing.rrule ?? null,
          color: existing.color ?? null,
        },
        "delete"
      );

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

  /**
   * Parse a natural language date/time string into structured event fields.
   * e.g. "Dentist appointment next Tuesday at 3pm" → { title, startAt, endAt, allDay }
   */
  parseNaturalLanguageDate: householdProcedure
    .input(ParseNaturalLanguageDateSchema)
    .query(async ({ input }) => {
      const refDate = input.referenceDate ? new Date(input.referenceDate) : new Date();
      const results = chrono.parse(input.text, refDate, { forwardDate: true });

      if (results.length === 0) {
        return { success: false as const, message: "Could not parse a date from the text" };
      }

      // results.length > 0 is guaranteed by the guard above; non-null assertion is safe
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const result = results[0]!;
      const startDate = result.start.date();
      const endDate = result.end?.date() ?? null;

      // Extract title: remove the parsed date portion from the original text
      const dateText = result.text;
      let title = input.text.replace(dateText, "").trim();
      // Clean up leading/trailing prepositions and punctuation
      title = title
        .replace(/^(at|on|from|to|for|in|the)\s+/i, "")
        .replace(/\s+(at|on|from|to|for|in)$/i, "")
        .trim();
      if (!title) title = input.text; // fallback to full text if nothing left

      // Determine if this is an all-day event
      const hasTime = result.start.isCertain("hour");
      const allDay = !hasTime;

      return {
        success: true as const,
        parsed: {
          title,
          startAt: startDate.toISOString(),
          endAt: endDate?.toISOString() ?? null,
          allDay,
        },
      };
    }),

  /**
   * Import events from an iCal (.ics) string into the household calendar.
   */
  importIcal: householdProcedure
    .input(ImportICalSchema)
    .mutation(async ({ ctx, input }) => {
      let jcalData: unknown[];
      try {
        jcalData = ICAL.parse(input.icsContent);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid iCal file format",
        });
      }

      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents("vevent");

      if (vevents.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No events found in the iCal file",
        });
      }

      let importedCount = 0;
      const errors: string[] = [];

      for (const vevent of vevents) {
        try {
          const event = new ICAL.Event(vevent);
          const title = event.summary;
          if (!title) continue;

          const startAt = event.startDate?.toJSDate();
          if (!startAt) continue;

          const endAt = event.endDate?.toJSDate() ?? null;
          const description = event.description ?? null;
          const location = event.location ?? null;
          const allDay = event.startDate?.isDate ?? false;

          // Check for RRULE — getFirstPropertyValue returns a Recur object with toString()
          const rruleProp = vevent.getFirstPropertyValue("rrule");
          const rrule = rruleProp ? String(rruleProp) : null;

          await ctx.db.insert(events).values({
            householdId: ctx.householdId,
            createdBy: ctx.user.id,
            title,
            description,
            location,
            category: "other",
            startAt,
            endAt,
            allDay,
            rrule: rrule ? `RRULE:${rrule}` : null,
          });

          importedCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          errors.push(msg);
        }
      }

      return { imported: importedCount, total: vevents.length, errors };
    }),

  /**
   * Export household calendar events as an iCal (.ics) string.
   * Optionally filter by date range or specific event IDs.
   */
  exportIcal: householdProcedure
    .input(ExportICalSchema)
    .query(async ({ ctx, input }) => {
      // Build query conditions
      const conditions = [eq(events.householdId, ctx.householdId)];

      if (input.startDate) {
        conditions.push(gte(events.startAt, new Date(input.startDate)));
      }
      if (input.endDate) {
        conditions.push(lte(events.startAt, new Date(input.endDate)));
      }

      let eventList = await ctx.db.query.events.findMany({
        where: and(...conditions),
      });

      // If specific event IDs were requested, filter to those
      if (input.eventIds?.length) {
        eventList = eventList.filter((e) => input.eventIds!.includes(e.id));
      }

      const calendar = icalGenerator({
        name: "Orbyt Calendar",
        prodId: { company: "Orbyt", product: "Orbyt Calendar" },
      });

      for (const event of eventList) {
        const icalEvent = calendar.createEvent({
          id: event.id,
          summary: event.title,
          start: event.startAt,
          end: event.endAt ?? undefined,
          allDay: event.allDay,
          description: event.description ?? undefined,
          location: event.location ?? undefined,
          created: event.createdAt,
          lastModified: event.updatedAt,
        });

        // Add RRULE if present — stored as "RRULE:FREQ=WEEKLY;..."
        // ical-generator's repeating() accepts a raw RRULE string (strips "RRULE:" prefix)
        if (event.rrule) {
          const rule = event.rrule.replace(/^RRULE:/i, "");
          icalEvent.repeating(rule);
        }
      }

      return { icsContent: calendar.toString(), eventCount: eventList.length };
    }),

  /**
   * List distinct event categories used by this household.
   */
  listCategories: householdProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .selectDistinct({ category: events.category })
      .from(events)
      .where(eq(events.householdId, ctx.householdId));
    return result.map((r) => r.category);
  }),
});
