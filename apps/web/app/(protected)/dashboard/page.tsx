import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard-content";

export const metadata: Metadata = {
  title: "Dashboard — Orbyt",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardContent />
    </div>
  );
}
