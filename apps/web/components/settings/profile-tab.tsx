"use client";

import { useState, useEffect } from "react";
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
  const [aiPersona, setAiPersona] = useState<"rosie" | "eddie">("rosie");
  const [timezone, setTimezone] = useState("UTC");
  const [synced, setSynced] = useState(false);

  // Sync form values from profile (once)
  useEffect(() => {
    if (profile && !synced) {
      setDisplayName(profile.displayName ?? "");
      setAiPersona((profile.aiPersona as "rosie" | "eddie") ?? "rosie");
      setTimezone(profile.timezone ?? "UTC");
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
        <p className="mt-1 text-sm text-text-secondary">{profile.email}</p>
      </div>

      {/* AI Companion */}
      <div>
        <p className="orbyt-label">AI Companion</p>
        <p className="mb-3 mt-1 text-xs text-text-secondary">
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
              <p className="mt-1 text-xs text-text-secondary">
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
