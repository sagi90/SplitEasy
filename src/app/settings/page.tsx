import Link from "next/link";
import { ShieldCheck, ChevronLeft } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { getCurrentUser, isGuest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);
  const user = await getCurrentUser();
  const guest = isGuest(user);

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="container max-w-md space-y-4 pt-6">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("settings.account")}
            </h2>
            {guest ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("guest.warning")}
                </p>
                <Link
                  href="/account/upgrade"
                  className="flex items-center justify-between rounded-lg bg-accent p-3 font-medium text-accent-foreground"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    {t("upgrade.cta")}
                  </span>
                  <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="success">
                  <ShieldCheck className="me-1 h-3 w-3" />✓
                </Badge>
                <span className="text-sm">{user?.email}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("settings.language")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {locale === "he" ? "עברית (RTL)" : "English (LTR)"}
            </p>
          </CardContent>
        </Card>

        <Link
          href="/groups"
          className="block text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("nav.groups")}
        </Link>
      </div>
    </main>
  );
}
