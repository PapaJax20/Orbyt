"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";

// ── Theme definitions ─────────────────────────────────────────────────────────

type Theme =
  | "cosmic"
  | "solar"
  | "aurora"
  | "aurora-light"
  | "nebula"
  | "titanium"
  | "titanium-light"
  | "ember"
  | "ember-light";

const THEMES: { id: Theme; label: string; accent: string; bg: string }[] = [
  { id: "cosmic", label: "Orbit", accent: "#06B6D4", bg: "#0a0f1e" },
  { id: "solar", label: "Solar", accent: "#F59E0B", bg: "#0f0a00" },
  { id: "aurora", label: "Aurora", accent: "#10B981", bg: "#021a0e" },
  { id: "aurora-light", label: "Aurora Light", accent: "#059669", bg: "#f0fdf4" },
  { id: "nebula", label: "Nebula", accent: "#8B5CF6", bg: "#0d0514" },
  { id: "titanium", label: "Titanium", accent: "#94A3B8", bg: "#0a0c0f" },
  { id: "titanium-light", label: "Titanium Light", accent: "#64748B", bg: "#f8fafc" },
  { id: "ember", label: "Ember", accent: "#EF4444", bg: "#110505" },
  { id: "ember-light", label: "Ember Light", accent: "#DC2626", bg: "#fff7f7" },
];

// ── AppearanceTab ─────────────────────────────────────────────────────────────

export function AppearanceTab() {
  const utils = trpc.useUtils();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTheme, setActiveTheme] = useState<Theme>("cosmic");

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: household } = trpc.household.getCurrent.useQuery();
  const me = household?.members.find((m) => m.userId === userId);

  // Sync theme from profile
  useEffect(() => {
    const profileTheme = me?.profile?.theme;
    if (profileTheme) {
      setActiveTheme(profileTheme as Theme);
      localStorage.setItem("orbyt-theme", profileTheme);
    }
  }, [me?.profile?.theme]);

  const updateProfile = trpc.household.updateProfile.useMutation({
    onSuccess: () => {
      utils.household.getCurrent.invalidate();
      toast.success("Theme applied");
    },
    onError: (err) => toast.error(err.message ?? "Failed to apply theme"),
  });

  function handleThemeChange(theme: Theme) {
    setActiveTheme(theme);
    // Immediately apply to DOM
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("orbyt-theme", theme);
    // Persist
    updateProfile.mutate({ theme });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Theme
        </h2>
        <p className="text-sm text-text-muted">
          Choose the look and feel of your Orbyt.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {THEMES.map((theme) => {
          const isActive = activeTheme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleThemeChange(theme.id)}
              className={[
                "glass-card flex flex-col gap-3 rounded-2xl p-4 text-left transition-all",
                isActive
                  ? "ring-2 ring-accent"
                  : "hover:ring-1 hover:ring-accent/30",
              ].join(" ")}
            >
              {/* Mini preview */}
              <div
                className="flex h-10 w-full items-center gap-2 overflow-hidden rounded-lg px-2"
                style={{ backgroundColor: theme.bg }}
              >
                <div
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: theme.accent }}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <div
                    className="h-1 rounded-full opacity-40"
                    style={{ backgroundColor: theme.accent, width: "70%" }}
                  />
                  <div
                    className="h-1 rounded-full opacity-20"
                    style={{ backgroundColor: theme.accent, width: "50%" }}
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-text">{theme.label}</p>
                {isActive && (
                  <p className="mt-0.5 text-xs text-accent">Active</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
