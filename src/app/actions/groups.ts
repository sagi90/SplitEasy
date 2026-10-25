"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureSession } from "@/lib/auth";
import { createGroupSchema, renameGroupSchema } from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
  groupId?: string;
}

/** Create a group with the current (or a fresh anonymous) session as owner. */
export async function createGroupAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    displayName: formData.get("displayName") || undefined,
    defaultCurrency: (formData.get("defaultCurrency") as string) || "ILS",
    emoji: (formData.get("emoji") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  }

  // Guest-first: establish a session (anonymous if needed). If it fails, do not
  // create an orphaned group.
  const user = await ensureSession();
  if (!user) {
    return { ok: false, error: "error.session" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_group_with_owner", {
    p_name: parsed.data.name,
    p_display_name: parsed.data.displayName ?? "",
    p_currency: parsed.data.defaultCurrency,
    p_emoji: parsed.data.emoji ?? null,
  });

  if (error || !data || data.length === 0) {
    return { ok: false, error: error?.message ?? "error.generic" };
  }

  const groupId = data[0]!.group_id;
  revalidatePath("/groups");
  redirect(`/groups/${groupId}`);
}

export async function renameGroupAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = renameGroupSchema.safeParse({
    groupId: formData.get("groupId"),
    name: formData.get("name"),
    emoji: (formData.get("emoji") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid" };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("groups")
    .update({
      name: parsed.data.name,
      emoji: parsed.data.emoji ?? null,
      description: parsed.data.description ?? null,
    })
    .eq("id", parsed.data.groupId);

  if (error) return { ok: false, error: "error.notAllowed" };
  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { ok: true, groupId: parsed.data.groupId };
}

export async function archiveGroupAction(groupId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("groups")
    .update({ is_archived: true })
    .eq("id", groupId);
  if (error) return { ok: false, error: "error.notAllowed" };
  revalidatePath("/groups");
  return { ok: true };
}
