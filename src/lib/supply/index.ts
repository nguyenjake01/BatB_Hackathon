// Supply (owner: Person 1, Jake). Distributor listings for the items the business buys,
// plus supply signals (price changes and news).

import type { Product, Signal } from "@/types";
import { isMockMode } from "@/lib/config";
import { mockSupply } from "./mock";
import { contextDevSupply } from "./real";

/** Outcome of scraping one item at one distributor, for checking which sites Context.dev can read. */
export interface RefreshReportEntry {
  itemName: string;
  distributorId: string;
  url: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface RefreshReport {
  /** When the cached catalog was last scraped (null: never, or mocks). */
  scrapedAt: string | null;
  /** Per-source results of the last refresh in this server process. */
  sources: RefreshReportEntry[];
}

export interface SupplySource {
  /** Listings for one item, e.g. "Flour", across all distributors. Served from cache when possible. */
  getProducts(itemName: string): Promise<Product[]>;
  /** Re-scrapes the given items (default: every tracked item) and returns the full catalog. */
  refreshCatalog(itemNames?: string[]): Promise<Product[]>;
  /** P1: price-change monitoring + news search for these items, classified per PRD flow E. */
  refreshSignals(itemNames: string[]): Promise<Signal[]>;
  refreshReport(): RefreshReport;
}

function source(): SupplySource {
  return isMockMode("supply") ? mockSupply : contextDevSupply;
}

export function getProducts(itemName: string): Promise<Product[]> {
  return source().getProducts(itemName);
}

export function refreshCatalog(itemNames?: string[]): Promise<Product[]> {
  return source().refreshCatalog(itemNames);
}

export function refreshSignals(itemNames: string[]): Promise<Signal[]> {
  return source().refreshSignals(itemNames);
}

export function refreshReport(): RefreshReport {
  return source().refreshReport();
}
