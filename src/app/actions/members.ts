"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureSession, getCurrentUser } from "@/lib/auth";
import { generateToken, hashToken } from "@/lib/tokens";
import { getSiteUrl } from "@/lib/utils";
import {
  addPlaceholderSchema,
  createClaimSchema,
  consumeClaimSchema,
} from "@/lib/validation";

export interface MemberResult {
  ok: boolean;
  error?: string;
  claimUrl?: string;
  groupId?: string;
}

/** Owner adds a non-login placeholder member. */
export async function addPlaceholderAction(input: {
  groupId: string;
  displayName: string;
}): Promise<MemberResult> {
  const parsed = addPlaceholderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "error.session" };

  const supabase = createClient();
  // Placeholder = member row with user_id NULL. The group_members INSERT policy
  // only allows the group owner to insert placeholder rows.
  const { error } = await supabase.from("group_members").insert({
    group_id: parsed.data.groupId,
    user_id: null,
    display_name: parsed.data.displayName,
    role: "member",
    status: "active",
  });
  if (error) return { ok: false, error: "error.notAllowed" };
  revalidatePath(`/groups/${parsed.data.groupId}/members`);
  return { ok: true };
}

/** Owner issues a single-use claim link for a placeholder member. */
export async function createClaimAction(input: {
  groupId: string;
  memberId: string;
  expiresInHours?: number;
}): Promise<MemberResult> {
  const parsed = createClaimSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "error.session" };

  const rawToken = generateToken();
  const supabase = createClient();
  const { error } = await supabase.from("placeholder_claims").insert({
    group_id: parsed.data.groupId,
    member_id: parsed.data.memberId,
    token_hash: hashToken(rawToken),
    created_by_user_id: user.id,
    expires_at: new Date(
      Date.now() + parsed.data.expiresInHours * 3600_000,
    ).toISOString(),
  });
  if (error) return { ok: false, error: "error.notAllowed" };
  revalidatePath(`/groups/${parsed.data.groupId}/members`);
  return { ok: true, claimUrl: `${getSiteUrl()}/claim/${rawToken}` };
}

/** Invitee consumes a placeholder claim, linking their identity to the member. */
export async function consumeClaimAction(
  _prev: MemberResult | null,
  formData: FormData,
): Promise<MemberResult> {
  const parsed = consumeClaimSchema.safeParse({
    token: formData.get("token"),
    displayName: (formData.get("displayName") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  }
  const user = await ensureSession();
  if (!user) return { ok: false, error: "error.session" };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("consume_placeholder_claim", {
    p_token_hash: hashToken(parsed.data.token),
  });
  if (error || !data || data.length === 0) {
    return { ok: false, error: mapClaimError(error?.message) };
  }
  revalidatePath("/groups");
  return { ok: true, groupId: data[0]!.group_id ?? undefined };
}

export async function removeMemberAction(
  memberId: string,
  groupId: string,
): Promise<MemberResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_member", { p_member_id: memberId });
  if (error) return { ok: false, error: "error.notAllowed" };
  revalidatePath(`/groups/${groupId}/members`);
  return { ok: true };
}

export async function resolveJoinRequestAction(
  requestId: string,
  approve: boolean,
  groupId: string,
): Promise<MemberResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("resolve_join_request", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) return { ok: false, error: "error.notAllowed" };
  revalidatePath(`/groups/${groupId}/members`);
  return { ok: true };
}

function mapClaimError(message?: string): string {
  switch (message) {
    case "claim_not_found":
    case "claim_consumed":
    case "claim_expired":
      return "claim.expired";
    case "already_member":
      return "error.generic";
    default:
      return "error.generic";
  }
}
