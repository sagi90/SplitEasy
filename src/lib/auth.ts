import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the current authenticated user (anonymous or permanent), or null.
 * Supabase anonymous sign-in yields an `authenticated` session whose
 * `is_anonymous` claim is true — it is NOT the Postgres `anon` role.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Ensures there is an authenticated session, creating an anonymous one if
 * needed. Must be called from a Server Action or Route Handler (where cookies
 * can be written). Returns the user, or null if anonymous sign-in failed.
 */
export async function ensureSession(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    return null;
  }
  return data.user;
}

/** Whether a user is an anonymous (guest) identity. */
export function isGuest(user: User | null): boolean {
  return !!user?.is_anonymous;
}
