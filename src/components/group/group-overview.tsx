"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Settings, ArrowLeftRight, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";
import { AddExpenseSheet } from "@/components/group/add-expense-sheet";
import { InviteButton } from "@/components/group/invite-button";
import { formatMoney, type Currency } from "@/lib/money";
import { deleteExpenseAction } from "@/app/actions/expenses";
import type {
  CurrencyBalance,
  ExpenseView,
  MemberView,
} from "@/lib/queries";

interface Props {
  groupId: string;
  groupName: string;
  groupEmoji: string | null;
  defaultCurrency: Currency;
  members: MemberView[];
  expenses: ExpenseView[];
  balances: CurrencyBalance[];
  currentMemberId: string | null;
  isOwner: boolean;
}

export function GroupOverview(props: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ExpenseView | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const nameOf = (id: string) =>
    props.members.find((m) => m.id === id)?.display_name ?? "—";

  function openAdd() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(exp: ExpenseView) {
    setEditing(exp);
    setSheetOpen(true);
  }

  async function handleDelete(exp: ExpenseView) {
    if (!confirm(t("common.delete") + "?")) return;
    setDeleting(exp.id);
    const res = await deleteExpenseAction(exp.id, props.groupId);
    setDeleting(null);
    if (res.ok) toast(t("expense.deleted"), "success");
    else toast(t(res.error ?? "error.generic"), "error");
  }

  return (
    <div className="space-y-4 pb-28">
      {/* Header card */}
      <Card>
        <CardContent className="flex items-center gap-3 pt-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-2xl">
            {props.groupEmoji ?? "💸"}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{props.groupName}</h1>
            <p className="text-sm text-muted-foreground">
              {props.members.filter((m) => m.status === "active").length}{" "}
              {t("group.members")}
            </p>
          </div>
          <Link href={`/groups/${props.groupId}/settings`} aria-label={t("group.settings")}>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <InviteButton groupId={props.groupId} />
        <Link href={`/groups/${props.groupId}/settle`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full">
            <ArrowLeftRight className="h-4 w-4" />
            {t("group.settleUp")}
          </Button>
        </Link>
      </div>

      {/* Balances */}
      {props.balances.length > 0 && (
        <Card>
          <CardContent className="space-y-4 pt-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("group.balances")}
            </h2>
            {props.balances.map((b) => (
              <div key={b.currency} className="space-y-1.5">
                {props.balances.length > 1 && (
                  <p className="text-xs font-medium text-muted-foreground">
                    {b.currency}
                  </p>
                )}
                <ul className="space-y-1">
                  {b.nets
                    .filter((n) => n.netMinor !== 0)
                    .sort((a, c) => c.netMinor - a.netMinor)
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
      )}

      {/* Expense timeline */}
      <div className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-muted-foreground">
          {t("group.expenses")}
        </h2>
        {props.expenses.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {t("group.noExpenses")}
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {props.expenses.map((e) => {
              const payer = nameOf(e.payers[0]?.member_id ?? "");
              const canModify = true;
              return (
                <li key={e.id}>
                  <Card>
                    <CardContent className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("expense.paidBy")} {payer} · {e.expense_date}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold">
                        {formatMoney(e.amount_minor, e.currency as Currency)}
                      </span>
                      {canModify && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => openEdit(e)}
                            aria-label={t("common.edit")}
                            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(e)}
                            disabled={deleting === e.id}
                            aria-label={t("common.delete")}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Floating Add Expense */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 p-3 backdrop-blur safe-bottom">
        <div className="container max-w-2xl">
          <Button size="full" onClick={openAdd}>
            <Plus className="h-5 w-5" />
            {t("group.addExpense")}
          </Button>
        </div>
      </div>

      <AddExpenseSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        groupId={props.groupId}
        defaultCurrency={props.defaultCurrency}
        members={props.members}
        currentMemberId={props.currentMemberId}
        editing={editing}
      />
    </div>
  );
}
