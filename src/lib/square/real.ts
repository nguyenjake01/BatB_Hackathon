// Real inventory source backed by the Square Inventory API (sandbox first).

import { NotImplementedError } from "@/lib/config";
import type { InventorySource } from "./index";

export const squareInventory: InventorySource = {
  async getInventory() {
    // TODO(Person 3): Fetch catalog items and inventory counts from the Square Inventory API
    // (process.env.SQUARE_ACCESS_TOKEN, process.env.SQUARE_ENVIRONMENT = "sandbox") and map
    // them to `InventoryItem`. Square doesn't track daily usage or shelf life, so derive
    // dailyUsage from recent inventory changes/sales and keep shelfLifeDays in our own config.
    throw new NotImplementedError("Square getInventory()", "square");
  },
};
