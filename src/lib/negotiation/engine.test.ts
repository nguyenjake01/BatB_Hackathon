// Run with `npm test`. PRD 7.6: agreed prices never go below the distributor's floor
// or above the buyer's walk-away price.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { DistributorPolicy } from "@/types";
import { distributorTurn, floorPrice, MAX_ROUNDS, runNegotiation } from "./engine.ts";

const policy = (overrides: Partial<DistributorPolicy> = {}): DistributorPolicy => ({
  distributorId: "d1",
  isDefault: true,
  floorPricePct: 0.9,
  concessionRate: 0.3,
  volumeTiers: [{ minQty: 10, discountPct: 0.05 }],
  highStockThreshold: 100,
  autoAccept: false,
  ...overrides,
});

const base = { productName: "Butter 36 lb", distributorName: "Depot", now: () => "2026-10-11T00:00:00.000Z" };

test("agreed price stays within [floor, walk-away] across many inputs", () => {
  let agreed = 0;
  for (const listPrice of [10, 49.99, 112.5, 149, 300]) {
    for (const floorPct of [0.7, 0.85, 0.9, 0.95, 1]) {
      for (const rate of [0.1, 0.3, 0.6, 1]) {
        for (const walkFrac of [0.6, 0.8, 0.9, 0.95, 1, 1.2]) {
          for (const stockQuantity of [undefined, 50, 500]) {
            for (const quantity of [1, 10]) {
              for (const autoAccept of [false, true]) {
                const p = policy({ floorPricePct: floorPct, concessionRate: rate, autoAccept });
                const walkAway = listPrice * walkFrac;
                const out = runNegotiation({
                  ...base,
                  listPrice,
                  quantity,
                  stockQuantity,
                  policy: p,
                  buyerOpening: listPrice * 0.85 * 0.95,
                  walkAway,
                });
                assert.ok(out.messages.length > 0);
                assert.ok(out.messages.every((m) => m.round >= 1 && m.round <= MAX_ROUNDS));
                if (out.status === "agreed") {
                  agreed++;
                  const price = out.agreedUnitPrice!;
                  assert.ok(price >= floorPrice(listPrice, p) - 1e-9, `below floor: ${price} < ${floorPrice(listPrice, p)}`);
                  assert.ok(price <= walkAway + 1e-9, `above walk-away: ${price} > ${walkAway}`);
                } else {
                  assert.equal(out.agreedUnitPrice, undefined);
                }
              }
            }
          }
        }
      }
    }
  }
  assert.ok(agreed > 0, "expected some deals");
});

test("no deal when the floor is above the walk-away price", () => {
  const out = runNegotiation({ ...base, listPrice: 100, quantity: 1, policy: policy(), buyerOpening: 80, walkAway: 85 });
  assert.equal(out.status, "no_deal");
  const lastDistributor = out.messages.filter((m) => m.from === "distributor").at(-1)!;
  assert.ok(lastDistributor.unitPrice >= 90 && lastDistributor.unitPrice > 85);
});

test("distributor never offers below floor, even when conceding fully", () => {
  const turn = distributorTurn({ listPrice: 100, quantity: 1, policy: policy({ concessionRate: 1 }), buyerUnitPrice: 1, lastOfferUnitPrice: 95 });
  assert.equal(turn.unitPrice, 90);
  assert.ok(turn.atFloor);
});

test("opening applies the volume tier and high stock concedes faster", () => {
  const p = policy();
  assert.equal(distributorTurn({ listPrice: 100, quantity: 10, policy: p, buyerUnitPrice: 80 }).unitPrice, 95);
  const normal = distributorTurn({ listPrice: 100, quantity: 1, policy: p, buyerUnitPrice: 80, lastOfferUnitPrice: 100 });
  const high = distributorTurn({ listPrice: 100, quantity: 1, stockQuantity: 500, policy: p, buyerUnitPrice: 80, lastOfferUnitPrice: 100 });
  assert.equal(normal.unitPrice, 94);
  assert.equal(high.unitPrice, 91);
});

test("settles below list when walk-away allows", () => {
  const out = runNegotiation({ ...base, listPrice: 112.5, quantity: 2, stockQuantity: 500, policy: policy(), buyerOpening: 90, walkAway: 110 });
  assert.equal(out.status, "agreed");
  assert.ok(out.agreedUnitPrice! < 112.5);
});
