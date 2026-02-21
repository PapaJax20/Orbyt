/**
 * Orbyt Seed Script
 * Creates deterministic demo data for local development.
 *
 * Usage:
 *   pnpm --filter @orbyt/db db:seed
 *
 * Requires env vars:
 *   DATABASE_URL
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { createDbClient } from "./client";
import {
  profiles,
  households,
  householdMembers,
  tasks,
  taskAssignees,
  events,
  eventAttendees,
  bills,
  billPayments,
  shoppingLists,
  shoppingItems,
  contacts,
  contactNotes,
} from "./schema";

// ── Config ─────────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const db = createDbClient(DATABASE_URL);

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function dateString(days: number): string {
  return daysFromNow(days).toISOString().split("T")[0]!;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Starting seed...");

  // ── 1. Auth Users ─────────────────────────────────────────────────────────────

  console.log("Creating auth users...");

  const { data: alexAuth, error: alexErr } = await supabaseAdmin.auth.admin.createUser({
    email: "demo@orbyt.app",
    password: "password123",
    email_confirm: true,
  });
  if (alexErr && !alexErr.message.includes("already registered")) {
    throw new Error(`Failed to create Alex: ${alexErr.message}`);
  }

  const { data: samAuth, error: samErr } = await supabaseAdmin.auth.admin.createUser({
    email: "member@orbyt.app",
    password: "password123",
    email_confirm: true,
  });
  if (samErr && !samErr.message.includes("already registered")) {
    throw new Error(`Failed to create Sam: ${samErr.message}`);
  }

  // Get actual user IDs (may already exist on re-seed)
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
  const alexId = users.find((u) => u.email === "demo@orbyt.app")?.id;
  const samId = users.find((u) => u.email === "member@orbyt.app")?.id;

  if (!alexId || !samId) throw new Error("Could not find seeded user IDs");

  // ── 2. Profiles ───────────────────────────────────────────────────────────────

  console.log("Upserting profiles...");

  await db.insert(profiles).values([
    {
      id: alexId,
      email: "demo@orbyt.app",
      displayName: "Alex Moon",
      theme: "orbit",
      aiPersona: "rosie",
      avatarType: "photo",
      timezone: "America/Chicago",
    },
    {
      id: samId,
      email: "member@orbyt.app",
      displayName: "Sam Moon",
      theme: "aurora",
      aiPersona: "eddie",
      avatarType: "illustrated",
      timezone: "America/Chicago",
    },
  ]).onConflictDoUpdate({
    target: profiles.id,
    set: {
      displayName: profiles.displayName,
      theme: profiles.theme,
      aiPersona: profiles.aiPersona,
      avatarType: profiles.avatarType,
      timezone: profiles.timezone,
    },
  });

  // ── 3. Household ──────────────────────────────────────────────────────────────

  console.log("Creating household...");

  const [household] = await db.insert(households).values({
    name: "Moon Family",
    slug: "moon-family",
    timezone: "America/Chicago",
  }).onConflictDoUpdate({
    target: households.slug,
    set: { name: "Moon Family" },
  }).returning();

  if (!household) throw new Error("Failed to create household");

  await db.insert(householdMembers).values([
    {
      householdId: household.id,
      userId: alexId,
      role: "admin",
      displayColor: "#06B6D4",
    },
    {
      householdId: household.id,
      userId: samId,
      role: "member",
      displayColor: "#A78BFA",
    },
  ]).onConflictDoNothing();

  // ── 4. Tasks ──────────────────────────────────────────────────────────────────

  console.log("Creating tasks...");

  const taskData = [
    { title: "Organize garage", status: "todo", priority: "high", dueAt: daysFromNow(1), description: "Sort through boxes and donate unused items", assignedTo: alexId },
    { title: "Buy birthday gift for Mom", status: "todo", priority: "medium", dueAt: daysFromNow(3), description: "She mentioned wanting a new cookbook", assignedTo: samId },
    { title: "Schedule dentist appointments", status: "todo", priority: "low", dueAt: daysFromNow(7), description: "Both kids need checkups", assignedTo: alexId },
    { title: "Fix leaky kitchen faucet", status: "in_progress", priority: "high", dueAt: daysFromNow(-1), description: "Washer replacement — parts ordered", assignedTo: alexId },
    { title: "Plan weekend meals", status: "in_progress", priority: "medium", dueAt: daysFromNow(2), description: null, assignedTo: samId },
    { title: "Update emergency contacts list", status: "todo", priority: "low", dueAt: daysFromNow(14), description: null, assignedTo: null },
    { title: "Clean out fridge", status: "done", priority: "low", dueAt: daysFromNow(-2), description: "Completed last Tuesday", assignedTo: samId },
    { title: "Pay quarterly taxes", status: "done", priority: "high", dueAt: daysFromNow(-5), description: "Filed and confirmed", assignedTo: alexId },
  ];

  for (const t of taskData) {
    const [task] = await db.insert(tasks).values({
      householdId: household.id,
      createdBy: alexId,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt,
      description: t.description,
      completedAt: t.status === "done" ? t.dueAt : null,
    }).returning();

    if (task && t.assignedTo) {
      await db.insert(taskAssignees).values({
        taskId: task.id,
        userId: t.assignedTo,
      }).onConflictDoNothing();
    }
  }

  // ── 5. Events ─────────────────────────────────────────────────────────────────

  console.log("Creating events...");

  const eventData = [
    {
      title: "Family Game Night",
      category: "family",
      startAt: new Date(daysFromNow(2).setHours(19, 0, 0, 0)),
      endAt: new Date(daysFromNow(2).setHours(21, 0, 0, 0)),
      allDay: false,
      rrule: null,
      attendees: [alexId, samId],
    },
    {
      title: "Sam's Soccer Practice",
      category: "school",
      startAt: new Date(daysFromNow(3).setHours(16, 0, 0, 0)),
      endAt: new Date(daysFromNow(3).setHours(17, 30, 0, 0)),
      allDay: false,
      rrule: "FREQ=WEEKLY;BYDAY=WE",
      attendees: [samId],
    },
    {
      title: "Mortgage Payment Due",
      category: "other",
      startAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      endAt: null,
      allDay: true,
      rrule: "FREQ=MONTHLY;BYMONTHDAY=1",
      attendees: [alexId],
    },
    {
      title: "Doctor Appointment",
      category: "health",
      startAt: new Date(daysFromNow(5).setHours(10, 0, 0, 0)),
      endAt: new Date(daysFromNow(5).setHours(11, 0, 0, 0)),
      allDay: false,
      rrule: null,
      attendees: [alexId],
    },
    {
      title: "Anniversary Dinner",
      category: "social",
      startAt: new Date(daysFromNow(-3).setHours(19, 0, 0, 0)),
      endAt: new Date(daysFromNow(-3).setHours(22, 0, 0, 0)),
      allDay: false,
      rrule: null,
      attendees: [alexId, samId],
    },
    {
      title: "Spring Break",
      category: "family",
      startAt: daysFromNow(20),
      endAt: daysFromNow(27),
      allDay: true,
      rrule: null,
      attendees: [alexId, samId],
    },
  ];

  for (const e of eventData) {
    const [event] = await db.insert(events).values({
      householdId: household.id,
      createdBy: alexId,
      title: e.title,
      category: e.category,
      startAt: e.startAt,
      endAt: e.endAt ?? undefined,
      allDay: e.allDay,
      rrule: e.rrule,
    }).returning();

    if (event) {
      for (const userId of e.attendees) {
        await db.insert(eventAttendees).values({
          eventId: event.id,
          userId,
          rsvpStatus: "accepted",
        }).onConflictDoNothing();
      }
    }
  }

  // ── 6. Bills ──────────────────────────────────────────────────────────────────

  console.log("Creating bills...");

  const billData = [
    { name: "Rent", amount: "1500.00", dueDay: 1, category: "housing", autoPay: false, notes: "Landlord: PropertyCo" },
    { name: "Electric", amount: "120.00", dueDay: 15, category: "utilities", autoPay: false, notes: null },
    { name: "Netflix", amount: "15.99", dueDay: 22, category: "subscriptions", autoPay: true, notes: "Family plan" },
    { name: "Car Insurance", amount: "200.00", dueDay: 5, category: "insurance", autoPay: true, notes: "Policy #INS-2024-8821" },
    { name: "Grocery Budget", amount: "600.00", dueDay: 1, category: "food", autoPay: false, notes: null },
  ];

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  for (const b of billData) {
    const [bill] = await db.insert(bills).values({
      householdId: household.id,
      createdBy: alexId,
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay,
      category: b.category,
      autoPay: b.autoPay,
      notes: b.notes,
      rrule: "FREQ=MONTHLY",
      currency: "USD",
      isActive: true,
    }).returning();

    if (!bill) continue;

    // Add payments for bills that have been paid this month
    const paidBills = ["Rent", "Netflix", "Car Insurance"];
    if (paidBills.includes(b.name)) {
      const paidDay = b.dueDay <= now.getDate() ? b.dueDay : 1;
      const paidAt = new Date(currentYear, currentMonth, paidDay);
      const dueDate = new Date(currentYear, currentMonth, b.dueDay);
      await db.insert(billPayments).values({
        billId: bill.id,
        paidBy: alexId,
        amount: b.amount,
        paidAt,
        dueDate,
        status: "paid",
      });
    }
  }

  // ── 7. Shopping Lists ─────────────────────────────────────────────────────────

  console.log("Creating shopping lists...");

  const [groceryList] = await db.insert(shoppingLists).values({
    householdId: household.id,
    createdBy: alexId,
    name: "Groceries",
    emoji: "🛒",
    isDefault: true,
  }).returning();

  const [homeDepotList] = await db.insert(shoppingLists).values({
    householdId: household.id,
    createdBy: alexId,
    name: "Home Depot",
    emoji: "🔨",
    isDefault: false,
  }).returning();

  if (groceryList) {
    await db.insert(shoppingItems).values([
      { listId: groceryList.id, addedBy: alexId, name: "Milk", quantity: "1 gallon", category: "Dairy", checked: false, sortOrder: 0 },
      { listId: groceryList.id, addedBy: alexId, name: "Eggs", quantity: "1 dozen", category: "Dairy", checked: false, sortOrder: 1 },
      { listId: groceryList.id, addedBy: samId, name: "Chicken breast", quantity: "2 lbs", category: "Meat", checked: false, sortOrder: 2 },
      { listId: groceryList.id, addedBy: samId, name: "Broccoli", quantity: "2 heads", category: "Produce", checked: true, checkedBy: samId, checkedAt: new Date(), sortOrder: 3 },
      { listId: groceryList.id, addedBy: alexId, name: "Rice", quantity: "5 lb bag", category: "Pantry", checked: true, checkedBy: alexId, checkedAt: new Date(), sortOrder: 4 },
      { listId: groceryList.id, addedBy: samId, name: "Bread", quantity: "1 loaf", category: "Bakery", checked: true, checkedBy: samId, checkedAt: new Date(), sortOrder: 5 },
      { listId: groceryList.id, addedBy: alexId, name: "Olive oil", quantity: null, category: "Pantry", checked: false, sortOrder: 6 },
      { listId: groceryList.id, addedBy: samId, name: "Bananas", quantity: "1 bunch", category: "Produce", checked: false, sortOrder: 7 },
    ]);
  }

  if (homeDepotList) {
    await db.insert(shoppingItems).values([
      { listId: homeDepotList.id, addedBy: alexId, name: "Faucet washer kit", quantity: "1", category: "Plumbing", checked: false, sortOrder: 0 },
      { listId: homeDepotList.id, addedBy: alexId, name: "WD-40", quantity: "1 can", category: "Tools", checked: false, sortOrder: 1 },
      { listId: homeDepotList.id, addedBy: samId, name: "Light bulbs", quantity: "4-pack LED", category: "Electrical", checked: false, sortOrder: 2 },
      { listId: homeDepotList.id, addedBy: alexId, name: "Painter's tape", quantity: "2 rolls", category: "Paint", checked: false, sortOrder: 3 },
    ]);
  }

  // ── 8. Contacts ───────────────────────────────────────────────────────────────

  console.log("Creating contacts...");

  const [margaret] = await db.insert(contacts).values({
    householdId: household.id,
    createdBy: alexId,
    firstName: "Margaret",
    lastName: "Moon",
    relationshipType: "grandparent",
    phone: "(555) 123-4567",
    birthday: dateString(5),
  }).returning();

  const [drChen] = await db.insert(contacts).values({
    householdId: household.id,
    createdBy: alexId,
    firstName: "Dr. Sarah",
    lastName: "Chen",
    relationshipType: "doctor",
    phone: "(555) 234-5678",
  }).returning();

  await db.insert(contacts).values([
    {
      householdId: household.id,
      createdBy: alexId,
      firstName: "Mike",
      lastName: "Johnson",
      relationshipType: "neighbor",
      phone: "(555) 345-6789",
      birthday: dateString(12),
    },
    {
      householdId: household.id,
      createdBy: alexId,
      firstName: "Coach",
      lastName: "Williams",
      relationshipType: "coach",
      phone: "(555) 456-7890",
    },
    {
      householdId: household.id,
      createdBy: alexId,
      firstName: "Lisa",
      lastName: "Park",
      relationshipType: "friend",
      phone: "(555) 567-8901",
      birthday: dateString(180),
    },
  ]);

  if (margaret) {
    await db.insert(contactNotes).values([
      {
        contactId: margaret.id,
        userId: alexId,
        content: "Called to wish happy holidays",
        noteDate: daysFromNow(-30),
      },
      {
        contactId: margaret.id,
        userId: alexId,
        content: "Sent flowers for her birthday",
        noteDate: daysFromNow(-365),
      },
    ]);
  }

  if (drChen) {
    await db.insert(contactNotes).values({
      contactId: drChen.id,
      userId: alexId,
      content: "Annual checkup scheduled for March",
      noteDate: daysFromNow(-14),
    });
  }

  console.log("✅ Seed complete!");
  console.log("   Admin: demo@orbyt.app / password123");
  console.log("   Member: member@orbyt.app / password123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
