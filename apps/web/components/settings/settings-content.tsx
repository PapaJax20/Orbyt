"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import * as Tabs from "@radix-ui/react-tabs";
import { motion } from "framer-motion";

// ── Tab imports ───────────────────────────────────────────────────────────────

import { ProfileTab } from "./profile-tab";
import { HouseholdTab } from "./household-tab";
import { AppearanceTab } from "./appearance-tab";
import { NotificationsTab } from "./notifications-tab";
import { IntegrationsTab } from "./integrations-tab";

// ── Tabs config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "household", label: "Household" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "integrations", label: "Integrations" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VALID_TAB_IDS = new Set<string>(TABS.map((t) => t.id));

// ── SettingsContent ───────────────────────────────────────────────────────────

export function SettingsContent() {
  const searchParams = useSearchParams();

  // Resolve initial tab from URL param (e.g. /settings?tab=integrations from OAuth callback)
  const tabParam = searchParams.get("tab");
  const initialTab: TabId =
    tabParam && VALID_TAB_IDS.has(tabParam) ? (tabParam as TabId) : "profile";

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div>
        <h1 className="font-display text-3xl font-bold text-text">Settings</h1>
        <p className="mt-1 text-text-muted">Manage your profile and household preferences.</p>
      </div>

      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        {/* Tab list */}
        <Tabs.List className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface/50 p-1">
          {TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className={[
                "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "data-[state=active]:bg-accent data-[state=active]:text-white",
                "data-[state=inactive]:text-text-muted data-[state=inactive]:hover:text-text",
              ].join(" ")}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Tab panels */}
        <Tabs.Content value="profile" className="mt-6 focus:outline-none">
          <ProfileTab />
        </Tabs.Content>
        <Tabs.Content value="household" className="mt-6 focus:outline-none">
          <HouseholdTab />
        </Tabs.Content>
        <Tabs.Content value="appearance" className="mt-6 focus:outline-none">
          <AppearanceTab />
        </Tabs.Content>
        <Tabs.Content value="notifications" className="mt-6 focus:outline-none">
          <NotificationsTab />
        </Tabs.Content>
        <Tabs.Content value="integrations" className="mt-6 focus:outline-none">
          <IntegrationsTab />
        </Tabs.Content>
      </Tabs.Root>
    </motion.div>
  );
}
