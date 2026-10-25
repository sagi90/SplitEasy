import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);
  const supabase = createClient();
  const { data } = await supabase
    .from("audit_events")
    .select("id, action, entity_type, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="container max-w-2xl space-y-4 pt-6">
        <h1 className="text-2xl font-bold">{t("nav.activity")}</h1>
        <Card>
          <CardContent className="space-y-2 pt-4 text-sm">
            {!data || data.length === 0 ? (
              <p className="text-muted-foreground">{t("group.noExpenses")}</p>
            ) : (
              data.map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between border-b border-border py-2 last:border-0"
                >
                  <span>
                    {a.entity_type} · {a.action}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(a.created_at).toLocaleString(locale)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
