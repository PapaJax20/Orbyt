import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { shoppingLists, shoppingItems } from "@orbyt/db/schema";
import {
  CreateShoppingListSchema,
  AddShoppingItemSchema,
  CheckShoppingItemSchema,
  UpdateShoppingListSchema,
  DeleteShoppingListSchema,
} from "@orbyt/shared/validators";
import { router, householdProcedure } from "../trpc";

export const shoppingRouter = router({
  /**
   * List all active shopping lists for the household.
   */
  listLists: householdProcedure.query(async ({ ctx }) => {
    const lists = await ctx.db.query.shoppingLists.findMany({
      where: and(
        eq(shoppingLists.householdId, ctx.householdId),
        // Only non-archived lists
      ),
      with: {
        items: true,
      },
      orderBy: (l, { desc, asc }) => [desc(l.isDefault), asc(l.name)],
    });

    return lists.map((list) => ({
      ...list,
      itemCount: list.items.length,
      checkedCount: list.items.filter((i) => i.checked).length,
    }));
  }),

  /**
   * Create a new shopping list.
   */
  createList: householdProcedure
    .input(CreateShoppingListSchema)
    .mutation(async ({ ctx, input }) => {
      const [list] = await ctx.db
        .insert(shoppingLists)
        .values({
          ...input,
          householdId: ctx.householdId,
          createdBy: ctx.user.id,
        })
        .returning();
      return list;
    }),

  /**
   * List items in a shopping list, ordered by category then name.
   */
  listItems: householdProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify list belongs to household
      const list = await ctx.db.query.shoppingLists.findFirst({
        where: and(
          eq(shoppingLists.id, input.listId),
          eq(shoppingLists.householdId, ctx.householdId)
        ),
      });
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.query.shoppingItems.findMany({
        where: eq(shoppingItems.listId, input.listId),
        orderBy: [asc(shoppingItems.checked), asc(shoppingItems.category), asc(shoppingItems.name)],
      });
    }),

  /**
   * Add an item to a shopping list.
   */
  addItem: householdProcedure.input(AddShoppingItemSchema).mutation(async ({ ctx, input }) => {
    const list = await ctx.db.query.shoppingLists.findFirst({
      where: and(
        eq(shoppingLists.id, input.listId),
        eq(shoppingLists.householdId, ctx.householdId)
      ),
    });
    if (!list) throw new TRPCError({ code: "NOT_FOUND" });

    const [item] = await ctx.db
      .insert(shoppingItems)
      .values({
        ...input,
        addedBy: ctx.user.id,
      })
      .returning();

    return item;
  }),

  /**
   * Check or uncheck a shopping item.
   */
  checkItem: householdProcedure
    .input(CheckShoppingItemSchema)
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(shoppingItems)
        .set({
          checked: input.checked,
          checkedBy: input.checked ? ctx.user.id : null,
          checkedAt: input.checked ? new Date() : null,
        })
        .where(eq(shoppingItems.id, input.itemId))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /**
   * Delete a shopping item.
   */
  deleteItem: householdProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(shoppingItems).where(eq(shoppingItems.id, input.itemId));
      return { success: true };
    }),

  /**
   * Clear all checked items from a list.
   */
  clearChecked: householdProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(shoppingItems)
        .where(and(eq(shoppingItems.listId, input.listId), eq(shoppingItems.checked, true)));
      return { success: true };
    }),

  /**
   * Update (rename) a shopping list.
   */
  updateList: householdProcedure
    .input(UpdateShoppingListSchema)
    .mutation(async ({ ctx, input }) => {
      const list = await ctx.db.query.shoppingLists.findFirst({
        where: and(
          eq(shoppingLists.id, input.listId),
          eq(shoppingLists.householdId, ctx.householdId),
        ),
      });
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });

      const { listId, ...updates } = input;
      const [updated] = await ctx.db
        .update(shoppingLists)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(shoppingLists.id, listId))
        .returning();
      return updated;
    }),

  /**
   * Delete a shopping list and all its items (cascade).
   */
  deleteList: householdProcedure
    .input(DeleteShoppingListSchema)
    .mutation(async ({ ctx, input }) => {
      const list = await ctx.db.query.shoppingLists.findFirst({
        where: and(
          eq(shoppingLists.id, input.listId),
          eq(shoppingLists.householdId, ctx.householdId),
        ),
      });
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.delete(shoppingLists).where(eq(shoppingLists.id, input.listId));
      return { success: true };
    }),
});
