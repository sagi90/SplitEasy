import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Absolute site URL used to build share/invite links and auth redirects.
 * Never falls back to VERCEL_URL (a deployment-specific preview domain); the
 * production domain must be configured via NEXT_PUBLIC_APP_URL.
 */
export function getSiteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  return (fromEnv ?? "http://localhost:3000").replace(/\/$/, "");
}
