"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import * as React from "react";
import { consumeClaimAction, type MemberResult } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="full" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

export function ClaimForm({
  token,
  memberName,
}: {
  token: string;
  memberName: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, formAction] = useFormState<MemberResult | null, FormData>(
    consumeClaimAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok && state.groupId) {
      router.push(`/groups/${state.groupId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="displayName" value={memberName} />
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {t(state.error)}
        </p>
      )}
      <SubmitButton label={t("claim.cta")} />
    </form>
  );
}
