import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "./money";

const displayName = z
  .string()
  .trim()
  .min(1, "נא להזין שם")
  .max(60, "השם ארוך מדי");

const groupName = z
  .string()
  .trim()
  .min(1, "נא להזין שם קבוצה")
  .max(80, "שם הקבוצה ארוך מדי");

const currency = z.enum(SUPPORTED_CURRENCIES);

const emoji = z.string().trim().max(8).optional();

export const createGroupSchema = z.object({
  name: groupName,
  displayName: displayName.optional(),
  defaultCurrency: currency.default("ILS"),
  emoji,
});

export const renameGroupSchema = z.object({
  groupId: z.string().uuid(),
  name: groupName,
  emoji,
  description: z.string().trim().max(280).optional(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10).max(200),
  displayName,
});

export const createInviteSchema = z.object({
  groupId: z.string().uuid(),
  maxUses: z.number().int().positive().max(1000).nullable().optional(),
  expiresInHours: z.number().int().positive().max(24 * 90).default(24 * 14),
  requiresApproval: z.boolean().default(false),
});

export const addPlaceholderSchema = z.object({
  groupId: z.string().uuid(),
  displayName,
});

export const createClaimSchema = z.object({
  groupId: z.string().uuid(),
  memberId: z.string().uuid(),
  expiresInHours: z.number().int().positive().max(24 * 14).default(48),
});

export const consumeClaimSchema = z.object({
  token: z.string().min(10).max(200),
  displayName: displayName.optional(),
});

const splitModeEnum = z.enum(["equal", "exact", "percentage", "weight"]);

export const splitMemberSchema = z.object({
  memberId: z.string().uuid(),
  value: z.number().nonnegative().optional(),
});

export const expenseSchema = z.object({
  groupId: z.string().uuid(),
  description: z.string().trim().min(1, "נא להזין תיאור").max(140),
  amount: z.string().min(1).max(20), // raw decimal string, parsed server-side
  currency,
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().trim().max(40).optional(),
  payerMemberId: z.string().uuid(),
  splitMode: splitModeEnum,
  participants: z.array(splitMemberSchema).min(1, "נא לבחור משתתפים"),
});

export const editExpenseSchema = expenseSchema.extend({
  expenseId: z.string().uuid(),
  version: z.number().int().nonnegative(),
});

export const settlementSchema = z
  .object({
    groupId: z.string().uuid(),
    fromMemberId: z.string().uuid(),
    toMemberId: z.string().uuid(),
    amount: z.string().min(1).max(20),
    currency,
    note: z.string().trim().max(140).optional(),
  })
  .refine((v) => v.fromMemberId !== v.toMemberId, {
    message: "לא ניתן להסדיר תשלום לאותו משתתף",
    path: ["toMemberId"],
  });

export const upgradeAccountSchema = z.object({
  email: z.string().email().optional(),
  provider: z.enum(["email", "google"]).default("email"),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type SettlementInput = z.infer<typeof settlementSchema>;
