"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { roleOf, supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";

/** Demo-only role switch (PRD: no real auth). Each role is its own page. */
const ROLES = [
  { href: "/", label: "Owner" },
  { href: "/distributor", label: "Distributor" },
];

function Logo() {
  return (
    <span className="flex size-7 items-center justify-center rounded-md bg-stone-900">
      {/* A wheat stalk. */}
      <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 21V8" />
        <path d="M12 12c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4Z" />
        <path d="M12 12c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4Z" />
        <path d="M12 16c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4Z" />
        <path d="M12 16c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4Z" />
        <path d="M12 8c-1.2-1-1.5-2.5-.8-5 1.6 1.2 1.8 3 .8 5Z" />
      </svg>
    </span>
  );
}

function Account() {
  const { enabled, user } = useAuth();
  const router = useRouter();
  if (!enabled || !user) return null;
  const name = (user.user_metadata?.name as string | undefined) || user.email;
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <div className="hidden min-w-0 text-right leading-tight md:block">
        <div className="truncate font-medium text-stone-800">{name}</div>
        <div className="text-xs capitalize text-stone-500">{roleOf(user)}</div>
      </div>
      <button
        type="button"
        onClick={async () => {
          await supabase?.auth.signOut();
          router.replace("/login");
        }}
        className="rounded-md px-2.5 py-1.5 font-semibold text-stone-600 hover:bg-black/5 hover:text-stone-900"
      >
        Sign out
      </button>
    </div>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  // With accounts on, each role is locked to its own interface; the switch is only a fallback without sign-in.
  const { enabled } = useAuth();
  if (pathname === "/login") {
    return (
      <header className="bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2.5 px-4 py-3 sm:px-6">
          <Logo />
          <span className="text-lg font-semibold tracking-[-0.03em] text-stone-900">Bizaar</span>
        </div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo />
          <span className="truncate text-lg font-semibold tracking-[-0.03em] text-stone-900">
            Bizaar
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          {!enabled && (
            <nav aria-label="View as" className="flex shrink-0 gap-2 text-sm">
              {ROLES.map((role) => {
                const active = role.href === "/" ? pathname === "/" : pathname.startsWith(role.href);
                return (
                  <Link
                    key={role.href}
                    href={role.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
                      active ? "bg-stone-800 text-white" : "bg-[#eef1f5] text-stone-900 hover:bg-[#e2e6ec]"
                    }`}
                  >
                    {role.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <Account />
        </div>
      </div>
    </header>
  );
}
