"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trpcVanilla } from "@/lib/trpc/vanilla";

type Step = "account" | "household" | "persona";

export function RegisterForm() {
  const [step, setStep] = useState<Step>("account");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
    householdName: "",
    persona: "rosie" as "rosie" | "eddie",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function update(field: keyof typeof formData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (step === "account") {
      setStep("household");
      return;
    }
    if (step === "household") {
      setStep("persona");
      return;
    }

    // Final step: create account
    setError(null);
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          display_name: formData.displayName,
          household_name: formData.householdName,
          ai_persona: formData.persona,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Create the household and store ID for tRPC context
    try {
      const household = await trpcVanilla.household.create.mutate({
        name: formData.householdName,
      });
      localStorage.setItem("orbyt-household-id", household.id);
    } catch {
      // Household creation failed — user can create one from dashboard
      console.warn("Auto household creation failed, user will be prompted on dashboard");
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(["account", "household", "persona"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                step === s
                  ? "bg-accent text-bg"
                  : i < ["account", "household", "persona"].indexOf(step)
                    ? "bg-accent/30 text-accent"
                    : "bg-surface text-text-muted"
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && (
              <div
                className={`h-px flex-1 transition-all ${
                  i < ["account", "household", "persona"].indexOf(step)
                    ? "bg-accent/40"
                    : "bg-surface"
                }`}
                style={{ width: "2rem" }}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Step 1: Account */}
      {step === "account" && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="displayName" className="text-sm font-medium text-text-muted">
              Your name
            </label>
            <input
              id="displayName"
              type="text"
              value={formData.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              placeholder="Jane Smith"
              required
              className="orbyt-input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text-muted">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="jane@example.com"
              required
              autoComplete="email"
              className="orbyt-input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              className="orbyt-input"
            />
          </div>
        </>
      )}

      {/* Step 2: Household name */}
      {step === "household" && (
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-text">Name your household</h3>
            <p className="mt-1 text-sm text-text-muted">
              This is what your family members will see when they join.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="householdName" className="text-sm font-medium text-text-muted">
              Household name
            </label>
            <input
              id="householdName"
              type="text"
              value={formData.householdName}
              onChange={(e) => update("householdName", e.target.value)}
              placeholder="The Smith Family"
              required
              className="orbyt-input"
            />
          </div>
        </div>
      )}

      {/* Step 3: Choose AI persona */}
      {step === "persona" && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-text">
              Meet your AI butler
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              Choose your Orbyt assistant. You can change this anytime in Settings.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "rosie" as const,
                name: "Rosie",
                role: "Your AI Maid",
                description: "Warm, organized, and proactively helpful. Rosie keeps the household running smoothly.",
                emoji: "🤖",
              },
              {
                id: "eddie" as const,
                name: "Eddie",
                role: "Your AI Butler",
                description: "Efficient, analytical, and mission-focused. Eddie coordinates the household operations.",
                emoji: "🦾",
              },
            ].map((persona) => (
              <button
                key={persona.id}
                type="button"
                onClick={() => update("persona", persona.id)}
                className={`relative flex flex-col items-center gap-3 p-4 text-center transition-all rounded-2xl ${
                  formData.persona === persona.id
                    ? "border-2 border-accent bg-accent/10 shadow-[0_0_20px_rgb(var(--color-accent)/0.25)] scale-[1.02]"
                    : "glass-card glass-card-hover"
                }`}
              >
                {formData.persona === persona.id && (
                  <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                    <Check className="h-3 w-3 text-bg" />
                  </div>
                )}
                <span className="text-3xl">{persona.emoji}</span>
                <div>
                  <p className="font-display font-semibold text-text">{persona.name}</p>
                  <p className="text-xs text-accent">{persona.role}</p>
                </div>
                <p className="text-xs text-text-muted">{persona.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        {step !== "account" && (
          <button
            type="button"
            onClick={() => setStep(step === "persona" ? "household" : "account")}
            className="orbyt-button-ghost flex-1"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="orbyt-button-primary flex-1"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="orbital-ring h-4 w-4 animate-orbital-medium" />
              Creating account…
            </span>
          ) : step === "persona" ? (
            "Launch Orbyt"
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </form>
  );
}
