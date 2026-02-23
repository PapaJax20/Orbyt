"use client";

import { useState, useEffect, useCallback } from "react";
import { Target, TrendingUp, Calculator, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";

// ── Timezone options ──────────────────────────────────────────────────────────

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Toronto",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

// ── Illustrated avatar options ───────────────────────────────────────────────

const ILLUSTRATED_AVATARS = [
  "/characters/avatars/illustrated/avatar-01.svg",
  "/characters/avatars/illustrated/avatar-02.svg",
  "/characters/avatars/illustrated/avatar-03.svg",
  "/characters/avatars/illustrated/avatar-04.svg",
  "/characters/avatars/illustrated/avatar-05.svg",
];

// ── Finance module toggle config ─────────────────────────────────────────────

const FINANCE_MODULES = [
  {
    key: "goals" as const,
    label: "Goals",
    description: "Track savings goals and sinking funds",
    Icon: Target,
  },
  {
    key: "netWorth" as const,
    label: "Net Worth",
    description: "Monitor your household net worth over time",
    Icon: TrendingUp,
  },
  {
    key: "debtPlanner" as const,
    label: "Debt Planner",
    description: "Plan debt payoff with snowball or avalanche strategies",
    Icon: Calculator,
  },
  {
    key: "analytics" as const,
    label: "Analytics",
    description: "View spending charts, income trends, and budget comparisons",
    Icon: BarChart3,
  },
];

// ── FinanceModulesSection ────────────────────────────────────────────────────

function FinanceModulesSection({
  profile,
}: {
  profile: { financeModules?: { goals?: boolean; netWorth?: boolean; debtPlanner?: boolean; analytics?: boolean } | null };
}) {
  const utils = trpc.useUtils();

  const toggleModule = trpc.household.updateProfile.useMutation({
    onSuccess: () => {
      utils.household.getCurrent.invalidate();
      toast.success("Module preference saved");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update module preference");
    },
  });

  const currentModules = profile.financeModules ?? {};

  const handleToggle = useCallback(
    (key: "goals" | "netWorth" | "debtPlanner" | "analytics", currentValue: boolean) => {
      toggleModule.mutate({
        financeModules: { ...currentModules, [key]: !currentValue },
      });
    },
    [currentModules, toggleModule],
  );

  return (
    <div>
      <p className="orbyt-label">Finance Modules</p>
      <p className="mb-3 mt-1 text-xs text-text-muted">
        Toggle optional finance features on or off.
      </p>
      <div className="flex flex-col gap-3">
        {FINANCE_MODULES.map(({ key, label, description, Icon }) => {
          const isEnabled = currentModules[key] !== false;
          return (
            <div
              key={key}
              className="glass-card-subtle flex items-center justify-between gap-4 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/5 p-2 text-accent" aria-label={label}>
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">{label}</p>
                  <p className="text-xs text-text-muted">{description}</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                aria-label={`Toggle ${label}`}
                onClick={() => handleToggle(key, isEnabled)}
                disabled={toggleModule.isPending}
                className={[
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50",
                  isEnabled ? "bg-accent" : "bg-white/10",
                ].join(" ")}
              >
                <span
                  className={[
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
                    isEnabled ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ProfileTab ────────────────────────────────────────────────────────────────

export function ProfileTab() {
  const utils = trpc.useUtils();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: household } = trpc.household.getCurrent.useQuery();
  const me = household?.members.find((m) => m.userId === userId);
  const profile = me?.profile;

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(ILLUSTRATED_AVATARS[0]);
  const [aiPersona, setAiPersona] = useState<"rosie" | "eddie">("rosie");
  const [timezone, setTimezone] = useState("UTC");
  const [weekStartDay, setWeekStartDay] = useState<"sunday" | "monday">("sunday");
  const [synced, setSynced] = useState(false);

  // Sync form values from profile (once)
  useEffect(() => {
    if (profile && !synced) {
      setDisplayName(profile.displayName ?? "");
      setAvatarUrl(profile.avatarUrl ?? ILLUSTRATED_AVATARS[0]);
      setAiPersona((profile.aiPersona as "rosie" | "eddie") ?? "rosie");
      setTimezone(profile.timezone ?? "UTC");
      setWeekStartDay(((profile as Record<string, unknown>).weekStartDay as "sunday" | "monday") ?? "sunday");
      setSynced(true);
    }
  }, [profile, synced]);

  const updateProfile = trpc.household.updateProfile.useMutation({
    onSuccess: () => {
      utils.household.getCurrent.invalidate();
      toast.success("Profile updated");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update profile");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate({
      displayName: displayName.trim(),
      aiPersona,
      timezone,
      weekStartDay,
    });
  }

  if (!profile) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-6">
      {/* Display Name */}
      <div>
        <label className="orbyt-label" htmlFor="display-name">
          Display Name
        </label>
        <input
          id="display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="orbyt-input mt-1 w-full"
          placeholder="Your name"
          required
          maxLength={100}
        />
      </div>

      {/* Email (read-only) */}
      <div>
        <p className="orbyt-label">Email</p>
        <p className="mt-1 text-sm text-text-muted">{profile.email}</p>
      </div>

      {/* Avatar */}
      <div>
        <p className="orbyt-label">Avatar</p>
        <div className="mt-2 flex flex-col items-start gap-3">
          {/* Current avatar preview */}
          <img
            src={avatarUrl}
            alt="Current avatar"
            className="h-16 w-16 rounded-full object-cover"
          />
          {/* Avatar selection grid */}
          <div className="glass-card-subtle grid w-full grid-cols-5 gap-3 rounded-2xl p-3">
            {ILLUSTRATED_AVATARS.map((url) => {
              const isSelected = avatarUrl === url;
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => {
                    if (!isSelected) {
                      setAvatarUrl(url);
                      updateProfile.mutate({ avatarUrl: url });
                    }
                  }}
                  className={[
                    "flex items-center justify-center rounded-full transition-all",
                    isSelected
                      ? "ring-2 ring-accent scale-105"
                      : "hover:ring-1 hover:ring-accent/30",
                  ].join(" ")}
                >
                  <img
                    src={url}
                    alt={`Avatar option ${url.slice(-6, -4)}`}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Companion */}
      <div>
        <p className="orbyt-label">AI Companion</p>
        <p className="mb-3 mt-1 text-xs text-text-muted">
          Choose your household's AI assistant personality.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["rosie", "eddie"] as const).map((persona) => (
            <button
              key={persona}
              type="button"
              onClick={() => setAiPersona(persona)}
              className={[
                "glass-card rounded-2xl p-4 text-left transition-all",
                aiPersona === persona
                  ? "ring-2 ring-accent"
                  : "hover:ring-1 hover:ring-accent/30",
              ].join(" ")}
            >
              <p className="font-semibold capitalize text-text">{persona}</p>
              <p className="mt-1 text-xs text-text-muted">
                {persona === "rosie"
                  ? "Warm, nurturing, and organized"
                  : "Efficient, direct, and analytical"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="orbyt-label" htmlFor="timezone">
          Timezone
        </label>
        <select
          id="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="orbyt-input mt-1 w-full"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Week Start */}
      <div>
        <label className="orbyt-label" htmlFor="week-start">
          Week Starts On
        </label>
        <select
          id="week-start"
          value={weekStartDay}
          onChange={(e) => setWeekStartDay(e.target.value as "sunday" | "monday")}
          className="orbyt-input mt-1 w-full"
        >
          <option value="sunday">Sunday</option>
          <option value="monday">Monday</option>
        </select>
      </div>

      {/* Finance Modules */}
      <FinanceModulesSection profile={profile} />

      <button
        type="submit"
        disabled={updateProfile.isPending || !displayName.trim()}
        className="orbyt-button-accent self-start"
      >
        {updateProfile.isPending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
