import type { InventoryItem, OrderWithProduct, Requirement } from "@/types";
import { sameItemName } from "@/lib/matching";
import type { SettingsResponse, WalletInfo } from "./api";
import { daysLeft, stockStatus } from "./InventoryPanel";
import { money, num, pct, savingsVsBaseline } from "./format";

type Tone = "red" | "amber" | "green" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  red: "text-red-400",
  amber: "text-amber-300",
  green: "text-emerald-400",
  neutral: "text-white",
};

function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  href,
  className = "",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: Tone;
  /** Makes the subtitle a link, e.g. to a block explorer. */
  href?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 bg-stone-900 px-4 py-5 sm:px-6 sm:py-6 ${className}`}>
      <div className="text-sm text-stone-400">{label}</div>
      <div className={`mt-2 truncate text-3xl font-normal sm:text-4xl tabular-nums tracking-[-0.02em] ${TONE_TEXT[tone]}`}>{value}</div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-stone-400 hover:text-white hover:underline">
          {sub} ↗
        </a>
      ) : (
        <div className="mt-1 truncate text-sm text-stone-400">{sub}</div>
      )}
    </div>
  );
}

/** The numbers that tell the story at a glance. */
export function SummaryStrip({
  inventory,
  requirements,
  orders,
  settings,
  wallet,
}: {
  inventory: InventoryItem[] | null;
  requirements: Requirement[];
  orders: OrderWithProduct[];
  settings: SettingsResponse | null;
  /** undefined: loading or unavailable; null: payments in test mode. */
  wallet: WalletInfo | null | undefined;
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
    // One dark band, like the black feature sections on runway.com; the 1px gaps draw the dividers.
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-stone-700 lg:grid-cols-5">
      <Stat
        label="Wallet balance"
        value={wallet ? money(wallet.ausd) : "—"}
        sub={wallet ? `AUSD on ${wallet.network}` : wallet === null ? "Payments in test mode" : "Loading wallet"}
        href={wallet?.explorerUrl}
        tone={wallet ? "green" : "neutral"}
        className="col-span-2 lg:col-span-1"
      />
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
