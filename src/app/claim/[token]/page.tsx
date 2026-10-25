import { UserCheck } from "lucide-react";
import { ClaimForm } from "@/components/claim-form";
import { LanguageToggle } from "@/components/language-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/tokens";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  params,
}: {
  params: { token: string };
}) {
  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);

  const supabase = createClient();
  const { data } = await supabase.rpc("peek_claim", {
    p_token_hash: hashToken(params.token),
  });
  const info = data?.[0];
  const valid = info?.valid ?? false;

  return (
    <main className="min-h-dvh">
      <div className="container flex h-14 max-w-md items-center justify-end">
        <LanguageToggle />
      </div>
      <div className="container flex max-w-md flex-col items-center gap-6 pt-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <UserCheck className="h-7 w-7" />
        </span>
        {valid ? (
          <>
            <div>
              <p className="text-sm text-muted-foreground">{t("claim.title")}</p>
              <h1 className="text-2xl font-bold">{info?.group_name}</h1>
              <p className="mt-1 text-muted-foreground">
                {info?.member_name}
              </p>
            </div>
            <Card className="w-full">
              <CardContent className="pt-6">
                <ClaimForm
                  token={params.token}
                  memberName={info?.member_name ?? ""}
                />
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="w-full">
            <CardContent className="py-10 text-center text-muted-foreground">
              {t("claim.expired")}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
