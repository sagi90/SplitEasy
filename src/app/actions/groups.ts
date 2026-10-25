"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureSession, getCurrentUser } from "@/lib/auth";
import { generateToken, hashToken } from "@/lib/tokens";
import { getSiteUrl } from "@/lib/utils";
import {
  acceptInviteSchema,
  createInviteSchema,
} from "@/lib/validation";

export interface InviteResult {
  ok: boolean;
  error?: string;
  inviteUrl?: string;
}

/** Owner creates a new invite. Returns the raw URL once; only the hash is stored. */
export async function createInviteAction(input: {
  groupId: string;
  maxUses?: number | null;
  expiresInHours?: number;
  requiresApproval?: boolean;
}): Promise<InviteResult> {
  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "error.session" };

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + parsed.data.expiresInHours * 3600_000,
  ).toISOString();

  const supabase = createClient();
  const { error } = await supabase.from("group_invites").insert({
    group_id: parsed.data.groupId,
    token_hash: tokenHash,
    created_by_user_id: user.id,
    expires_at: expiresAt,
    max_uses: parsed.data.maxUses ?? null,
    requires_approval: parsed.data.requiresApproval,
  });
  if (error) {
  console.error("[SplitEasy] Create invite failed:", {
    code: error.code,
    message: error.message,
    details: error.details,
  });

  return { ok: false, error: "error.notAllowed" };
}

  revalidatePath(`/groups/${parsed.data.groupId}/members`);
  return { ok: true, inviteUrl: `${getSiteUrl()}/invite/${rawToken}` };
}

export async function revokeInviteAction(
  inviteId: string,
  groupId: string,
): Promise<InviteResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("group_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) return { ok: false, error: "error.notAllowed" };
  revalidatePath(`/groups/${groupId}/members`);
  return { ok: true };
}

export interface AcceptResult {
  ok: boolean;
  error?: string;
  groupId?: string;
  status?: "joined" | "already_member" | "pending";
}

/** Invitee accepts an invite. Establishes a session (anonymous if needed). */
export async function acceptInviteAction(
  _prev: AcceptResult | null,
  formData: FormData,
): Promise<AcceptResult> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  }

  const user = await ensureSession();
  if (!user) return { ok: false, error: "error.session" };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_invite", {
    p_token_hash: hashToken(parsed.data.token),
    p_display_name: parsed.data.displayName,
  });

  if (error || !data || data.length === 0) {
    return { ok: false, error: mapInviteError(error?.message) };
  }
  const row = data[0]!;
  revalidatePath("/groups");
  return {
    ok: true,
    groupId: row.group_id ?? undefined,
    status: row.status as AcceptResult["status"],
  };
}

function mapInviteError(message?: string): string {
  switch (message) {
    case "invite_not_found":
    case "invite_revoked":
    case "invite_expired":
    case "invite_exhausted":
      return "invite.expired";
    case "invalid_display_name":
      return "נא להזין שם";
    default:
      return "error.generic";
  }
}
