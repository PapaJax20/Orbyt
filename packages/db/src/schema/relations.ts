/**
 * Drizzle ORM relation definitions.
 * Required for db.query.xxx.findMany({ with: { ... } }) to work correctly.
 * All relations must be defined here and included in the schema passed to drizzle().
 */
import { relations } from "drizzle-orm";
import { profiles, households, householdMembers, invitations } from "./households";
import { events, eventAttendees } from "./events";
import { tasks, taskAssignees, taskComments } from "./tasks";
import { bills, billPayments } from "./finances";
import { shoppingLists, shoppingItems } from "./shopping";
import { contacts, contactRelationships, contactNotes } from "./contacts";
import { notifications, pushTokens } from "./notifications";
import { aiConversations, aiMessages } from "./ai";

// --- Profiles ---
export const profilesRelations = relations(profiles, ({ many }) => ({
  householdMembers: many(householdMembers),
  taskAssignees: many(taskAssignees),
  taskComments: many(taskComments),
  contactNotes: many(contactNotes),
  notifications: many(notifications),
  pushTokens: many(pushTokens),
  aiConversations: many(aiConversations),
}));

// --- Households ---
export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  invitations: many(invitations),
  events: many(events),
  tasks: many(tasks),
  bills: many(bills),
  shoppingLists: many(shoppingLists),
  contacts: many(contacts),
  aiConversations: many(aiConversations),
}));

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
  profile: one(profiles, {
    fields: [householdMembers.userId],
    references: [profiles.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  household: one(households, {
    fields: [invitations.householdId],
    references: [households.id],
  }),
}));

// --- Events ---
export const eventsRelations = relations(events, ({ one, many }) => ({
  household: one(households, {
    fields: [events.householdId],
    references: [households.id],
  }),
  creator: one(profiles, {
    fields: [events.createdBy],
    references: [profiles.id],
  }),
  attendees: many(eventAttendees),
}));

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendees.eventId],
    references: [events.id],
  }),
  profile: one(profiles, {
    fields: [eventAttendees.userId],
    references: [profiles.id],
  }),
}));

// --- Tasks ---
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  household: one(households, {
    fields: [tasks.householdId],
    references: [households.id],
  }),
  creator: one(profiles, {
    fields: [tasks.createdBy],
    references: [profiles.id],
  }),
  parent: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "subtasks",
  }),
  subtasks: many(tasks, { relationName: "subtasks" }),
  assignees: many(taskAssignees),
  comments: many(taskComments),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignees.taskId],
    references: [tasks.id],
  }),
  profile: one(profiles, {
    fields: [taskAssignees.userId],
    references: [profiles.id],
  }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  profile: one(profiles, {
    fields: [taskComments.userId],
    references: [profiles.id],
  }),
}));

// --- Finances ---
export const billsRelations = relations(bills, ({ one, many }) => ({
  household: one(households, {
    fields: [bills.householdId],
    references: [households.id],
  }),
  payments: many(billPayments),
}));

export const billPaymentsRelations = relations(billPayments, ({ one }) => ({
  bill: one(bills, {
    fields: [billPayments.billId],
    references: [bills.id],
  }),
  paidByProfile: one(profiles, {
    fields: [billPayments.paidBy],
    references: [profiles.id],
  }),
}));

// --- Shopping ---
export const shoppingListsRelations = relations(shoppingLists, ({ one, many }) => ({
  household: one(households, {
    fields: [shoppingLists.householdId],
    references: [households.id],
  }),
  creator: one(profiles, {
    fields: [shoppingLists.createdBy],
    references: [profiles.id],
  }),
  items: many(shoppingItems),
}));

export const shoppingItemsRelations = relations(shoppingItems, ({ one }) => ({
  list: one(shoppingLists, {
    fields: [shoppingItems.listId],
    references: [shoppingLists.id],
  }),
  addedByProfile: one(profiles, {
    fields: [shoppingItems.addedBy],
    references: [profiles.id],
  }),
  checkedByProfile: one(profiles, {
    fields: [shoppingItems.checkedBy],
    references: [profiles.id],
  }),
}));

// --- Contacts ---
export const contactsRelations = relations(contacts, ({ one, many }) => ({
  household: one(households, {
    fields: [contacts.householdId],
    references: [households.id],
  }),
  notes: many(contactNotes),
  relationshipsFrom: many(contactRelationships, { relationName: "fromContact" }),
  relationshipsTo: many(contactRelationships, { relationName: "toContact" }),
}));

export const contactRelationshipsRelations = relations(contactRelationships, ({ one }) => ({
  fromContact: one(contacts, {
    fields: [contactRelationships.fromContactId],
    references: [contacts.id],
    relationName: "fromContact",
  }),
  toContact: one(contacts, {
    fields: [contactRelationships.toContactId],
    references: [contacts.id],
    relationName: "toContact",
  }),
}));

export const contactNotesRelations = relations(contactNotes, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactNotes.contactId],
    references: [contacts.id],
  }),
  profile: one(profiles, {
    fields: [contactNotes.userId],
    references: [profiles.id],
  }),
}));

// --- Notifications ---
export const notificationsRelations = relations(notifications, ({ one }) => ({
  profile: one(profiles, {
    fields: [notifications.userId],
    references: [profiles.id],
  }),
}));

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  profile: one(profiles, {
    fields: [pushTokens.userId],
    references: [profiles.id],
  }),
}));

// --- AI (Phase 2) ---
export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
  household: one(households, {
    fields: [aiConversations.householdId],
    references: [households.id],
  }),
  profile: one(profiles, {
    fields: [aiConversations.userId],
    references: [profiles.id],
  }),
  messages: many(aiMessages),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
}));
