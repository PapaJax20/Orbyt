export type RelationshipType =
  | "spouse"
  | "partner"
  | "child"
  | "parent"
  | "sibling"
  | "extended_family"
  | "friend"
  | "doctor"
  | "teacher"
  | "neighbor"
  | "colleague"
  | "service_provider"
  | "other";

export interface ContactAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface ContactSocialLinks {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  twitter?: string;
  website?: string;
}

export interface Contact {
  id: string;
  householdId: string;
  createdBy: string;
  firstName: string;
  lastName: string | null;
  relationshipType: RelationshipType;
  email: string | null;
  phone: string | null;
  address: ContactAddress;
  birthday: string | null; // ISO date string "YYYY-MM-DD"
  anniversary: string | null;
  avatarUrl: string | null;
  socialLinks: ContactSocialLinks;
  notes: string | null;
  tags: string[];
  linkedUserId: string | null; // if contact is also a household member
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactRelationship {
  id: string;
  householdId: string;
  fromContactId: string;
  toContactId: string;
  relationshipLabel: string | null;
  createdAt: Date;
}

export interface ContactNote {
  id: string;
  contactId: string;
  userId: string;
  content: string;
  noteDate: Date;
  createdAt: Date;
  profile: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface ContactWithRelations extends Omit<Contact, "notes"> {
  relationships: ContactRelationship[];
  notes: ContactNote[];
  upcomingBirthday: Date | null;
  daysUntilBirthday: number | null;
}
