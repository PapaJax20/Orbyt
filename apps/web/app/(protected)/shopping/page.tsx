import type { Metadata } from "next";
import { ShoppingContent } from "@/components/shopping/shopping-content";

export const metadata: Metadata = { title: "Shopping — Orbyt" };

export default function ShoppingPage() {
  return <ShoppingContent />;
}
