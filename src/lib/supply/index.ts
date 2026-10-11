// Supply (owner: Person 1, Jake). Distributor listings for the items the business buys,
// plus supply signals (price changes and news).

import type { Product, Signal } from "@/types";
import { isMockMode } from "@/lib/config";
import { mockSupply } from "./mock";
import { contextDevSupply } from "./real";

export interface SupplySource {
  /** Listings for one item, e.g. "Flour", across all distributors. */
  getProducts(itemName: string): Promise<Product[]>;
  /** Re-scrapes every tracked item and returns the full catalog. */
  refreshCatalog(): Promise<Product[]>;
  /** P1: price-change monitoring + news search for these items, classified per PRD flow E. */
  refreshSignals(itemNames: string[]): Promise<Signal[]>;
}

function source(): SupplySource {
  return isMockMode("supply") ? mockSupply : contextDevSupply;
}

export function getProducts(itemName: string): Promise<Product[]> {
  return source().getProducts(itemName);
}

export function refreshCatalog(): Promise<Product[]> {
  return source().refreshCatalog();
}

export function refreshSignals(itemNames: string[]): Promise<Signal[]> {
  return source().refreshSignals(itemNames);
}
