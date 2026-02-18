import { z } from "zod";

export const CreateShoppingListSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  emoji: z.string().max(10).default("🛒"),
  isDefault: z.boolean().default(false),
});

export const AddShoppingItemSchema = z.object({
  listId: z.string().uuid(),
  name: z.string().min(1, "Item name is required").max(255),
  quantity: z.string().max(50).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const CheckShoppingItemSchema = z.object({
  itemId: z.string().uuid(),
  checked: z.boolean(),
});

export const UpdateShoppingItemSchema = AddShoppingItemSchema.omit({ listId: true }).partial();

export type CreateShoppingListInput = z.infer<typeof CreateShoppingListSchema>;
export type AddShoppingItemInput = z.infer<typeof AddShoppingItemSchema>;
