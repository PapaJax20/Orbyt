import type { EventCategory } from "../types/calendar";
import type { BillCategory } from "../types/finances";
import type { RelationshipType } from "../types/contacts";

export const EVENT_CATEGORIES: { value: EventCategory; label: string; icon: string }[] = [
  { value: "school", label: "School", icon: "🏫" },
  { value: "medical", label: "Medical", icon: "🏥" },
  { value: "work", label: "Work", icon: "💼" },
  { value: "sports", label: "Sports", icon: "⚽" },
  { value: "social", label: "Social", icon: "🎉" },
  { value: "family", label: "Family", icon: "👨‍👩‍👧‍👦" },
  { value: "holiday", label: "Holiday", icon: "🌴" },
  { value: "birthday", label: "Birthday", icon: "🎂" },
  { value: "other", label: "Other", icon: "📌" },
];

export const BILL_CATEGORIES: { value: BillCategory; label: string; icon: string }[] = [
  { value: "housing", label: "Housing", icon: "🏠" },
  { value: "utilities", label: "Utilities", icon: "⚡" },
  { value: "insurance", label: "Insurance", icon: "🛡️" },
  { value: "transportation", label: "Transportation", icon: "🚗" },
  { value: "subscriptions", label: "Subscriptions", icon: "📱" },
  { value: "food", label: "Food", icon: "🍽️" },
  { value: "healthcare", label: "Healthcare", icon: "💊" },
  { value: "other", label: "Other", icon: "📋" },
];

export const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: "spouse", label: "Spouse" },
  { value: "partner", label: "Partner" },
  { value: "child", label: "Child" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "extended_family", label: "Extended Family" },
  { value: "friend", label: "Friend" },
  { value: "doctor", label: "Doctor" },
  { value: "teacher", label: "Teacher" },
  { value: "neighbor", label: "Neighbor" },
  { value: "colleague", label: "Colleague" },
  { value: "service_provider", label: "Service Provider" },
  { value: "other", label: "Other" },
];

export const SHOPPING_ITEM_CATEGORIES = [
  "Produce",
  "Dairy",
  "Meat & Seafood",
  "Bakery",
  "Frozen",
  "Beverages",
  "Snacks",
  "Pantry",
  "Household",
  "Personal Care",
  "Baby",
  "Pet",
  "Other",
] as const;

export type ShoppingItemCategory = (typeof SHOPPING_ITEM_CATEGORIES)[number];
