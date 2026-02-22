import type { Metadata } from "next";
import { SettingsContent } from "@/components/settings/settings-content";

export const metadata: Metadata = { title: "Settings — Orbyt" };

export default function SettingsPage() {
  return <SettingsContent />;
}
