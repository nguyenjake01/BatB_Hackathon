// Supply (owner: Person 1). Distributor listings for the items the business buys.

import type { Product } from "@/types";
import { isMockMode } from "@/lib/config";
import { mockSupply } from "./mock";
import { contextDevSupply } from "./real";

export interface SupplySource {
  /** Listings for one item, e.g. "Flour", across all distributors. */
  getProducts(itemName: string): Promise<Product[]>;
  /** Re-scrapes every tracked item and returns the full catalog. */
  refreshCatalog(): Promise<Product[]>;
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
