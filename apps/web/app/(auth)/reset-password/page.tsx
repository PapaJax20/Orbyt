import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-text">
          Set a new password
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Choose a new password for your account
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
