// Purchasing agent (owner: Person 2, Jason). Turns inventory + requirements + listings
// (+ signals, settings, negotiation) into orders with plain-language reasoning.
// Spec: docs/PRD.md section 8. Numbers always come from code; an LLM may only rephrase.

import type { AutonomySettings, InventoryItem, Negotiation, Order, Product, Quote, Requirement, Signal } from "@/types";
import { isMockMode } from "@/lib/config";
import { ruleBasedAgent } from "./mock";
import { llmAgent } from "./real";

export interface AgentContext {
  inventory: InventoryItem[];
  requirements: Requirement[];
  products: Product[];
  signals: Signal[];
  settings: AutonomySettings;
  /** USD paid in the rolling 7-day window, for the weekly budget. */
  spentLast7Days: number;
}

export interface AgentResult {
  /**
   * One order per item to restock. Status "proposed", or "approved" with
   * autoPurchased: true when auto mode is on and both limits allow it; the caller
   * (src/lib/orders.ts) pays "approved" orders immediately.
   */
  orders: Order[];
  /** One signed quote per order (`order.quoteId`): negotiated, or at list price. */
  quotes: Quote[];
  /** Every negotiation run, including no_deal ones (for the transcript view). */
  negotiations: Negotiation[];
}

export interface PurchasingAgent {
  runAgent(ctx: AgentContext): Promise<AgentResult>;
}

export function runAgent(ctx: AgentContext): Promise<AgentResult> {
  const agent = isMockMode("agent") ? ruleBasedAgent : llmAgent;
  return agent.runAgent(ctx);
}
