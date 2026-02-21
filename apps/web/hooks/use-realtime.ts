"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeInvalidation(
  table: "shopping_items" | "tasks" | "events" | "notifications",
  filter: { column: string; value: string } | undefined,
  queryToInvalidate: () => void
) {
  useEffect(() => {
    const supabase = createClient();
    const channelName = `${table}-${filter?.value ?? "all"}`;
    const channelConfig = {
      event: "*" as const,
      schema: "public",
      table,
      ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
    };

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", channelConfig, () => queryToInvalidate())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter?.value]); // eslint-disable-line react-hooks/exhaustive-deps
}
