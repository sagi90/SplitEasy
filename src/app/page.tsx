import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { CreateGroupForm } from "@/components/create-group-form";
import { LanguageToggle } from "@/components/language-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/queries";

export default async function WelcomePage() {
  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);

  // If a returning user already has groups, take them to their home.
  const user = await getCurrentUser();
  if (user) {
    const groups = await getMyGroups();
    if (groups.length > 0) redirect("/groups");
  }

  return (
    <main className="min-h-dvh">
      <div className="container flex h-14 max-w-xl items-center justify-end">
        <LanguageToggle />
      </div>
      <div className="container flex max-w-xl flex-col items-center gap-8 pt-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Wallet className="h-8 w-8" />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("welcome.headline")}
          </h1>
          <p className="max-w-md text-muted-foreground">
            {t("welcome.subtitle")}
          </p>
        </div>

        <Card className="w-full text-start">
          <CardContent className="pt-6">
            <CreateGroupForm />
          </CardContent>
        </Card>

        <Link
          href="/groups"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("welcome.haveInvite")} ↩
        </Link>
      </div>
    </main>
  );
}
