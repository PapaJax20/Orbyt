"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { trpcVanilla } from "@/lib/trpc/vanilla";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Fetch user's households and set active household in localStorage
    try {
      const households = await trpcVanilla.household.list.query();
      if (households.length > 0) {
        localStorage.setItem("orbyt-household-id", households[0]!.id);
      }
    } catch {
      // Household fetch failed — dashboard guard will handle
      console.warn("Failed to fetch households on login");
    }

    router.push(redirectTo ?? "/dashboard");
    router.refresh();
  }

  async function handleForgotPassword() {
    // If the login email field already has a value, use it directly
    if (email) {
      setResetLoading(true);
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
      });
      toast.success(
        "If an account exists with that email, a password reset link has been sent."
      );
      setResetLoading(false);
      setShowReset(false);
      return;
    }
    // Otherwise show the inline reset form
    setShowReset(true);
  }

  async function handleResetSubmit() {
    if (!resetEmail) return;
    setResetLoading(true);
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });
    toast.success(
      "If an account exists with that email, a password reset link has been sent."
    );
    setResetLoading(false);
    setShowReset(false);
    setResetEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div
          className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-sm font-medium text-text-muted"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          className="orbyt-input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-sm font-medium text-text-muted"
          >
            Password
          </label>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="min-h-[44px] text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Forgot password?
          </button>
        </div>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
      </div>

      {/* Inline password reset form (shown when no email was filled in) */}
      {showReset && (
        <div className="flex flex-col gap-2 rounded-lg border border-accent/20 bg-accent/5 p-3">
          <p className="text-xs text-text-muted">
            Enter your email to receive a password reset link.
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              aria-label="Reset email address"
              className="orbyt-input text-sm"
            />
            <button
              type="button"
              onClick={handleResetSubmit}
              disabled={resetLoading || !resetEmail}
              className="orbyt-button-primary min-h-[44px] text-sm"
            >
              {resetLoading ? "Sending..." : "Send Link"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowReset(false);
              setResetEmail("");
            }}
            className="self-start min-h-[44px] text-xs text-text-muted hover:text-text transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="orbyt-button-primary mt-2"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="orbital-ring h-4 w-4 animate-orbital-medium" />
            Signing in...
          </span>
        ) : (
          "Sign In"
        )}
      </button>
    </form>
  );
}
