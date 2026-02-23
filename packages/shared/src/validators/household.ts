import { z } from "zod";

export const CreateHouseholdSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  timezone: z.string().default("UTC"),
});

export const UpdateHouseholdSchema = CreateHouseholdSchema.partial();

export const InviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member", "child"]).default("member"),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().min(1).nullable().optional(),
  avatarType: z.enum(["photo", "illustrated"]).optional(),
  aiPersona: z.enum(["rosie", "eddie"]).optional(),
  theme: z
    .enum([
      "cosmic",
      "solar",
      "aurora",
      "aurora-light",
      "nebula",
      "titanium",
      "titanium-light",
      "ember",
      "ember-light",
    ])
    .optional(),
  timezone: z.string().optional(),
  weekStartDay: z.enum(["sunday", "monday"]).optional(),
  financeModules: z.object({
    goals: z.boolean().optional(),
    netWorth: z.boolean().optional(),
    debtPlanner: z.boolean().optional(),
    analytics: z.boolean().optional(),
  }).optional(),
  notificationPreferences: z.object({
    billDue: z.boolean().optional(),
    taskAssigned: z.boolean().optional(),
    taskCompleted: z.boolean().optional(),
    eventReminder: z.boolean().optional(),
    birthdayReminder: z.boolean().optional(),
    memberJoined: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
  }).optional(),
});

export const UpdateMemberColorSchema = z.object({
  userId: z.string().uuid(),
  displayColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
});

export type CreateHouseholdInput = z.infer<typeof CreateHouseholdSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
