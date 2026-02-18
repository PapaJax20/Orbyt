import type { Metadata } from "next";
export const metadata: Metadata = { title: "Settings" };
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-text">Settings</h1>
        <p className="mt-1 text-text-muted">Manage your profile, household, and preferences.</p>
      </div>
      <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
        <p className="text-5xl">⚙️</p>
        <p className="mt-4 font-display text-xl font-semibold text-text">Settings coming soon</p>
        <p className="mt-2 text-sm text-text-muted">Profile, household, theme, notifications, AI persona</p>
      </div>
    </div>
  );
}