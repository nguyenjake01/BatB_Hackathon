"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { HOME, roleOf, supabase } from "@/lib/supabase";

const PUBLIC_PATHS = ["/login"];

interface AuthState {
  /** False when Supabase isn't configured: the app then runs without sign-in. */
  enabled: boolean;
  /** Undefined while the session is still loading. */
  user: User | null | undefined;
}

const AuthContext = createContext<AuthState>({ enabled: false, user: null });

export const useAuth = () => useContext(AuthContext);

/** Each role sees only its own interface: owners the dashboard, distributors the portal. */
const allowedFor = (role: "owner" | "distributor", pathname: string) =>
  role === "distributor" ? pathname.startsWith("/distributor") : !pathname.startsWith("/distributor");

/** Loads the Supabase session, sends signed-out visitors to /login, and keeps each role on its own pages. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(supabase ? undefined : null);
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const blocked = supabase !== null && !isPublic && user === null;
  const wrongRole = supabase !== null && !isPublic && !!user && !allowedFor(roleOf(user), pathname);
  useEffect(() => {
    if (blocked) router.replace("/login");
    else if (wrongRole && user) router.replace(HOME[roleOf(user)]);
  }, [blocked, wrongRole, user, router]);

  const waiting = supabase !== null && !isPublic && (!user || wrongRole);
  return (
    <AuthContext.Provider value={{ enabled: supabase !== null, user }}>
      {waiting ? <p className="animate-pulse py-24 text-center text-sm text-stone-400">Loading…</p> : children}
    </AuthContext.Provider>
  );
}
