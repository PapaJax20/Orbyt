"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings as SettingsIcon, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";

export function DashboardHeader() {
  const [userId, setUserId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const { data: household, isLoading } = trpc.household.getCurrent.useQuery();
  const me = household?.members.find((m) => m.userId === userId);

  const householdName = household?.name ?? "My Household";
  const displayName = me?.profile?.displayName ?? "";
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : "U";

  async function handleSignOut() {
    setMenuOpen(false);
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      className="flex h-14 items-center justify-between border-b px-6"
      style={{
        borderColor: "rgb(var(--color-border) / 0.15)",
        background: "rgb(var(--color-bg-subtle) / 0.3)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Household name (static display) */}
      <div className="flex items-center gap-2">
        {isLoading ? (
          <div className="h-5 w-28 animate-pulse rounded-md bg-surface/40" />
        ) : (
          <span className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted">
            {householdName}
          </span>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* User avatar + dropdown menu */}
        <div className="relative" ref={menuRef}>
          {isLoading ? (
            <div
              className="flex h-9 w-9 animate-pulse items-center justify-center rounded-xl"
              style={{
                background: "rgb(var(--color-surface) / 0.4)",
              }}
            />
          ) : (
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold transition-all hover:ring-2"
              style={{
                background:
                  "linear-gradient(135deg, rgb(var(--color-accent) / 0.3), rgb(var(--color-accent) / 0.1))",
                border: "1px solid rgb(var(--color-accent) / 0.3)",
              }}
              aria-label="User menu"
              aria-expanded={menuOpen}
            >
              <span className="text-accent">{avatarInitial}</span>
            </button>
          )}

          {menuOpen && (
            <div
              className="glass-card-elevated absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border py-1"
              style={{
                borderColor: "rgb(var(--color-border) / 0.15)",
              }}
            >
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface/50 hover:text-text"
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface/50 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
