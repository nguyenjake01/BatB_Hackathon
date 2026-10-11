// One-time setup: fills a Square sandbox with the bakery items from mock.ts, plus one day of
// "sold" history so real.ts can derive daily usage. (Square rejects changes more than 24h in
// the past, so a day is all we can backfill.)
//
//   node --env-file=.env.local src/lib/square/seed.mjs
//
// Ends with the same on-hand quantities and daily usage as the mock. Safe to rerun: it reuses
// items it already created and skips any item that already has inventory history.

import { randomUUID } from "node:crypto";
import { getLocationId, ITEM_CONFIG, squareFetch } from "./catalog.ts";
import { mockInventory } from "./mock.ts";

const HOUR_MS = 60 * 60 * 1000;
const LB = "#unit-lb";
// One decimal place, so yeast can be counted as 1.5 lb and used 0.4 lb at a time.
const decimal = (n, unit) => (unit === "each" ? String(Math.round(n)) : n.toFixed(1));

const items = await mockInventory.getInventory();
const locationId = await getLocationId();
console.log(`Location ${locationId}`);

// 1. Catalog: reuse variations that already exist by SKU, create the rest.
const { objects: existing = [] } = await squareFetch("/v2/catalog/list?types=ITEM");
const variationIdBySku = Object.fromEntries(
  existing
    .filter((o) => !o.is_deleted)
    .flatMap((o) => o.item_data?.variations ?? [])
    .map((v) => [v.item_variation_data?.sku, v.id]),
);
const missing = items.filter((item) => !variationIdBySku[item.sku]);
if (missing.length > 0) {
  const { id_mappings = [] } = await squareFetch("/v2/catalog/batch-upsert", {
    method: "POST",
    body: {
      idempotency_key: randomUUID(),
      batches: [
        {
          objects: [
            {
              id: LB,
              type: "MEASUREMENT_UNIT",
              measurement_unit_data: {
                measurement_unit: { type: "TYPE_WEIGHT", weight_unit: "IMPERIAL_POUND" },
                precision: 1,
              },
            },
            ...missing.map((item) => ({
              id: `#item-${item.sku}`,
              type: "ITEM",
              item_data: {
                name: item.name,
                variations: [
                  {
                    id: `#var-${item.sku}`,
                    type: "ITEM_VARIATION",
                    item_variation_data: {
                      item_id: `#item-${item.sku}`,
                      name: "Regular",
                      sku: item.sku,
                      pricing_type: "VARIABLE_PRICING",
                      track_inventory: true,
                      ...(ITEM_CONFIG[item.sku]?.unit === "lb" ? { measurement_unit_id: LB } : {}),
                    },
                  },
                ],
              },
            })),
          ],
        },
      ],
    },
  });
  for (const m of id_mappings) {
    const sku = m.client_object_id.startsWith("#var-") ? m.client_object_id.slice("#var-".length) : null;
    if (sku) variationIdBySku[sku] = m.object_id;
  }
  console.log(`Created ${missing.length} catalog items.`);
}

// 2. Inventory: a stock count 23 hours ago, then one day's usage sold an hour ago,
//    landing exactly on the mock's quantity on hand.
const { changes: history = [] } = await squareFetch("/v2/inventory/changes/batch-retrieve", {
  method: "POST",
  body: { catalog_object_ids: items.map((i) => variationIdBySku[i.sku]), location_ids: [locationId] },
});
const hasHistory = new Set(history.map((c) => (c.adjustment ?? c.physical_count)?.catalog_object_id));

const now = Date.now();
for (const item of items) {
  const variationId = variationIdBySku[item.sku];
  if (hasHistory.has(variationId)) {
    console.log(`${item.name}: already has inventory history, skipped`);
    continue;
  }
  const { counts = [] } = await squareFetch("/v2/inventory/changes/batch-create", {
    method: "POST",
    body: {
      idempotency_key: randomUUID(),
      changes: [
        {
          type: "PHYSICAL_COUNT",
          physical_count: {
            catalog_object_id: variationId,
            location_id: locationId,
            state: "IN_STOCK",
            quantity: decimal(item.quantityOnHand + item.dailyUsage, item.unit),
            occurred_at: new Date(now - 23 * HOUR_MS).toISOString(),
          },
        },
        {
          type: "ADJUSTMENT",
          adjustment: {
            catalog_object_id: variationId,
            from_state: "IN_STOCK",
            to_state: "SOLD",
            from_location_id: locationId,
            to_location_id: locationId,
            quantity: decimal(item.dailyUsage, item.unit),
            occurred_at: new Date(now - HOUR_MS).toISOString(),
          },
        },
      ],
    },
  });
  console.log(`${item.name}: ${counts[0]?.quantity ?? "?"} ${item.unit} in stock`);
}
console.log("Done. Set USE_MOCKS_SQUARE=false in .env.local and restart the dev server.");
