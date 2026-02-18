"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@orbyt/api";

/**
 * tRPC React client. Import and use `trpc` in Client Components.
 *
 * @example
 * const tasks = trpc.tasks.list.useQuery({ status: ["todo"] });
 * const createTask = trpc.tasks.create.useMutation();
 */
export const trpc = createTRPCReact<AppRouter>();
