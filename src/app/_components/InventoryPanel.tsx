import type { InventoryItem, Requirement } from "@/types";
import { sameItemName } from "@/lib/matching";
import { EmptyState, Loading, Panel } from "./Panel";
import { num, qty } from "./format";
import { pill } from "./ui";

/** Matches the agent's reorder horizon: flag items that hit their minimum within a week. */
const LOW_STOCK_DAYS = 7;
/** Days of supply that fill the runway bar. */
const RUNWAY_FULL_DAYS = 14;

export type StockStatus = "below" | "low" | "ok";

export function stockStatus(item: InventoryItem, requirement: Requirement | undefined): StockStatus {
  const min = requirement?.minStockLevel ?? item.dailyUsage * LOW_STOCK_DAYS;
  if (item.quantityOnHand <= min) return "below";
  if (item.dailyUsage > 0 && (item.quantityOnHand - min) / item.dailyUsage <= LOW_STOCK_DAYS) return "low";
  return "ok";
}

export const daysLeft = (item: InventoryItem) =>
  item.dailyUsage > 0 ? item.quantityOnHand / item.dailyUsage : Infinity;

const STATUS_STYLES: Record<StockStatus, { pill: string; bar: string; label: string }> = {
  below: { pill: pill.red, bar: "bg-red-500", label: "Below min" },
  low: { pill: pill.amber, bar: "bg-amber-500", label: "Running low" },
  ok: { pill: pill.green, bar: "bg-emerald-500", label: "OK" },
};

export function InventoryPanel({
  inventory,
  requirements,
  live,
}: {
  inventory: InventoryItem[] | null;
  requirements: Requirement[];
  /** True when the data comes from Square rather than the mock. */
  live: boolean;
}) {
  return (
    <Panel
      title="Inventory"
      description={live ? "Live from your Square account. Daily use comes from recent sales." : "Sample data (Square not connected)."}
    >
      {inventory === null ? (
        <Loading>Loading inventory…</Loading>
      ) : inventory.length === 0 ? (
        <EmptyState>No inventory items.</EmptyState>
      ) : (
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[560px] whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-stone-500">
                <th className="px-6 pb-2 font-medium">Item</th>
                <th className="px-2.5 pb-2 text-right font-medium">On hand</th>
                <th className="px-2.5 pb-2 text-right font-medium">Daily use</th>
                <th className="px-2.5 pb-2 font-medium">Days left</th>
                <th className="px-2.5 pb-2 text-right font-medium">Minimum</th>
                <th className="px-6 pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...inventory]
                .sort((a, b) => daysLeft(a) - daysLeft(b))
                .map((item) => {
                  const requirement = requirements.find((r) => sameItemName(r.itemName, item.name));
                  const style = STATUS_STYLES[stockStatus(item, requirement)];
                  const days = daysLeft(item);
                  return (
                    <tr key={item.sku}>
                      <td className="px-6 py-3">
                        <div className="font-medium text-stone-900">{item.name}</div>
                        <div className="font-mono text-[11px] text-stone-400">{item.sku}</div>
                      </td>
                      <td className="px-2.5 py-3 text-right tabular-nums">{qty(item.quantityOnHand, item.unit)}</td>
                      <td className="px-2.5 py-3 text-right tabular-nums text-stone-600">{qty(item.dailyUsage, item.unit)}/day</td>
                      <td className="px-2.5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white">
                            <div
                              className={`h-full rounded-full ${style.bar}`}
                              style={{ width: `${Math.min(1, (Number.isFinite(days) ? days : RUNWAY_FULL_DAYS) / RUNWAY_FULL_DAYS) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 tabular-nums text-stone-700">{Number.isFinite(days) ? num(days) : "—"}</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-3 text-right tabular-nums text-stone-600">
                        {requirement ? qty(requirement.minStockLevel, item.unit) : "—"}
                      </td>
                      <td className="px-6 py-3">
                        <span className={style.pill}>{style.label}</span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
