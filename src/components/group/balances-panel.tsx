import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { CurrencyBalance, MemberView } from "@/lib/queries";
import { translate, type Locale } from "@/lib/i18n";

export function BalancesPanel({
  balances,
  members,
  locale,
}: {
  balances: CurrencyBalance[];
  members: MemberView[];
  locale: Locale;
}) {
  const t = (k: string) => translate(locale, k);
  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.display_name ?? "—";

  if (balances.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("group.balances")}
        </h2>
        {balances.map((b) => (
          <div key={b.currency} className="space-y-1.5">
            {balances.length > 1 && (
              <p className="text-xs font-medium text-muted-foreground">
                {b.currency}
              </p>
            )}
            <ul className="space-y-1">
              {b.nets
                .filter((n) => n.netMinor !== 0)
                .sort((a, b2) => b2.netMinor - a.netMinor)
                .map((n) => (
                  <li
                    key={n.memberId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">{nameOf(n.memberId)}</span>
                    <span
                      className={
                        n.netMinor > 0
                          ? "font-semibold text-success"
                          : "font-semibold text-destructive"
                      }
                    >
                      {n.netMinor > 0 ? "+" : ""}
                      {formatMoney(n.netMinor, b.currency)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t("currency.separate")}</p>
      </CardContent>
    </Card>
  );
}
