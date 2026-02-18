import type { Metadata } from "next";
export const metadata: Metadata = { title: "Finances" };
export default function FinancesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-text">Finances</h1>
        <p className="mt-1 text-text-muted">Track bills, subscriptions, and your family budget.</p>
      </div>
      <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
        <p className="text-5xl">💰</p>
        <p className="mt-4 font-display text-xl font-semibold text-text">Financial calendar coming soon</p>
        <p className="mt-2 text-sm text-text-muted">Bill tracking, subscription manager, monthly overview</p>
      </div>
    </div>
  );
}