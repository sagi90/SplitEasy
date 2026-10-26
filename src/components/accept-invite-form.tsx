"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import * as React from "react";
import { acceptInviteAction, type AcceptResult } from "@/app/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="full" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

export function AcceptInviteForm({
  token,
  defaultName,
}: {
  token: string;
  defaultName?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, formAction] = useFormState<AcceptResult | null, FormData>(
    acceptInviteAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) {
      if (state.status === "pending") return; // show pending message
      if (state.groupId) router.push(`/groups/${state.groupId}`);
    }
  }, [state, router]);

  if (state?.ok && state.status === "pending") {
    return (
      <p className="rounded-lg bg-accent p-4 text-center text-accent-foreground">
        {t("invite.pending")}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="displayName">
          DEBUG-123 — Enter your name
        </Label>
        <Input
          id="displayName"
          name="displayName"
          required
          maxLength={60}
          defaultValue={defaultName}
          placeholder={t("invite.yourName")}
          autoFocus
        />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error.startsWith("Supabase ") ||
          state.error === "No invite result returned"
            ? state.error
            : state.error}
        </p>
      )}
      <SubmitButton label={t("invite.cta")} />
    </form>
  );
}
