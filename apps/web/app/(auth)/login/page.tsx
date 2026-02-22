import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-text">Welcome back</h2>
        <p className="mt-1 text-sm text-text-muted">
          Sign in to your Orbyt household
        </p>
      </div>

      <LoginForm redirectTo={redirectTo} />

      <p className="text-center text-sm text-text-muted">
        New to Orbyt?{" "}
        <Link
          href="/register"
          className="font-medium text-accent hover:text-accent-hover transition-colors"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
