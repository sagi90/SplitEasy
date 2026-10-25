import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { UpgradeForm } from "@/components/upgrade-form";
import { Card, CardContent } from "@/components/ui/card";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { getCurrentUser, isGuest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UpgradePage() {
  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);
  const user = await getCurrentUser();
  const guest = isGuest(user);

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="container max-w-md space-y-4 pt-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          {t("common.back")}
        </Link>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t("upgrade.title")}</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            {guest ? (
              <UpgradeForm />
            ) : (
              <p className="text-center text-muted-foreground">
                {user?.email ?? "✓"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
