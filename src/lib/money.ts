/**
 * Money handling in integer minor units. Never use floating point for amounts.
 */

export const SUPPORTED_CURRENCIES = ["ILS", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

// All supported currencies use exponent 2 (two decimal places).
export const CURRENCY_EXPONENT = 2;

export const CURRENCY_META: Record<
  Currency,
  { symbol: string; label: string; labelHe: string }
> = {
  ILS: { symbol: "₪", label: "Shekel", labelHe: "שקל" },
  USD: { symbol: "$", label: "Dollar", labelHe: "דולר" },
  EUR: { symbol: "€", label: "Euro", labelHe: "אירו" },
  GBP: { symbol: "£", label: "Pound", labelHe: "לירה שטרלינג" },
};

export function isSupportedCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/**
 * Parse a user-entered decimal string into integer minor units.
 * Rejects invalid input and excess precision. Returns null on invalid input.
 */
export function parseAmountToMinor(input: string): number | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  // Allow optional leading sign is NOT allowed — amounts must be positive.
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return null;
  const whole = match[1] ?? "";
  const frac = match[2] ?? "";
  if (frac.length > CURRENCY_EXPONENT) return null; // excess precision
  const paddedFrac = frac.padEnd(CURRENCY_EXPONENT, "0");
  const combined = `${whole}${paddedFrac}`;
  // Guard against absurdly large numbers.
  if (combined.length > 15) return null;
  const minor = Number(combined);
  if (!Number.isSafeInteger(minor)) return null;
  if (minor <= 0) return null;
  return minor;
}

/** Format integer minor units as a decimal string (no currency symbol). */
export function formatMinor(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const divisor = 10 ** CURRENCY_EXPONENT;
  const whole = Math.floor(abs / divisor);
  const frac = abs % divisor;
  return `${sign}${whole}.${String(frac).padStart(CURRENCY_EXPONENT, "0")}`;
}

/** Format minor units with currency symbol and locale grouping. */
export function formatMoney(
  minor: number,
  currency: Currency,
  locale = "he-IL",
): string {
  const value = minor / 10 ** CURRENCY_EXPONENT;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: CURRENCY_EXPONENT,
      maximumFractionDigits: CURRENCY_EXPONENT,
    }).format(value);
  } catch {
    return `${CURRENCY_META[currency].symbol}${formatMinor(minor)}`;
  }
}
