import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    // min-w-0 lets wide tables scroll inside the panel instead of stretching the page.
    <section className="min-w-0 rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(41,37,36,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-stone-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line bg-stone-50/60 px-4 py-8 text-center text-sm text-stone-500">
      {children}
    </p>
  );
}

/** A feature whose backend isn't available yet: says so plainly, with the technical detail tucked away. */
export function NotConnected({ what, detail }: { what: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-stone-50/60 px-4 py-6 text-center">
      <p className="text-sm font-medium text-stone-600">{what} isn&apos;t connected yet</p>
      {detail && <p className="mt-1 text-xs text-stone-400">{detail}</p>}
    </div>
  );
}

/** Small "Loading…" placeholder that holds the panel's height. */
export function Loading({ children }: { children: ReactNode }) {
  return <p className="animate-pulse py-8 text-center text-sm text-stone-400">{children}</p>;
}
