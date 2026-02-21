import type { Metadata } from "next";
import { FinancesContent } from "@/components/finances/finances-content";

export const metadata: Metadata = { title: "Finances — Orbyt" };

export default function FinancesPage() {
  return <FinancesContent />;
}
