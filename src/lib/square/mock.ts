// Mock inventory for the test bakery. Several items are running low on purpose
// so the agent has something to do; sugar is well stocked and should be skipped.

import type { InventoryItem } from "@/types";
import type { InventorySource } from "./index";

const ITEMS: InventoryItem[] = [
  { sku: "BAK-FLOUR", name: "Flour", quantityOnHand: 120, unit: "lb", dailyUsage: 25, shelfLifeDays: 180 },
  { sku: "BAK-BUTTER", name: "Butter", quantityOnHand: 20, unit: "lb", dailyUsage: 6, shelfLifeDays: 60 },
  { sku: "BAK-SUGAR", name: "Sugar", quantityOnHand: 260, unit: "lb", dailyUsage: 12, shelfLifeDays: 730 },
  { sku: "BAK-EGGS", name: "Eggs", quantityOnHand: 240, unit: "each", dailyUsage: 90, shelfLifeDays: 14 },
  { sku: "BAK-YEAST", name: "Yeast", quantityOnHand: 1.5, unit: "lb", dailyUsage: 0.4, shelfLifeDays: 120 },
  { sku: "BAK-CHOC-CHIPS", name: "Chocolate chips", quantityOnHand: 12, unit: "lb", dailyUsage: 3.5, shelfLifeDays: 365 },
];

export const mockInventory: InventorySource = {
  async getInventory() {
    return structuredClone(ITEMS);
  },
};
