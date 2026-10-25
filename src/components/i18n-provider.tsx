"use client";

import * as React from "react";
import { getDictionary, type Locale } from "@/lib/i18n";

interface I18nContextValue {
  locale: Locale;
  t: (key: string) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = React.useMemo<I18nContextValue>(() => {
    const dict = getDictionary(locale);
    return { locale, t: (key: string) => dict[key] ?? key };
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
