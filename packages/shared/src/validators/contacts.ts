import { z } from "zod";

const RelationshipTypeSchema = z.enum([
  "spouse",
  "partner",
  "child",
  "parent",
  "sibling",
  "extended_family",
  "friend",
  "doctor",
  "teacher",
  "neighbor",
  "colleague",
  "service_provider",
  "other",
]);

const AddressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
});

const SocialLinksSchema = z.object({
  instagram: z.string().url().optional(),
  facebook: z.string().url().optional(),
  linkedin: z.string().url().optional(),
  twitter: z.string().url().optional(),
  website: z.string().url().optional(),
});

export const CreateContactSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().max(100).nullable().optional(),
  relationshipType: RelationshipTypeSchema,
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: AddressSchema.default({}),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .nullable()
    .optional(),
  anniversary: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().max(10000).nullable().optional(),
  tags: z.array(z.string().max(50)).default([]),
  socialLinks: SocialLinksSchema.default({}),
  linkedUserId: z.string().uuid().nullable().optional(),
});

export const UpdateContactSchema = CreateContactSchema.partial();

export const AddContactNoteSchema = z.object({
  contactId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  noteDate: z.string().datetime().optional(),
});

export const LinkRelationshipSchema = z.object({
  fromContactId: z.string().uuid(),
  toContactId: z.string().uuid(),
  label: z.string().max(100).optional(),
});

export type CreateContactInput = z.infer<typeof CreateContactSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;
