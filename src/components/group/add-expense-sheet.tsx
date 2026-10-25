"use client";

import * as React from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_META,
  parseAmountToMinor,
  formatMoney,
  type Currency,
} from "@/lib/money";
import { computeSplit, type SplitMode } from "@/lib/splits";
import {
  createExpenseAction,
  editExpenseAction,
} from "@/app/actions/expenses";
import type { MemberView, ExpenseView } from "@/lib/queries";

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: string;
  defaultCurrency: Currency;
  members: MemberView[];
  currentMemberId: string | null;
  editing?: ExpenseView | null;
}

const SPLIT_MODES: SplitMode[] = ["equal", "exact", "percentage", "weight"];

export function AddExpenseSheet({
  open,
  onClose,
  groupId,
  defaultCurrency,
  members,
  currentMemberId,
  editing,
}: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const activeMembers = React.useMemo(
    () => members.filter((m) => m.status === "active"),
    [members],
  );

  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState<Currency>(defaultCurrency);
  const [expenseDate, setExpenseDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [payerMemberId, setPayerMemberId] = React.useState<string>(
    currentMemberId ?? activeMembers[0]?.id ?? "",
  );
  const [splitMode, setSplitMode] = React.useState<SplitMode>("equal");
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize state when opened.
  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setDescription(editing.description);
      setAmount((editing.amount_minor / 100).toFixed(2));
      setCurrency(editing.currency as Currency);
      setExpenseDate(editing.expense_date);
      setPayerMemberId(editing.payers[0]?.member_id ?? currentMemberId ?? "");
      const sel: Record<string, boolean> = {};
      editing.splits.forEach((s) => (sel[s.member_id] = true));
      setSelected(sel);
      setSplitMode((editing.splits[0]?.split_mode as SplitMode) ?? "equal");
      setShowAdvanced((editing.splits[0]?.split_mode ?? "equal") !== "equal");
    } else {
      setDescription("");
      setAmount("");
      setCurrency(defaultCurrency);
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setPayerMemberId(currentMemberId ?? activeMembers[0]?.id ?? "");
      setSplitMode("equal");
      setShowAdvanced(false);
      const sel: Record<string, boolean> = {};
      activeMembers.forEach((m) => (sel[m.id] = true));
      setSelected(sel);
      setValues({});
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const participants = activeMembers.filter((m) => selected[m.id]);
  const amountMinor = parseAmountToMinor(amount);

  // Live preview of split shares.
  const preview = React.useMemo(() => {
    if (!amountMinor || participants.length === 0) return null;
    try {
      return computeSplit({
        totalMinor: amountMinor,
        mode: splitMode,
        members: participants.map((p) => ({
          memberId: p.id,
          value:
            splitMode === "exact"
              ? parseAmountToMinor(values[p.id] ?? "") ?? 0
              : Number(values[p.id] ?? 0),
        })),
      });
    } catch {
      return null;
    }
  }, [amountMinor, participants, splitMode, values]);

  async function handleSave() {
    setError(null);
    if (!description.trim()) return setError(t("expense.description"));
    if (!amountMinor) return setError("סכום לא תקין");
    if (!payerMemberId) return setError(t("expense.payer"));
    if (participants.length === 0) return setError(t("expense.participants"));

    const payloadParticipants = participants.map((p) => ({
      memberId: p.id,
      value:
        splitMode === "equal"
          ? undefined
          : splitMode === "exact"
            ? parseAmountToMinor(values[p.id] ?? "") ?? 0
            : Number(values[p.id] ?? 0),
    }));

    setPending(true);
    const base = {
      groupId,
      description: description.trim(),
      amount,
      currency,
      expenseDate,
      payerMemberId,
      splitMode,
      participants: payloadParticipants,
    };
    const res = editing
      ? await editExpenseAction({
          ...base,
          expenseId: editing.id,
          version: editing.version,
        })
      : await createExpenseAction(base);
    setPending(false);

    if (!res.ok) {
      setError(t(res.error ?? "error.generic"));
      return;
    }
    toast(editing ? t("common.save") : t("group.addExpense"), "success");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? t("common.edit") : t("group.addExpense")}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="desc">{t("expense.description")}</Label>
          <Input
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={140}
            placeholder={t("expense.description")}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="amount">{t("expense.amount")}</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="w-28 space-y-1.5">
            <Label htmlFor="currency">{t("expense.currency")}</Label>
            <Select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_META[c].symbol} {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="payer">{t("expense.payer")}</Label>
            <Select
              id="payer"
              value={payerMemberId}
              onChange={(e) => setPayerMemberId(e.target.value)}
            >
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40 space-y-1.5">
            <Label htmlFor="date">{t("expense.date")}</Label>
            <Input
              id="date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("expense.participants")}</Label>
            <button
              type="button"
              className="text-sm text-primary"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {t("expense.advanced")}
            </button>
          </div>

          {showAdvanced && (
            <Select
              value={splitMode}
              onChange={(e) => setSplitMode(e.target.value as SplitMode)}
              aria-label={t("expense.splitMode")}
            >
              {SPLIT_MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`expense.split.${m}`)}
                </option>
              ))}
            </Select>
          )}

          <ul className="space-y-1.5">
            {activeMembers.map((m) => {
              const share = preview?.find((p) => p.memberId === m.id);
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={!!selected[m.id]}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [m.id]: e.target.checked }))
                    }
                    aria-label={m.display_name}
                  />
                  <span className="flex-1 truncate">{m.display_name}</span>
                  {showAdvanced && splitMode !== "equal" && selected[m.id] && (
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      value={values[m.id] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                      placeholder={
                        splitMode === "percentage"
                          ? "%"
                          : splitMode === "weight"
                            ? "×"
                            : "0.00"
                      }
                    />
                  )}
                  {selected[m.id] && share && (
                    <span className="w-24 shrink-0 text-end text-sm font-medium text-muted-foreground">
                      {formatMoney(share.amountMinor, currency)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={pending}>
            {pending ? "…" : t("expense.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
