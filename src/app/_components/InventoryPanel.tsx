import type { InventoryItem, Requirement } from "@/types";
import { sameItemName } from "@/lib/matching";
import { EmptyState, Panel } from "./Panel";
import { num, qty } from "./format";

/** Matches the agent's reorder horizon: flag items that hit their minimum within a week. */
const LOW_STOCK_DAYS = 7;

type Status = "below" | "low" | "ok";

function stockStatus(item: InventoryItem, requirement: Requirement | undefined): Status {
  const min = requirement?.minStockLevel ?? item.dailyUsage * LOW_STOCK_DAYS;
  if (item.quantityOnHand <= min) return "below";
  if (item.dailyUsage > 0 && (item.quantityOnHand - min) / item.dailyUsage <= LOW_STOCK_DAYS) return "low";
  return "ok";
}

const STATUS_STYLES: Record<Status, { row: string; badge: string; label: string }> = {
  below: { row: "bg-red-50", badge: "bg-red-100 text-red-800", label: "Below minimum" },
  low: { row: "bg-amber-50", badge: "bg-amber-100 text-amber-800", label: "Running low" },
  ok: { row: "", badge: "bg-emerald-100 text-emerald-800", label: "OK" },
};

export function InventoryPanel({
  inventory,
  requirements,
}: {
  inventory: InventoryItem[] | null;
  requirements: Requirement[];
}) {
  return (
    <Panel title="Inventory" description="Current stock from Square. Items running low are highlighted.">
      {inventory === null ? (
        <EmptyState>Loading inventory…</EmptyState>
      ) : inventory.length === 0 ? (
        <EmptyState>No inventory items.</EmptyState>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-5 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">On hand</th>
                <th className="px-3 py-2 text-right font-medium">Daily use</th>
                <th className="px-3 py-2 text-right font-medium">Days left</th>
                <th className="px-3 py-2 text-right font-medium">Minimum</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {inventory.map((item) => {
                const requirement = requirements.find((r) => sameItemName(r.itemName, item.name));
                const style = STATUS_STYLES[stockStatus(item, requirement)];
                const daysLeft = item.dailyUsage > 0 ? item.quantityOnHand / item.dailyUsage : Infinity;
                return (
                  <tr key={item.sku} className={style.row}>
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-stone-900">{item.name}</div>
                      <div className="text-xs text-stone-500">{item.sku}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{qty(item.quantityOnHand, item.unit)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{qty(item.dailyUsage, item.unit)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {Number.isFinite(daysLeft) ? num(daysLeft) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {requirement ? qty(requirement.minStockLevel, item.unit) : "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                        {style.label}
                      </span>
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
