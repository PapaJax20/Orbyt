export type HouseholdRole = "admin" | "member" | "child";

export type AiPersona = "rosie" | "eddie";

export type OrbytTheme =
  | "cosmic"
  | "solar"
  | "aurora"
  | "aurora-light"
  | "nebula"
  | "titanium"
  | "titanium-light"
  | "ember"
  | "ember-light";

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  avatarType: "photo" | "illustrated";
  aiPersona: AiPersona;
  theme: OrbytTheme;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Household {
  id: string;
  name: string;
  slug: string | null;
  avatarUrl: string | null;
  timezone: string;
  settings: HouseholdSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdSettings {
  weekStartDay?: 0 | 1; // 0 = Sunday, 1 = Monday
  dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  currency?: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: HouseholdRole;
  displayColor: string; // hex color for calendar color-coding
  joinedAt: Date;
  profile: Pick<Profile, "id" | "displayName" | "avatarUrl" | "email">;
}

export interface Invitation {
  id: string;
  householdId: string;
  invitedEmail: string;
  invitedBy: string;
  token: string;
  role: HouseholdRole;
  status: "pending" | "accepted" | "expired";
  expiresAt: Date;
  createdAt: Date;
}
