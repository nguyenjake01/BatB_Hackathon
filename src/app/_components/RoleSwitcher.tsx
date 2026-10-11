"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Demo-only role switch (PRD: no real auth). Each role is its own page. */
const ROLES = [
  { href: "/", label: "Owner" },
  { href: "/distributor", label: "Distributor" },
];

export function RoleSwitcher() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-3 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-stone-500">Viewing as</span>
          <div className="flex rounded-lg bg-stone-100 p-0.5">
            {ROLES.map((role) => {
              const active = role.href === "/" ? pathname === "/" : pathname.startsWith(role.href);
              return (
                <Link
                  key={role.href}
                  href={role.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1 font-medium ${
                    active ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  {role.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
