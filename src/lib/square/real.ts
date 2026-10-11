// Real inventory source backed by the Square Inventory API (sandbox first).
//
// Stock on hand comes from Square's IN_STOCK counts. Square doesn't track daily usage, so we
// derive it from stock sold or wasted over the last USAGE_WINDOW_DAYS, divided by the days that
// history covers, first record to latest sale (at least one: Square only accepts changes up to 24h back,
// so a fresh sandbox has about a day). Units and shelf life come from our own ITEM_CONFIG.
// Run `node --env-file=.env.local src/lib/square/seed.mjs` once to fill a fresh sandbox.

import type { InventoryItem } from "@/types";
import type { InventorySource } from "./index";
import { getLocationId, ITEM_CONFIG, squareFetch, USAGE_WINDOW_DAYS } from "./catalog";

interface CatalogItem {
  id: string;
  is_deleted?: boolean;
  item_data?: {
    name?: string;
    variations?: { id: string; item_variation_data?: { sku?: string; track_inventory?: boolean } }[];
  };
}

interface InventoryChange {
  catalog_object_id: string;
  from_state?: string;
  to_state?: string;
  quantity?: string;
  occurred_at?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Adjustments out of stock that count as usage. */
const USED_STATES = new Set(["SOLD", "WASTE"]);

/** Follows Square's `cursor` pagination and concatenates one array field from every page. */
async function fetchAll<T>(path: string, key: string, body?: Record<string, unknown>): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  do {
    const page = body
      ? await squareFetch<Record<string, unknown>>(path, { method: "POST", body: { ...body, cursor } })
      : await squareFetch<Record<string, unknown>>(
          cursor ? `${path}${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}` : path,
        );
    out.push(...((page[key] as T[] | undefined) ?? []));
    cursor = page.cursor as string | undefined;
  } while (cursor);
  return out;
}

export const squareInventory: InventorySource = {
  async getInventory() {
    const locationId = await getLocationId();

    // Inventory-tracked variations with a SKU, named after their parent item.
    const items = await fetchAll<CatalogItem>("/v2/catalog/list?types=ITEM", "objects");
    const variations = items
      .filter((item) => !item.is_deleted)
      .flatMap((item) =>
        (item.item_data?.variations ?? [])
          .filter((v) => v.item_variation_data?.track_inventory && v.item_variation_data.sku)
          .map((v) => ({ id: v.id, sku: v.item_variation_data!.sku!, name: item.item_data?.name ?? v.id })),
      );
    if (variations.length === 0) return [];
    const ids = variations.map((v) => v.id);

    const [counts, changes] = await Promise.all([
      fetchAll<{ catalog_object_id: string; quantity?: string }>("/v2/inventory/counts/batch-retrieve", "counts", {
        catalog_object_ids: ids,
        location_ids: [locationId],
        states: ["IN_STOCK"],
      }),
      fetchAll<{ adjustment?: InventoryChange; physical_count?: InventoryChange }>(
        "/v2/inventory/changes/batch-retrieve",
        "changes",
        { catalog_object_ids: ids, location_ids: [locationId], types: ["ADJUSTMENT", "PHYSICAL_COUNT"] },
      ),
    ]);

    const onHand = new Map(counts.map((c) => [c.catalog_object_id, Number(c.quantity ?? 0)]));
    const now = Date.now();
    const since = now - USAGE_WINDOW_DAYS * DAY_MS;
    const used = new Map<string, number>();
    /** Earliest change per variation: where its history starts. */
    const firstSeen = new Map<string, number>();
    /** Latest usage per variation: where its history ends. Measuring to "now" instead would
     * dilute usage every hour no new sale is recorded. */
    const lastUsed = new Map<string, number>();
    for (const change of changes) {
      const c = change.adjustment ?? change.physical_count;
      if (!c?.occurred_at) continue;
      const at = Date.parse(c.occurred_at);
      firstSeen.set(c.catalog_object_id, Math.min(firstSeen.get(c.catalog_object_id) ?? at, at));
      const a = change.adjustment;
      if (!a || at < since || a.from_state !== "IN_STOCK" || !USED_STATES.has(a.to_state ?? "")) continue;
      used.set(a.catalog_object_id, (used.get(a.catalog_object_id) ?? 0) + Number(a.quantity ?? 0));
      lastUsed.set(a.catalog_object_id, Math.max(lastUsed.get(a.catalog_object_id) ?? at, at));
    }
    const historyDays = (id: string) =>
      Math.max(1, ((lastUsed.get(id) ?? now) - Math.max(since, firstSeen.get(id) ?? now)) / DAY_MS);

    return variations.map((v): InventoryItem => {
      // Items added in Square without our config still show up; assume counted units, a year's shelf life.
      const config = ITEM_CONFIG[v.sku] ?? { unit: "each", shelfLifeDays: 365 };
      return {
        sku: v.sku,
        name: v.name,
        quantityOnHand: onHand.get(v.id) ?? 0,
        unit: config.unit,
        dailyUsage: Math.round(((used.get(v.id) ?? 0) / historyDays(v.id)) * 100) / 100,
        shelfLifeDays: config.shelfLifeDays,
      };
    });
  },
};
