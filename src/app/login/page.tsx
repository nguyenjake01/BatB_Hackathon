"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HOME, roleOf, supabase, type Role } from "@/lib/supabase";
import { useAuth } from "../_components/AuthProvider";
import { button, input, label } from "../_components/ui";

const ROLES: { value: Role; title: string; hint: string }[] = [
  { value: "owner", title: "Business owner", hint: "Track stock and let the agent buy for you" },
  { value: "distributor", title: "Distributor", hint: "Claim listings and set your agent's prices" },
];

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>("owner");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or just signed in): go to this role's home.
  useEffect(() => {
    if (user) router.replace(HOME[roleOf(user)]);
  }, [user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { role, name: name.trim() } } });
    setBusy(false);
    if (error) setError(error.message);
    // On success the auth listener sets the user and the effect above redirects.
  }

  if (!supabase) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center text-sm text-stone-500">
        Accounts aren&apos;t set up on this deployment. Use the Owner / Distributor switch above.
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-center text-4xl font-normal tracking-[-0.025em] text-stone-900">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-3 text-center text-base text-stone-600">
        {mode === "signin" ? "Sign in to your bakery or distributor account." : "For small businesses and the distributors who supply them."}
      </p>

      <div className="mt-8 rounded-2xl bg-surface p-6">
        <div className="mb-5 grid grid-cols-2 gap-2 text-sm">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-md py-1.5 font-semibold transition-colors ${
                mode === m ? "bg-stone-800 text-white" : "bg-white text-stone-900 hover:bg-stone-50"
              }`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="grid gap-4">
          {mode === "signup" && (
            <>
              <fieldset className="grid grid-cols-2 gap-2">
                <legend className={label}>I am a…</legend>
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className={`cursor-pointer rounded-xl border p-3 text-sm transition-colors ${
                      role === r.value ? "border-stone-900 bg-white ring-1 ring-stone-900" : "border-line hover:bg-white/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={() => setRole(r.value)}
                      className="sr-only"
                    />
                    <span className="block font-medium text-stone-900">{r.title}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">{r.hint}</span>
                  </label>
                ))}
              </fieldset>
              <label>
                <span className={label}>{role === "owner" ? "Business name" : "Company name"}</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={role === "owner" ? "e.g. Corner Bakery" : "e.g. Midwest Baking Supply"}
                  className={input}
                />
              </label>
            </>
          )}
          <label>
            <span className={label}>Email</span>
            <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <label>
            <span className={label}>Password</span>
            <input
              required
              type="password"
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className={`${button.primary} w-full`}>
            {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
