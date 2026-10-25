"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { editExpenseSchema, expenseSchema } from "@/lib/validation";
import { parseAmountToMinor } from "@/lib/money";
import { computeSplit, type SplitMode } from "@/lib/splits";

export interface ExpenseResult {
  ok: boolean;
  error?: string;
  expenseId?: string;
}

interface ExpensePayload {
  groupId: string;
  description: string;
  amount: string;
  currency: string;
  expenseDate: string;
  category?: string;
  payerMemberId: string;
  splitMode: SplitMode;
  participants: { memberId: string; value?: number }[];
  expenseId?: string;
  version?: number;
}

async function persistExpense(payload: ExpensePayload): Promise<ExpenseResult> {
  const amountMinor = parseAmountToMinor(payload.amount);
  if (amountMinor === null) {
    return { ok: false, error: "סכום לא תקין" };
  }

  // Compute split shares server-side (never trust client-provided shares).
  let shares;
  try {
    shares = computeSplit({
      totalMinor: amountMinor,
      mode: payload.splitMode,
      members: payload.participants.map((p) => ({
        memberId: p.memberId,
        value:
          payload.splitMode === "exact"
            ? // exact values arrive as minor units already from the client form
              p.value
            : p.value,
      })),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const payers = [{ member_id: payload.payerMemberId, amount_minor: amountMinor }];
  const splits = shares.map((s) => {
    const participant = payload.participants.find((p) => p.memberId === s.memberId);
    return {
      member_id: s.memberId,
      amount_minor: s.amountMinor,
      split_mode: payload.splitMode,
      weight_decimal:
        payload.splitMode === "weight" ? (participant?.value ?? null) : null,
    };
  });

  const supabase = createClient();
  const { data, error } = await supabase.rpc("save_expense", {
    p_expense_id: payload.expenseId ?? null,
    p_group_id: payload.groupId,
    p_description: payload.description,
    p_amount_minor: amountMinor,
    p_currency: payload.currency,
    p_expense_date: payload.expenseDate,
    p_category: payload.category ?? null,
    p_payers: payers as never,
    p_splits: splits as never,
    p_expected_version: payload.version ?? null,
  });

  if (error || !data || data.length === 0) {
    return { ok: false, error: mapExpenseError(error?.message) };
  }
  revalidatePath(`/groups/${payload.groupId}`);
  return { ok: true, expenseId: data[0]!.expense_id };
}

export async function createExpenseAction(
  input: ExpensePayload,
): Promise<ExpenseResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  }
  return persistExpense(input);
}

export async function editExpenseAction(
  input: ExpensePayload & { expenseId: string; version: number },
): Promise<ExpenseResult> {
  const parsed = editExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  }
  return persistExpense(input);
}

export async function deleteExpenseAction(
  expenseId: string,
  groupId: string,
): Promise<ExpenseResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("soft_delete_expense", {
    p_expense_id: expenseId,
  });
  if (error) return { ok: false, error: mapExpenseError(error.message) };
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

function mapExpenseError(message?: string): string {
  switch (message) {
    case "not_group_member":
    case "not_allowed":
      return "error.notAllowed";
    case "version_conflict":
      return "ההוצאה עודכנה במקביל. רעננו ונסו שוב.";
    case "payer_sum_mismatch":
    case "split_sum_mismatch":
      return "סכום החלוקה אינו תואם לסכום ההוצאה.";
    default:
      return "error.generic";
  }
}
