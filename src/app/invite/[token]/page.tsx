import { Wallet } from "lucide-react";
import { AcceptInviteForm } from "@/components/accept-invite-form";
import { LanguageToggle } from "@/components/language-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { hashToken } from "@/lib/tokens";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);

  // Minimal, pre-session peek — reveals only group name after token validation.
  const supabase = createClient();
  const { data } = await supabase.rpc("peek_invite", {
    p_token_hash: hashToken(params.token),
  });
  const info = data?.[0];
  const valid = info?.valid ?? false;

  // Prefill name if the visitor already has a profile.
  const user = await getCurrentUser();
  let defaultName: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    defaultName = profile?.display_name ?? undefined;
  }

  return (
    <main className="min-h-dvh">
      <div className="container flex h-14 max-w-md items-center justify-end">
        <LanguageToggle />
      </div>
      <div className="container flex max-w-md flex-col items-center gap-6 pt-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Wallet className="h-7 w-7" />
        </span>

        {valid ? (
          <>
            <div>
              <p className="text-sm text-muted-foreground">{t("invite.join")}</p>
              <h1 className="text-2xl font-bold">
                {info?.group_emoji ? `${info.group_emoji} ` : ""}
                {info?.group_name}
              </h1>
            </div>
            <Card className="w-full text-start">
              <CardContent className="pt-6">
                <AcceptInviteForm token={params.token} defaultName={defaultName} />
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="w-full">
            <CardContent className="py-10 text-center text-muted-foreground">
              {t("invite.expired")}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
