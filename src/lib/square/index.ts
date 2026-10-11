// Demand (owner: Person 3). The business's current inventory, from Square.

import type { InventoryItem } from "@/types";
import { isMockMode } from "@/lib/config";
import { mockInventory } from "./mock";
import { squareInventory } from "./real";

export interface InventorySource {
  getInventory(): Promise<InventoryItem[]>;
}

export function getInventory(): Promise<InventoryItem[]> {
  return (isMockMode("square") ? mockInventory : squareInventory).getInventory();
}
