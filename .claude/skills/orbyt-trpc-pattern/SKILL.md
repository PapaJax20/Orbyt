---
name: orbyt-trpc-pattern
description: How to use tRPC queries and mutations in Orbyt Client Components
---

# tRPC Usage in Orbyt

## Querying data
```tsx
"use client";
import { trpc } from "@/lib/trpc/client";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Bill = RouterOutput["finances"]["listBills"][number];

export function MyComponent() {
  const { data, isLoading, error } = trpc.finances.listBills.useQuery();
  // Handle all three states: isLoading, error, data
}
```

## Mutating data
```tsx
const utils = trpc.useUtils();
const mutation = trpc.finances.markPaid.useMutation({
  onSuccess: () => {
    utils.finances.listBills.invalidate();
    utils.finances.getMonthlyOverview.invalidate();
    toast.success("Bill marked as paid");
  },
  onError: (error) => {
    toast.error(error.message || "Something went wrong");
  },
});
```

## Key rules
- NEVER manually type API responses. Use `inferRouterOutputs<AppRouter>`.
- ALWAYS invalidate related queries on mutation success.
- ALWAYS show toast on success and error.
- Use `mutation.isPending` to disable submit buttons.
