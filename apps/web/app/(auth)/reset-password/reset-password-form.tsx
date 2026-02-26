"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setLoading(false);

      // Same password error
      if (
        updateError.message
          .toLowerCase()
          .includes("same password") ||
        updateError.message
          .toLowerCase()
          .includes("different from the old password")
      ) {
        setError(
          "New password must be different from your current password."
        );
        return;
      }

      // Expired or invalid session (401)
      if (updateError.status === 401 || updateError.message.toLowerCase().includes("session")) {
        setError(
          "Your reset link has expired or is invalid. Please request a new one from the sign in page."
        );
        return;
      }

      // Generic error
      setError(updateError.message);
      return;
    }

    // Sign out so user must log in with the new password
    await supabase.auth.signOut();
    toast.success("Password updated. Sign in with your new password.");
    router.push("/login");
    router.refresh();
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
          htmlFor="new-password"
          className="text-sm font-medium text-text-muted"
        >
          New password
        </label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete="new-password"
          className="orbyt-input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirm-password"
          className="text-sm font-medium text-text-muted"
        >
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete="new-password"
          className="orbyt-input"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="orbyt-button-primary mt-2"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="orbital-ring h-4 w-4 animate-orbital-medium" />
            Updating password...
          </span>
        ) : (
          "Reset Password"
        )}
      </button>

      <p className="text-center text-sm text-text-muted">
        <Link
          href="/login"
          className="font-medium text-accent hover:text-accent-hover transition-colors"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
