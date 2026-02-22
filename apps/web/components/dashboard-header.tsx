"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";

export function DashboardHeader() {
  const [notificationCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: household } = trpc.household.getCurrent.useQuery();
  const me = household?.members.find((m) => m.userId === userId);

  const householdName = household?.name ?? "My Household";
  const displayName = me?.profile?.displayName ?? "";
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : "U";

  return (
    <header
      className="flex h-14 items-center justify-between border-b px-6"
      style={{
        borderColor: "rgb(var(--color-border) / 0.15)",
        background: "rgb(var(--color-bg-subtle) / 0.3)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Household selector placeholder */}
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted transition-all hover:bg-surface/50 hover:text-text"
        >
          <span>{householdName}</span>
          <span className="text-xs text-text-muted">▾</span>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-text-muted transition-all hover:bg-surface/50 hover:text-text"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span
              className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-bg"
              style={{ background: "rgb(var(--color-cta))" }}
            >
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* User avatar */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold transition-all hover:ring-2"
          style={{
            background: "linear-gradient(135deg, rgb(var(--color-accent) / 0.3), rgb(var(--color-accent) / 0.1))",
            border: "1px solid rgb(var(--color-accent) / 0.3)",
          }}
          aria-label="User menu"
        >
          <span className="text-accent">{avatarInitial}</span>
        </button>
      </div>
    </header>
  );
}
