"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createGroupAction, type ActionResult } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { SUPPORTED_CURRENCIES, CURRENCY_META } from "@/lib/money";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="full" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

export function CreateGroupForm() {
  const { t } = useI18n();
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    createGroupAction,
    null,
  );
  const [showMore, setShowMore] = useState(false);

  return (
    <form action={formAction} className="space-y-3">
      <Input
        name="name"
        required
        maxLength={80}
        placeholder={t("welcome.groupNamePlaceholder")}
        aria-label={t("welcome.groupNamePlaceholder")}
        autoFocus
      />
      <Input
        name="displayName"
        maxLength={60}
        placeholder={t("welcome.displayNamePlaceholder")}
        aria-label={t("welcome.displayNamePlaceholder")}
      />

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`}
        />
        {t("expense.currency")}
      </button>

      {showMore && (
        <Select name="defaultCurrency" defaultValue="ILS" aria-label={t("expense.currency")}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {CURRENCY_META[c].symbol} {c}
            </option>
          ))}
        </Select>
      )}

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {t(state.error)}
        </p>
      )}

      <SubmitButton label={t("welcome.createCta")} />
    </form>
  );
}
