"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { trpcVanilla } from "@/lib/trpc/vanilla";

// ── Shared helpers ────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "data" in err) {
    const trpcErr = err as { data?: { code?: string }; message?: string };
    if (trpcErr.data?.code === "NOT_FOUND") {
      return "This invite link is invalid or has already been used.";
    }
    if (trpcErr.data?.code === "PRECONDITION_FAILED") {
      return "This invitation has expired. Ask your household admin for a new one.";
    }
    if (trpcErr.data?.code === "CONFLICT") {
      return "You're already a member of this household.";
    }
    return trpcErr.message ?? "Something went wrong. Please try again.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

// ── Logged-in: just accept ────────────────────────────────────────────────────

function AcceptPanel({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAccept() {
    setError(null);
    setLoading(true);
    try {
      const result = await trpcVanilla.household.acceptInvitation.mutate({
        token,
      });
      localStorage.setItem("orbyt-household-id", result.householdId);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-text">
          You've been invited
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Accept the invitation to join this household on Orbyt.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={handleAccept}
        disabled={loading}
        className="orbyt-button-primary"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="orbital-ring h-4 w-4 animate-orbital-medium" />
            Joining…
          </span>
        ) : (
          "Accept Invitation"
        )}
      </button>

      <p className="text-center text-sm text-text-muted">
        Wrong account?{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover transition-colors">
          Sign in with a different account
        </Link>
      </p>
    </div>
  );
}

// ── Not logged in: register then accept ───────────────────────────────────────

function RegisterAndAcceptPanel({ token }: { token: string }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 1. Sign up (no household step — joining an existing one)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // 2. Accept invitation (now authenticated)
    try {
      const result = await trpcVanilla.household.acceptInvitation.mutate({
        token,
      });
      localStorage.setItem("orbyt-household-id", result.householdId);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-text">
          Join your household
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Create an account to accept this invitation.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="text-sm font-medium text-text-muted">
          Your name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          required
          minLength={8}
          autoComplete="new-password"
          className="orbyt-input"
        />
      </div>

      <button type="submit" disabled={loading} className="orbyt-button-primary">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="orbital-ring h-4 w-4 animate-orbital-medium" />
            Creating account…
          </span>
        ) : (
          "Create Account & Join"
        )}
      </button>

      <p className="text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link
          href={`/login?redirectTo=/invite/${token}`}
          className="font-medium text-accent hover:text-accent-hover transition-colors"
        >
          Sign in instead
        </Link>
      </p>
    </form>
  );
}

// ── InviteForm (main export) ──────────────────────────────────────────────────

export function InviteForm({
  token,
  isLoggedIn,
}: {
  token: string;
  isLoggedIn: boolean;
}) {
  return isLoggedIn ? (
    <AcceptPanel token={token} />
  ) : (
    <RegisterAndAcceptPanel token={token} />
  );
}
