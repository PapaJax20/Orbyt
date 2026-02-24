"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";

/**
 * Ensures the user has a household selected before rendering dashboard content.
 * If no household exists, shows a creation form.
 * If households exist but none is selected, auto-selects the first one.
 */
export function HouseholdGuard({ children }: { children: React.ReactNode }) {
  const [hasHousehold, setHasHousehold] = useState<boolean | null>(null);
  const [householdName, setHouseholdName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  // Fetch the current user's auth ID so we can locate their profile in the members list
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const householdsQuery = trpc.household.list.useQuery(undefined, {
    retry: 1,
  });

  const createHousehold = trpc.household.create.useMutation({
    onSuccess: (household) => {
      localStorage.setItem("orbyt-household-id", household.id);
      setHasHousehold(true);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      setCreating(false);
    },
  });

  // Fetch household (and member profiles) only once we know the user has one.
  // This is used to sync the theme from the DB on devices without a cached theme.
  const { data: currentHousehold } = trpc.household.getCurrent.useQuery(
    undefined,
    { enabled: hasHousehold === true }
  );

  // If localStorage has no theme yet, read it from the user's profile in the DB.
  // "cosmic" is the DB default and maps to the "orbit" theme token in the UI.
  useEffect(() => {
    if (!currentHousehold || !userId) return;
    const alreadyCached = localStorage.getItem("orbyt-theme");
    if (alreadyCached) return;

    const me = currentHousehold.members.find((m) => m.userId === userId);
    const profileTheme = me?.profile?.theme;
    if (profileTheme) {
      // DB stores "cosmic" which is the CSS data-theme value (label "Orbit" in the UI)
      document.documentElement.setAttribute("data-theme", profileTheme);
      localStorage.setItem("orbyt-theme", profileTheme);
    }
  }, [currentHousehold, userId]);

  useEffect(() => {
    // Check localStorage first
    const storedId = localStorage.getItem("orbyt-household-id");
    if (storedId) {
      setHasHousehold(true);
      return;
    }

    // If query loaded, check if user has households
    if (householdsQuery.data) {
      if (householdsQuery.data.length > 0) {
        // Auto-select first household
        localStorage.setItem("orbyt-household-id", householdsQuery.data[0]!.id);
        setHasHousehold(true);
        router.refresh();
      } else {
        setHasHousehold(false);
      }
    }
  }, [householdsQuery.data, router]);

  // Still loading
  if (hasHousehold === null && householdsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="orbital-ring h-10 w-10 animate-orbital-medium" />
          <p className="text-sm text-text-muted">Loading your household…</p>
        </div>
      </div>
    );
  }

  // User has a household — render dashboard
  if (hasHousehold) {
    return <>{children}</>;
  }

  // No household — show creation form
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h2 className="font-display text-2xl font-bold text-text">
            Welcome to Orbyt
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Create your household to get started. You can invite family members later.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCreating(true);
            setError(null);
            createHousehold.mutate({ name: householdName });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="householdName"
              className="text-sm font-medium text-text-muted"
            >
              Household name
            </label>
            <input
              id="householdName"
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="The Smith Family"
              required
              className="orbyt-input"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !householdName.trim()}
            className="orbyt-button-primary"
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="orbital-ring h-4 w-4 animate-orbital-medium" />
                Creating…
              </span>
            ) : (
              "Create Household"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
