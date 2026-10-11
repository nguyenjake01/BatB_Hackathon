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
    <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">{children}</p>;
}
