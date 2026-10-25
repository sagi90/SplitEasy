import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";

export const LOCALE_COOKIE = "spliteasy_locale";

/** Read the preferred locale from the cookie (server-side). */
export function getServerLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value as Locale | undefined;
  if (value && LOCALES.includes(value)) return value;
  return DEFAULT_LOCALE;
}
