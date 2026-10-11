import type { InventoryItem, OrderWithProduct, Requirement } from "@/types";
import { sameItemName } from "@/lib/matching";
import type { SettingsResponse } from "./api";
import { daysLeft, stockStatus } from "./InventoryPanel";
import { money, num, pct, savingsVsBaseline } from "./format";

type Tone = "red" | "amber" | "green" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  red: "text-red-600",
  amber: "text-amber-600",
  green: "text-emerald-600",
  neutral: "text-stone-900",
};

function Stat({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: Tone }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(41,37,36,0.04)]">
      <div className="text-xs font-medium text-stone-500">{label}</div>
      <div className={`mt-1 truncate text-2xl font-semibold tabular-nums tracking-tight ${TONE_TEXT[tone]}`}>{value}</div>
      <div className="truncate text-xs text-stone-500">{sub}</div>
    </div>
  );
}

/** The four numbers that tell the story at a glance. */
export function SummaryStrip({
  inventory,
  requirements,
  orders,
  settings,
}: {
  inventory: InventoryItem[] | null;
  requirements: Requirement[];
  orders: OrderWithProduct[];
  settings: SettingsResponse | null;
}) {
  const items = inventory ?? [];
  const soonest = [...items].sort((a, b) => daysLeft(a) - daysLeft(b))[0];
  const soonestDays = soonest ? daysLeft(soonest) : Infinity;
  const needReorder = items.filter(
    (i) => stockStatus(i, requirements.find((r) => sameItemName(r.itemName, i.name))) !== "ok",
  ).length;

  const paid = orders.filter((o) => o.status === "paid" && o.baselinePrice !== undefined);
  const saved = paid.reduce((sum, o) => sum + (savingsVsBaseline(o) ?? 0), 0);
  const baseline = paid.reduce((sum, o) => sum + (o.baselinePrice ?? 0), 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Next to run out"
        value={soonest && Number.isFinite(soonestDays) ? `${num(soonestDays)} days` : "—"}
        sub={soonest ? soonest.name : "Loading inventory"}
        tone={soonestDays <= 3.5 ? "red" : soonestDays <= 7 ? "amber" : "neutral"}
      />
      <Stat
        label="Need reordering"
        value={inventory ? String(needReorder) : "—"}
        sub={inventory ? `of ${items.length} items` : "Loading inventory"}
        tone={needReorder > 0 ? "amber" : "green"}
      />
      <Stat
        label="Saved vs retail"
        value={paid.length > 0 ? money(saved) : "—"}
        sub={paid.length > 0 && baseline > 0 ? `${pct(saved / baseline)} below retail` : "No paid orders yet"}
        tone={paid.length > 0 && saved > 0 ? "green" : "neutral"}
      />
      <Stat
        label="Spent this week"
        value={settings ? money(settings.spentThisWeek) : "—"}
        sub={
          settings
            ? `of ${money(settings.settings.weeklyBudget)} · ${settings.settings.mode === "auto" ? "auto-buy on" : "approval mode"}`
            : "Settings not connected"
        }
      />
    </div>
  );
}
