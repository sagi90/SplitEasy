import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getGroupDetail } from "@/lib/queries";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { formatMoney, type Currency } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({
  params,
}: {
  params: { groupId: string; expenseId: string };
}) {
  const detail = await getGroupDetail(params.groupId);
  if (!detail) notFound();
  const expense = detail.expenses.find((e) => e.id === params.expenseId);
  if (!expense) notFound();

  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);
  const nameOf = (id: string) =>
    detail.members.find((m) => m.id === id)?.display_name ?? "—";

  // Audit history for this expense.
  const supabase = createClient();
  const { data: audit } = await supabase
    .from("audit_events")
    .select("action, created_at")
    .eq("group_id", params.groupId)
    .eq("entity_id", params.expenseId)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-dvh pb-10">
      <AppHeader />
      <div className="container max-w-2xl space-y-4 pt-4">
        <Link
          href={`/groups/${params.groupId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          {t("common.back")}
        </Link>

        <Card>
          <CardContent className="space-y-1 pt-4">
            <h1 className="text-xl font-bold">{expense.description}</h1>
            <p className="text-2xl font-extrabold">
              {formatMoney(expense.amount_minor, expense.currency as Currency)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("expense.paidBy")} {nameOf(expense.payers[0]?.member_id ?? "")} ·{" "}
              {expense.expense_date}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("expense.participants")}
            </h2>
            <ul className="space-y-1 text-sm">
              {expense.splits.map((s) => (
                <li key={s.member_id} className="flex justify-between">
                  <span>{nameOf(s.member_id)}</span>
                  <span className="font-medium">
                    {formatMoney(s.amount_minor, expense.currency as Currency)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {audit && audit.length > 0 && (
          <Card>
            <CardContent className="space-y-1 pt-4 text-xs text-muted-foreground">
              <h2 className="text-sm font-semibold">{t("nav.activity")}</h2>
              {audit.map((a, i) => (
                <p key={i}>
                  {a.action} · {new Date(a.created_at).toLocaleString(locale)}
                </p>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
