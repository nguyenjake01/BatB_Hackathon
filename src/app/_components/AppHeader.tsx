"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo />
          <span className="truncate text-[15px] font-semibold tracking-tight text-stone-900">
            Bakery Purchasing Agent
          </span>
        </Link>
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
      </div>
    </header>
  );
}
