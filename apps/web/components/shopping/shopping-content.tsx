"use client";

import { useState } from "react";
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

  function handleSelectList(id: string) {
    setSelectedListId(id);
    setMobileView("items");
  }

  function handleBack() {
    setMobileView("lists");
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
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
    </div>
  );
}
