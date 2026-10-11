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
    <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 shadow-sm">
      {/* A wheat stalk. */}
      <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
        className="rounded-lg px-2.5 py-1.5 font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      >
        Sign out
      </button>
    </div>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  if (pathname === "/login") {
    return (
      <header className="border-b border-line bg-white/85">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2.5 px-4 py-3 sm:px-6">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-stone-900">Bakery Purchasing Agent</span>
        </div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo />
          <span className="truncate text-[15px] font-semibold tracking-tight text-stone-900">
            Bakery Purchasing Agent
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <nav aria-label="View as" className="flex shrink-0 rounded-lg bg-stone-100 p-0.5 text-sm">
            {ROLES.map((role) => {
              const active = role.href === "/" ? pathname === "/" : pathname.startsWith(role.href);
              return (
                <Link
                  key={role.href}
                  href={role.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    active ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  {role.label}
                </Link>
              );
            })}
          </nav>
          <Account />
        </div>
      </div>
    </header>
  );
}
