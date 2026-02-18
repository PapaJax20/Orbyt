import type { Metadata } from "next";
export const metadata: Metadata = { title: "Shopping" };
export default function ShoppingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-text">Shopping</h1>
        <p className="mt-1 text-text-muted">Real-time collaborative shopping lists for your household.</p>
      </div>
      <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
        <p className="text-5xl">🛒</p>
        <p className="mt-4 font-display text-xl font-semibold text-text">Shopping lists coming soon</p>
        <p className="mt-2 text-sm text-text-muted">Real-time sync, categories, and multiple lists</p>
      </div>
    </div>
  );
}