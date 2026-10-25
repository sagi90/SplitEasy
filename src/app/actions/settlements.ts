"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { settlementSchema } from "@/lib/validation";
import { parseAmountToMinor } from "@/lib/money";

export interface SettlementResult {
  ok: boolean;
  error?: string;
}

export async function recordSettlementAction(input: {
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: string;
  currency: string;
  note?: string;
}): Promise<SettlementResult> {
  const parsed = settlementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  }
  const amountMinor = parseAmountToMinor(parsed.data.amount);
  if (amountMinor === null) return { ok: false, error: "סכום לא תקין" };

  const supabase = createClient();
  const { error } = await supabase.rpc("record_settlement", {
    p_group_id: parsed.data.groupId,
    p_from_member_id: parsed.data.fromMemberId,
    p_to_member_id: parsed.data.toMemberId,
    p_amount_minor: amountMinor,
    p_currency: parsed.data.currency,
    p_note: parsed.data.note ?? null,
  });
  if (error) return { ok: false, error: "error.generic" };
  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath(`/groups/${parsed.data.groupId}/settle`);
  return { ok: true };
}
