"use client";

import { useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";
import { trpc } from "@/lib/trpc/client";
import { EmptyState } from "@/components/ui/empty-state";
import { ContactDrawer } from "./contact-drawer";

// ── Types ─────────────────────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type Contact = RouterOutput["contacts"]["list"][number];
type UpcomingBirthday = RouterOutput["contacts"]["getUpcomingBirthdays"][number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function labelRelationship(r: string) {
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  spouse: "bg-pink-500", partner: "bg-rose-500", child: "bg-green-500",
  parent: "bg-blue-500", sibling: "bg-purple-500", extended_family: "bg-amber-500",
  friend: "bg-teal-500", doctor: "bg-cyan-500", teacher: "bg-indigo-500",
  neighbor: "bg-orange-500", colleague: "bg-slate-500",
  service_provider: "bg-gray-500", other: "bg-gray-400",
};

function BirthdayChip({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days === 0) return <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-500">Today! 🎉</span>;
  if (days <= 7) return <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-500">In {days} days</span>;
  if (days <= 30) return <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-accent border border-accent/30">In {days} days</span>;
  return null;
}

// ── Birthday Row ──────────────────────────────────────────────────────────────

function BirthdayRow({
  birthdays,
  onSelectContact,
}: {
  birthdays: UpcomingBirthday[];
  onSelectContact: (id: string) => void;
}) {
  if (birthdays.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Upcoming Birthdays 🎂
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {birthdays.map((contact) => (
          <button
            key={contact.id}
            onClick={() => onSelectContact(contact.id)}
            className="glass-card-subtle flex min-w-[130px] flex-col items-center gap-2 rounded-2xl p-3 text-center transition-all hover:glass-card-elevated"
          >
            <div className={[
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white",
              RELATIONSHIP_COLORS[contact.relationshipType] ?? "bg-gray-500",
            ].join(" ")}>
              {contact.firstName.charAt(0)}{contact.lastName?.charAt(0) ?? ""}
            </div>
            <div>
              <p className="text-xs font-medium text-text leading-tight">
                {contact.firstName} {contact.lastName}
              </p>
              <div className="mt-1">
                <BirthdayChip days={contact.daysUntilBirthday} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Contact Card ──────────────────────────────────────────────────────────────

function ContactCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const bgColor = RELATIONSHIP_COLORS[contact.relationshipType] ?? "bg-gray-500";

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="glass-card w-full rounded-2xl p-4 text-left transition-all hover:shadow-lg hover:shadow-accent/5"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={[
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
          bgColor,
        ].join(" ")} aria-hidden="true">
          {contact.firstName.charAt(0)}{contact.lastName?.charAt(0) ?? ""}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-text">
              {contact.firstName} {contact.lastName}
            </p>
          </div>

          <span className="mt-0.5 inline-block rounded-full border border-border bg-surface/60 px-2 py-0.5 text-xs capitalize text-text-secondary">
            {labelRelationship(contact.relationshipType)}
          </span>

          {contact.phone && (
            <p className="mt-1.5 text-xs text-text-secondary">{contact.phone}</p>
          )}

          {contact.daysUntilBirthday !== null && contact.daysUntilBirthday <= 30 && (
            <div className="mt-2">
              <BirthdayChip days={contact.daysUntilBirthday} />
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ── ContactsContent ───────────────────────────────────────────────────────────

export function ContactsContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRelType, setSelectedRelType] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "birthday" | "createdAt">("name");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: contacts, isLoading } = trpc.contacts.list.useQuery({
    search: debouncedSearch || undefined,
    relationshipType: selectedRelType || undefined,
    sortBy,
  });

  const { data: upcomingBirthdays } = trpc.contacts.getUpcomingBirthdays.useQuery({ daysAhead: 30 });

  function openCreate() {
    setSelectedContactId(null);
    setDrawerOpen(true);
  }

  function openContact(id: string) {
    setSelectedContactId(id);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setSelectedContactId(null), 300);
  }

  const hasSearch = debouncedSearch.length > 0 || selectedRelType.length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col gap-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-text">Contacts</h1>
            <p className="mt-1 text-text-secondary">Your family&apos;s contact book</p>
          </div>
          <button onClick={openCreate} className="orbyt-button-accent shrink-0 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Contact
          </button>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="orbyt-input w-full pl-9"
              placeholder="Search contacts…"
              aria-label="Search contacts"
            />
          </div>
          <select
            value={selectedRelType}
            onChange={(e) => setSelectedRelType(e.target.value)}
            className="orbyt-input"
            aria-label="Filter by relationship"
          >
            <option value="">All types</option>
            {["spouse","partner","child","parent","sibling","extended_family",
              "friend","doctor","teacher","neighbor","colleague","service_provider","other"]
              .map((r) => (
                <option key={r} value={r}>{labelRelationship(r)}</option>
              ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="orbyt-input"
            aria-label="Sort contacts"
          >
            <option value="name">Sort: Name</option>
            <option value="birthday">Sort: Birthday</option>
            <option value="createdAt">Sort: Recently Added</option>
          </select>
        </div>

        {/* Upcoming Birthdays */}
        {upcomingBirthdays && upcomingBirthdays.length > 0 && (
          <BirthdayRow birthdays={upcomingBirthdays} onSelectContact={openContact} />
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}

        {/* Empty states */}
        {!isLoading && contacts && contacts.length === 0 && !hasSearch && (
          <EmptyState
            character="rosie"
            expression="happy"
            title="No family contacts yet."
            description="Keep track of the important people in your family's life."
            actionLabel="Add Contact"
            onAction={openCreate}
          />
        )}

        {!isLoading && contacts && contacts.length === 0 && hasSearch && (
          <EmptyState
            character="eddie"
            expression="thinking"
            title="No contacts found"
            description={debouncedSearch ? `No contacts match "${debouncedSearch}"` : "No contacts match this filter"}
            actionLabel="Clear Search"
            onAction={() => { setSearchQuery(""); setSelectedRelType(""); }}
          />
        )}

        {/* Contact Grid */}
        {!isLoading && contacts && contacts.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onClick={() => openContact(contact.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      <ContactDrawer
        contactId={selectedContactId}
        open={drawerOpen}
        onClose={closeDrawer}
      />
    </>
  );
}
