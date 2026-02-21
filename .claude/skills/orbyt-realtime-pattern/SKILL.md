---
name: orbyt-realtime-pattern
description: How to set up Supabase Realtime subscriptions in Orbyt
---

# Realtime Subscription Pattern

## Using the hook
```tsx
import { useRealtimeInvalidation } from "@/hooks/use-realtime";
import { trpc } from "@/lib/trpc/client";

export function ShoppingContent() {
  const utils = trpc.useUtils();
  const { data } = trpc.shopping.listItems.useQuery({ listId: selectedListId });

  // Invalidate the query when any shopping_items row changes for this list
  useRealtimeInvalidation(
    "shopping_items",
    selectedListId ? { column: "list_id", value: selectedListId } : undefined,
    () => utils.shopping.listItems.invalidate({ listId: selectedListId })
  );
}
```

## Tables with Realtime enabled
- `shopping_items` — filter by `list_id`
- `tasks` — filter by `household_id`
- `events` — filter by `household_id`
- `notifications` — filter by `user_id`

## Rules
- ALWAYS clean up subscriptions in useEffect return
- ALWAYS filter by the most specific column to reduce noise
- The hook handles cleanup automatically
