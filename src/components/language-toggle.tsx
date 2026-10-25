"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/actions/account";
import { useI18n } from "@/components/i18n-provider";

export function LanguageToggle() {
  const { locale } = useI18n();
  const [pending, startTransition] = useTransition();
  const next = locale === "he" ? "en" : "he";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setLocaleAction(next))}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
      aria-label="Toggle language"
    >
      <Languages className="h-4 w-4" />
      {next === "en" ? "English" : "עברית"}
    </button>
  );
}
