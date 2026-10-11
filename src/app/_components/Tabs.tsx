"use client";

import { useSyncExternalStore } from "react";

export interface Tab<K extends string> {
  key: K;
  label: string;
  /** Small badge after the label (e.g. orders waiting); hidden when 0 or missing. */
  count?: number;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The open tab lives in the URL hash, so a refresh or a shared link keeps it. */
export function useHashTab<K extends string>(tabs: readonly Tab<K>[]): K {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1),
    () => "",
  );
  return tabs.find((t) => t.key === hash)?.key ?? tabs[0].key;
}

/** Large text tabs, inactive ones in gray, like the section switchers on runway.com. */
export function TabBar<K extends string>({ tabs, active }: { tabs: readonly Tab<K>[]; active: K }) {
  return (
    <nav aria-label="Sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-7 border-b border-line">
        {tabs.map((tab) => {
          const on = tab.key === active;
          return (
            <a
              key={tab.key}
              href={`#${tab.key}`}
              aria-current={on ? "page" : undefined}
              className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-xl tracking-[-0.01em] transition-colors sm:text-2xl ${
                on ? "border-stone-900 text-stone-900" : "border-transparent text-stone-400 hover:text-stone-700"
              }`}
            >
              {tab.label}
              {!!tab.count && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold tabular-nums tracking-normal text-white">
                  {tab.count}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
