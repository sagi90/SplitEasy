"use client";

import * as React from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";
import { formatMoney, formatMinor, type Currency } from "@/lib/money";
import { recordSettlementAction } from "@/app/actions/settlements";
import type { CurrencyBalance, MemberView } from "@/lib/queries";
import { useRouter } from "next/navigation";

interface Props {
  groupId: string;
  balances: CurrencyBalance[];
  members: MemberView[];
}

export function SettleView({ groupId, balances, members }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.display_name ?? "—";

  const [active, setActive] = React.useState<{
    from: string;
    to: string;
    amount: number;
    currency: Currency;
  } | null>(null);
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const hasTransfers = balances.some((b) => b.transfers.length > 0);

  async function confirmPayment() {
    if (!active) return;
    setPending(true);
    const res = await recordSettlementAction({
      groupId,
      fromMemberId: active.from,
      toMemberId: active.to,
      amount: formatMinor(active.amount),
      currency: active.currency,
      note: note || undefined,
    });
    setPending(false);
    if (res.ok) {
      toast(t("settle.markPaid"), "success");
      setActive(null);
      setNote("");
      router.refresh();
    } else {
      toast(t(res.error ?? "error.generic"), "error");
    }
  }

  return (
    <div className="space-y-4">
      {!hasTransfers ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("group.allSettled")}
          </CardContent>
        </Card>
      ) : (
        balances
          .filter((b) => b.transfers.length > 0)
          .map((b) => (
            <div key={b.currency} className="space-y-2">
              <h2 className="px-1 text-sm font-semibold text-muted-foreground">
                {t("settle.suggested")} · {b.currency}
              </h2>
              <ul className="space-y-2">
                {b.transfers.map((tr, i) => (
                  <li key={i}>
                    <Card>
                      <CardContent className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1 text-sm">
                          <span className="font-medium">
                            {nameOf(tr.fromMemberId)}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {t("settle.owes")}
                          </span>{" "}
                          <span className="font-medium">
                            {nameOf(tr.toMemberId)}
                          </span>
                        </div>
                        <span className="shrink-0 font-semibold">
                          {formatMoney(tr.amountMinor, b.currency)}
                        </span>
                        <Button
                          size="sm"
                          onClick={() =>
                            setActive({
                              from: tr.fromMemberId,
                              to: tr.toMemberId,
                              amount: tr.amountMinor,
                              currency: b.currency,
                            })
                          }
                        >
                          <Check className="h-4 w-4" />
                          {t("settle.markPaid")}
                        </Button>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}

      <p className="px-1 text-xs text-muted-foreground">
        {t("settle.disclaimer")}
      </p>

      <Sheet
        open={!!active}
        onClose={() => setActive(null)}
        title={t("settle.record")}
      >
        {active && (
          <div className="space-y-4">
            <p className="text-center">
              <span className="font-semibold">{nameOf(active.from)}</span>{" "}
              → <span className="font-semibold">{nameOf(active.to)}</span>
              <br />
              <span className="text-2xl font-bold">
                {formatMoney(active.amount, active.currency)}
              </span>
            </p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              placeholder={t("settle.note")}
            />
            <p className="text-sm text-muted-foreground">{t("settle.confirm")}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setActive(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={confirmPayment}
                disabled={pending}
              >
                {pending ? "…" : t("common.confirm")}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
