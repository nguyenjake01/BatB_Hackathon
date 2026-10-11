"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const PUBLIC_PATHS = ["/login"];

interface AuthState {
  /** False when Supabase isn't configured: the app then runs without sign-in. */
  enabled: boolean;
  /** Undefined while the session is still loading. */
  user: User | null | undefined;
}

const AuthContext = createContext<AuthState>({ enabled: false, user: null });

export const useAuth = () => useContext(AuthContext);

/** Loads the Supabase session and sends signed-out visitors to /login. */
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
  useEffect(() => {
    if (blocked) router.replace("/login");
  }, [blocked, router]);

  const waiting = supabase !== null && !isPublic && !user;
  return (
    <AuthContext.Provider value={{ enabled: supabase !== null, user }}>
      {waiting ? <p className="animate-pulse py-24 text-center text-sm text-stone-400">Loading…</p> : children}
    </AuthContext.Provider>
  );
}
