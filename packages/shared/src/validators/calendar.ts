import { z } from "zod";

const EventCategorySchema = z.enum([
  "school",
  "medical",
  "work",
  "sports",
  "social",
  "family",
  "holiday",
  "birthday",
  "other",
]);

export const CreateEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(5000).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  category: EventCategorySchema.default("other"),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable().optional(),
  allDay: z.boolean().default(false),
  rrule: z.string().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
  attendeeIds: z.array(z.string().uuid()).default([]),
  reminderMinutes: z.array(z.number().int().min(0).max(10080)).optional(),
});

export const UpdateEventSchema = CreateEventSchema.partial();

export const ListEventsSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  memberIds: z.array(z.string().uuid()).optional(),
  categories: z.array(EventCategorySchema).optional(),
});

export const DeleteEventSchema = z.object({
  id: z.string().uuid(),
  deleteMode: z.enum(["this", "this_and_future", "all"]).default("this"),
  instanceDate: z.string().datetime().optional(),
});

export const SearchEventsSchema = z.object({
  query: z.string().min(1).max(200),
});

export const GetAgendaItemsSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  includeBills: z.boolean().default(true),
  includeTasks: z.boolean().default(true),
  includeBirthdays: z.boolean().default(true),
});

export type AgendaItemType = "event" | "bill" | "task" | "birthday" | "anniversary";

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type ListEventsInput = z.infer<typeof ListEventsSchema>;
export type SearchEventsInput = z.infer<typeof SearchEventsSchema>;
export type GetAgendaItemsInput = z.infer<typeof GetAgendaItemsSchema>;
