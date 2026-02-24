import { z } from "zod";

export const ConnectAccountSchema = z.object({
  provider: z.enum(["google", "microsoft"]),
});

export const HandleCallbackSchema = z.object({
  provider: z.enum(["google", "microsoft"]),
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(128),
});

export const DisconnectAccountSchema = z.object({
  accountId: z.string().uuid(),
});

export const SyncCalendarSchema = z.object({
  accountId: z.string().uuid(),
});

export const ListExternalEventsSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const CheckScopesSchema = z.object({
  accountId: z.string().uuid(),
});

export const WriteBackEventSchema = z.object({
  eventId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const RegisterWebhookSchema = z.object({
  accountId: z.string().uuid(),
});

export const LinkEventSchema = z.object({
  eventId: z.string().uuid(),
  externalEventId: z.string().uuid(),
});

export const UnlinkEventSchema = z.object({
  eventId: z.string().uuid(),
});

export type ConnectAccountInput = z.infer<typeof ConnectAccountSchema>;
export type HandleCallbackInput = z.infer<typeof HandleCallbackSchema>;
export type DisconnectAccountInput = z.infer<typeof DisconnectAccountSchema>;
export type SyncCalendarInput = z.infer<typeof SyncCalendarSchema>;
export type ListExternalEventsInput = z.infer<typeof ListExternalEventsSchema>;
export type CheckScopesInput = z.infer<typeof CheckScopesSchema>;
export type WriteBackEventInput = z.infer<typeof WriteBackEventSchema>;
export type RegisterWebhookInput = z.infer<typeof RegisterWebhookSchema>;
export type LinkEventInput = z.infer<typeof LinkEventSchema>;
export type UnlinkEventInput = z.infer<typeof UnlinkEventSchema>;
