"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE } from "@/lib/locale";
import { LOCALES, type Locale } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/utils";
import { upgradeAccountSchema } from "@/lib/validation";

export async function setLocaleAction(locale: Locale): Promise<void> {
  if (!LOCALES.includes(locale)) return;
  cookies().set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  // Persist to profile when signed in (best effort).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.rpc("upsert_profile", {
      p_display_name: "",
      p_locale: locale,
    });
  }
  revalidatePath("/", "layout");
}

export interface UpgradeResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Upgrade an anonymous identity to a permanent account using Supabase's
 * supported identity-linking flow. Memberships remain intact because the
 * underlying auth user id does not change.
 */
export async function upgradeWithEmailAction(input: {
  email: string;
}): Promise<UpgradeResult> {
  const parsed = upgradeAccountSchema.safeParse({
    email: input.email,
    provider: "email",
  });
  if (!parsed.success || !parsed.data.email) {
    return { ok: false, error: "כתובת אימייל לא תקינה" };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "error.session" };

  // Link an email identity to the existing (anonymous) user. Supabase sends a
  // confirmation magic link; the auth user id is preserved on confirm.
  const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    message: "שלחנו קישור אימות לכתובת האימייל. יש לאשר כדי להשלים את השמירה.",
  };
}

/** Begin an OAuth (Google) identity link for the current user. Returns a URL. */
export async function upgradeWithGoogleAction(): Promise<
  UpgradeResult & { url?: string }
> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: `${getSiteUrl()}/auth/callback?next=/settings` },
  });
  if (error || !data?.url) {
    return { ok: false, error: error?.message ?? "error.generic" };
  }
  return { ok: true, url: data.url };
}
