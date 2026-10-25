import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/queries";
import { CURRENCY_META, type Currency } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);
  const user = await getCurrentUser();
  const groups = user ? await getMyGroups() : [];

  return (
    <main className="min-h-dvh pb-24">
      <AppHeader />
      <div className="container max-w-2xl space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("groups.title")}</h1>
          <Link href="/groups/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t("groups.new")}
            </Button>
          </Link>
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Users className="h-7 w-7" />
              </span>
              <p className="text-muted-foreground">{t("groups.empty")}</p>
              <Link href="/groups/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  {t("groups.new")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.id}>
                <Link href={`/groups/${g.id}`}>
                  <Card className="transition-colors hover:border-primary">
                    <CardContent className="flex items-center gap-3 py-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-xl">
                        {g.emoji ?? "💸"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{g.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {CURRENCY_META[g.default_currency as Currency]?.symbol}{" "}
                          {g.default_currency}
                          {g.role === "owner" ? ` · ${t("member.owner")}` : ""}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
