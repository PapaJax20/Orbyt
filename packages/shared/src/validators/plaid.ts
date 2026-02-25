import { z } from "zod";

export const CreateLinkTokenSchema = z.object({
  // No input needed — server uses ctx.user.id
});

export const ExchangePublicTokenSchema = z.object({
  publicToken: z.string().min(1, "Public token is required"),
  institutionId: z.string().max(50).optional(),
  institutionName: z.string().max(200).optional(),
});

export const PlaidItemIdSchema = z.object({
  itemId: z.string().uuid(),
});

export const SyncTransactionsSchema = z.object({
  itemId: z.string().uuid(),
});

export const RefreshBalancesSchema = z.object({
  itemId: z.string().uuid(),
});

export const DisconnectItemSchema = z.object({
  itemId: z.string().uuid(),
});

export const UpdateAccountMappingSchema = z.object({
  plaidAccountId: z.string().uuid(),
  orbytAccountId: z.string().uuid().nullable(),
});

// Export types
export type ExchangePublicTokenInput = z.infer<typeof ExchangePublicTokenSchema>;
export type SyncTransactionsInput = z.infer<typeof SyncTransactionsSchema>;
export type RefreshBalancesInput = z.infer<typeof RefreshBalancesSchema>;
export type DisconnectItemInput = z.infer<typeof DisconnectItemSchema>;
export type UpdateAccountMappingInput = z.infer<typeof UpdateAccountMappingSchema>;
