// Supabase persistence for the store, so data survives restarts and is shared by every
// Vercel instance. Opt-in with STORE=supabase; locally the plain in-memory store stays.
//
// The whole store is one JSON document in the `app_state` table. Each store call loads it,
// runs the normal in-memory logic on it, and (for writes) saves it back with an optimistic
// version check, retrying on conflict. Fine at demo traffic; the table is only reachable with
// the service-role (secret) key, which stays on the server.
//
// One-time setup in the Supabase SQL editor:
//   create table app_state (id text primary key, version bigint not null, data jsonb not null,
//                           updated_at timestamptz not null default now());
//   alter table app_state enable row level security;

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ROW_ID = "main";
const MAX_ATTEMPTS = 5;

/** Store methods that only read. Everything else is treated as a write. */
const isRead = (method: string) => method.startsWith("list") || method.startsWith("get") || method === "spentLast7Days";

let client: SupabaseClient | undefined;
function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("STORE=supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  client ??= createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}

async function load<Snapshot>(): Promise<{ data: Snapshot | null; version: number }> {
  const { data, error } = await db().from("app_state").select("data, version").eq("id", ROW_ID).maybeSingle();
  if (error) throw new Error(`Supabase store load failed: ${error.message}`);
  return data ? { data: data.data as Snapshot, version: Number(data.version) } : { data: null, version: 0 };
}

/** Saves if nobody else saved since `version`. Returns false on a conflict. */
async function save<Snapshot>(snapshot: Snapshot, version: number): Promise<boolean> {
  const now = new Date().toISOString();
  if (version === 0) {
    const { error } = await db().from("app_state").insert({ id: ROW_ID, version: 1, data: snapshot, updated_at: now });
    if (error?.code === "23505") return false; // someone created the row first
    if (error) throw new Error(`Supabase store save failed: ${error.message}`);
    return true;
  }
  const { data, error } = await db()
    .from("app_state")
    .update({ version: version + 1, data: snapshot, updated_at: now })
    .eq("id", ROW_ID)
    .eq("version", version)
    .select("id");
  if (error) throw new Error(`Supabase store save failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Wraps a snapshot-able in-memory store so every method call reads from and writes to Supabase.
 * `hydrate(null)` must return a fresh, empty store.
 */
export function supabaseBacked<S extends object, Snapshot>(
  hydrate: (snapshot: Snapshot | null) => S,
  dehydrate: (store: S) => Snapshot,
): S {
  return new Proxy({} as S, {
    get(_target, method) {
      // Not a store method: e.g. `then` (checked when awaiting) or symbols used by inspection.
      if (typeof method !== "string" || method === "then") return undefined;
      return async (...args: unknown[]) => {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const { data, version } = await load<Snapshot>();
          const memory = hydrate(data);
          const fn = (memory as Record<string, (...a: unknown[]) => Promise<unknown>>)[method];
          if (typeof fn !== "function") throw new Error(`Unknown store method ${method}`);
          const result = await fn.apply(memory, args);
          if (isRead(method) || (await save(dehydrate(memory), version))) return result;
        }
        throw new Error(`Store is busy (${method} conflicted ${MAX_ATTEMPTS} times); try again`);
      };
    },
  });
}
