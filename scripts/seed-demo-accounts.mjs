// Creates the demo sign-in accounts in Supabase (owner: Person 3). Safe to rerun.
//
//   node --env-file=.env.local scripts/seed-demo-accounts.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the secret key; never ship it
// to the browser). These are throwaway demo accounts with a shared password, so judges can
// sign in too. Accounts only identify who is looking; all app data is shared.

import { createClient } from "@supabase/supabase-js";

const DEMO_PASSWORD = "bakery-demo-2026";

const ACCOUNTS = [
  { email: "owner@demo.test", role: "owner", name: "Demo Bakery" },
  { email: "distributor@demo.test", role: "distributor", name: "Demo Distributor" },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }).auth.admin;

const { data: existing, error: listError } = await admin.listUsers();
if (listError) throw listError;

for (const account of ACCOUNTS) {
  const attributes = {
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { role: account.role, name: account.name },
  };
  const found = existing.users.find((u) => u.email === account.email);
  const { error } = found
    ? await admin.updateUserById(found.id, attributes)
    : await admin.createUser({ email: account.email, ...attributes });
  if (error) throw error;
  console.log(`${found ? "Updated" : "Created"} ${account.role} account: ${account.email}`);
}
console.log("Done. The password is DEMO_PASSWORD in this script.");
