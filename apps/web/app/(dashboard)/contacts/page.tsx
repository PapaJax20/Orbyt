import type { Metadata } from "next";
import { ContactsContent } from "@/components/contacts/contacts-content";

export const metadata: Metadata = { title: "Contacts — Orbyt" };

export default function ContactsPage() {
  return <ContactsContent />;
}
