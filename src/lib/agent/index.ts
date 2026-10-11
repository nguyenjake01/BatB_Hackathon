// Purchasing agent (owner: Person 2). Turns inventory + requirements + listings
// into proposed orders with plain-language reasoning.

import type { InventoryItem, Order, Product, Requirement } from "@/types";
import { isMockMode } from "@/lib/config";
import { ruleBasedAgent } from "./mock";
import { llmAgent } from "./real";

export interface PurchasingAgent {
  /** Returns one "proposed" order per item that needs restocking. */
  runAgent(inventory: InventoryItem[], requirements: Requirement[], products: Product[]): Promise<Order[]>;
}

export function runAgent(
  inventory: InventoryItem[],
  requirements: Requirement[],
  products: Product[],
): Promise<Order[]> {
  const agent = isMockMode("agent") ? ruleBasedAgent : llmAgent;
  return agent.runAgent(inventory, requirements, products);
}
