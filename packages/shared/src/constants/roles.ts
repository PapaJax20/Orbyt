import type { HouseholdRole } from "../types/household";

export const HOUSEHOLD_ROLES: { value: HouseholdRole; label: string; description: string }[] = [
  {
    value: "admin",
    label: "Admin",
    description: "Full access — can manage members, settings, and all content",
  },
  {
    value: "member",
    label: "Member",
    description: "Can create and edit all content, cannot manage household settings",
  },
  {
    value: "child",
    label: "Child",
    description: "View-only access to calendar and tasks",
  },
];
