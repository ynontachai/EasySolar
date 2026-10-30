import { z } from "zod";

export const inviteAdminRoles = ["account_admin", "reviewer"] as const;

export const inviteAdminSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || null),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("กรุณาระบุอีเมลให้ถูกต้อง")
    .max(254),
  organizationId: z.string().uuid("กรุณาเลือก Organization"),
  role: z.enum(inviteAdminRoles, { message: "กรุณาเลือก Role" }),
});

export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;
