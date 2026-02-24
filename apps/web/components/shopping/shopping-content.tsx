"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";
import { ListPanel } from "./list-panel";
import { ItemsPanel } from "./items-panel";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type ShoppingList = RouterOutput["shopping"]["listLists"][number];
export type ShoppingItem = RouterOutput["shopping"]["listItems"][number];

export function ShoppingContent() {
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  // Mobile view: "lists" | "items"
  const [mobileView, setMobileView] = useState<"lists" | "items">("lists");
  const [autoCreate, setAutoCreate] = useState(false);

  const searchParams = useSearchParams();

  // Auto-open the new list form when navigated from the dashboard empty-state CTA
  useEffect(() => {
    if (searchParams.get("action") === "create") {
      setAutoCreate(true);
      window.history.replaceState({}, "", "/shopping");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectList(id: string) {
    setSelectedListId(id);
    setMobileView("items");
  }

  function handleBack() {
    setMobileView("lists");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex h-full min-h-0 gap-4"
    >
      {/* Left panel — shopping lists */}
      <div
        className={[
          "w-full flex-shrink-0 md:w-[280px] md:block",
          mobileView === "lists" ? "block" : "hidden",
        ].join(" ")}
      >
        <ListPanel
          selectedListId={selectedListId}
          onSelectList={handleSelectList}
          autoCreate={autoCreate}
        />
      </div>

      {/* Right panel — items */}
      <div
        className={[
          "min-w-0 flex-1 md:block",
          mobileView === "items" ? "block" : "hidden",
        ].join(" ")}
      >
        <ItemsPanel
          selectedListId={selectedListId}
          onBack={handleBack}
        />
      </div>
    </motion.div>
  );
}
