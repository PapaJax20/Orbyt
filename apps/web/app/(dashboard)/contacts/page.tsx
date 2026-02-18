import type { Metadata } from "next";
export const metadata: Metadata = { title: "Contacts" };
export default function ContactsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-text">Contacts</h1>
        <p className="mt-1 text-text-muted">Your family CRM — relationships, birthdays, and important dates.</p>
      </div>
      <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
        <p className="text-5xl">👥</p>
        <p className="mt-4 font-display text-xl font-semibold text-text">Contact manager coming soon</p>
        <p className="mt-2 text-sm text-text-muted">Profiles, relationship graph, birthday tracking, notes</p>
      </div>
    </div>
  );
}