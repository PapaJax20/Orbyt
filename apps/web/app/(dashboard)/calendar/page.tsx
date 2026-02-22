import type { Metadata } from "next";
import { CalendarContent } from "@/components/calendar/calendar-content";

export const metadata: Metadata = { title: "Calendar — Orbyt" };

export default function CalendarPage() {
  return <CalendarContent />;
}
