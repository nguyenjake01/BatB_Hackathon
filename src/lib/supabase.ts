// Supabase browser client for sign-in (owner: Person 3). Accounts only identify who is
// looking: all business and distributor data stays shared, as in the PRD.
//
// Without NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY the app runs without
// sign-in, so teammates without these keys aren't blocked.

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type Role = "owner" | "distributor";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

/** Role chosen at sign-up, stored in the user's metadata. Defaults to owner. */
export function roleOf(user: User | null | undefined): Role {
  return user?.user_metadata?.role === "distributor" ? "distributor" : "owner";
}

/** The distributor company a distributor account manages, once it has claimed or created one. */
export function distributorIdOf(user: User | null | undefined): string | null {
  const id = user?.user_metadata?.distributorId;
  return typeof id === "string" && id ? id : null;
}

/** Links the signed-in distributor account to its company. */
export async function linkDistributor(distributorId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({ data: { distributorId } });
  if (error) throw error;
}

/** Where each role lands after signing in. */
export const HOME: Record<Role, string> = { owner: "/", distributor: "/distributor" };
