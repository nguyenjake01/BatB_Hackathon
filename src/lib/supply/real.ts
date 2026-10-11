// Real supply source backed by the Context.dev web-scraping API.
//
// Listings: for every tracked item × distributor, Context.dev scrapes the distributor's
// search page and returns structured listings (see ./catalog.ts). Results are cached in
// memory and in catalog-snapshot.json (committed after a real scrape) so the demo doesn't
// depend on live scraping. getProducts() serves the cache; refreshCatalog() re-scrapes.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Product, Signal } from "@/types";
import { errorMessage } from "@/lib/http";
import { productMatchesItem } from "@/lib/matching";
import { normalizeUnit } from "@/lib/units";
import type { RefreshReportEntry, SupplySource } from "./index";
import snapshot from "./catalog-snapshot.json";
import { DISTRIBUTORS, LISTING_SCHEMA, LISTINGS_PER_SOURCE, listingInstructions, TRACKED_ITEMS, type DistributorSource } from "./catalog";
import { scrapeJson } from "./contextdev";
import { newsSignals, priceChangeSignals } from "./signals";

interface ScrapedListing {
  name: string;
  price: number;
  packQuantity: number;
  packUnit: string;
  productUrl?: string | null;
  inStock?: boolean | null;
  shippingCost?: number | null;
  shipsInDays?: number | null;
}

const KNOWN_UNITS = new Set(["lb", "oz", "kg", "g", "each", "dozen"]);
const SCRAPE_CONCURRENCY = 4;
const SNAPSHOT_PATH = path.join(process.cwd(), "src", "lib", "supply", "catalog-snapshot.json");

// Kept on globalThis so dev hot reloads and route bundles share one cache.
const cache = globalThis as unknown as {
  __supply?: { products: Product[]; scrapedAt: string | null; report: RefreshReportEntry[]; priceSignals: Signal[] };
};
function state() {
  return (cache.__supply ??= {
    products: (snapshot.products as Product[]) ?? [],
    scrapedAt: snapshot.scrapedAt,
    report: [],
    priceSignals: [],
  });
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function toProduct(raw: ScrapedListing, source: DistributorSource, searchUrl: string, scrapedAt: string): Product | null {
  const unit = normalizeUnit(raw.packUnit ?? "");
  if (!raw.name || !(raw.price > 0) || !(raw.packQuantity > 0) || !KNOWN_UNITS.has(unit)) return null;
  let sourceUrl = searchUrl;
  if (raw.productUrl) {
    try {
      sourceUrl = new URL(raw.productUrl, source.website).toString();
    } catch {
      // keep the search page URL
    }
  }
  return {
    id: `${source.id}-${slug(raw.name)}`,
    name: raw.name.trim(),
    distributorId: source.id,
    distributorName: source.name,
    unitPrice: Math.round(raw.price * 100) / 100,
    unitSize: raw.packQuantity,
    unit,
    shippingCost: raw.shippingCost ?? source.fallbackShippingCost,
    leadTimeDays: raw.shipsInDays ?? source.fallbackLeadTimeDays,
    inStock: raw.inStock ?? true,
    isRetailBaseline: source.isRetailBaseline,
    sourceUrl,
    scrapedAt,
  };
}

async function scrapeSource(itemName: string, term: string, source: DistributorSource): Promise<{ products: Product[]; entry: RefreshReportEntry }> {
  const url = source.searchUrl(term);
  const scrapedAt = new Date().toISOString();
  try {
    const data = await scrapeJson<{ products?: ScrapedListing[] }>(url, LISTING_SCHEMA, listingInstructions(term));
    const products = (data.products ?? [])
      .map((raw) => toProduct(raw, source, url, scrapedAt))
      .filter((p): p is Product => p !== null && productMatchesItem(p.name, itemName))
      .slice(0, LISTINGS_PER_SOURCE);
    return { products, entry: { itemName, distributorId: source.id, url, ok: true, count: products.length } };
  } catch (error) {
    return { products: [], entry: { itemName, distributorId: source.id, url, ok: false, count: 0, error: errorMessage(error) } };
  }
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Scrapes the given items across all distributors. Failed sources keep their previous listings. */
async function scrape(items: typeof TRACKED_ITEMS): Promise<Product[]> {
  const s = state();
  const jobs = items.flatMap((item) => DISTRIBUTORS.map((source) => ({ item, source })));
  const results = await pool(jobs, SCRAPE_CONCURRENCY, ({ item, source }) => scrapeSource(item.itemName, item.term, source));

  const fresh: Product[] = [];
  results.forEach(({ products, entry }) => {
    if (entry.ok && products.length > 0) {
      fresh.push(...products);
    } else {
      // Keep the cached listings for this item/distributor rather than losing them.
      fresh.push(...s.products.filter((p) => p.distributorId === entry.distributorId && productMatchesItem(p.name, entry.itemName)));
    }
  });
  if (results.every((r) => !r.entry.ok)) {
    throw new Error(`Context.dev scraping failed for every source: ${results[0]?.entry.error ?? "unknown error"}`);
  }

  const itemOf = (p: Product) => items.find((i) => productMatchesItem(p.name, i.itemName))?.itemName;
  s.priceSignals = priceChangeSignals(s.products, fresh, itemOf);
  // Listings for the scraped items are replaced wholesale (`fresh` already carries over failed sources).
  s.products = [...s.products.filter((p) => !items.some((i) => productMatchesItem(p.name, i.itemName))), ...fresh];
  s.scrapedAt = new Date().toISOString();
  s.report = results.map((r) => r.entry);
  await saveSnapshot();
  return fresh;
}

/** Persists the cache so the next server start (and the demo) has real data. Fails quietly on read-only hosts. */
async function saveSnapshot() {
  const s = state();
  try {
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify({ scrapedAt: s.scrapedAt, products: s.products }, null, 2)}\n`);
  } catch (error) {
    console.warn(`Could not write catalog snapshot (fine on Vercel): ${errorMessage(error)}`);
  }
}

export const contextDevSupply: SupplySource = {
  async getProducts(itemName) {
    const cached = state().products.filter((p) => productMatchesItem(p.name, itemName));
    if (cached.length > 0) return cached;
    const tracked = TRACKED_ITEMS.find((i) => productMatchesItem(i.itemName, itemName));
    if (!tracked) return [];
    return (await scrape([tracked])).filter((p) => productMatchesItem(p.name, itemName));
  },

  async refreshCatalog() {
    await scrape(TRACKED_ITEMS);
    return state().products;
  },

  async refreshSignals(itemNames) {
    const news = await Promise.allSettled(itemNames.map((name) => newsSignals(name)));
    const failures = news.filter((r) => r.status === "rejected");
    if (failures.length === news.length && news.length > 0) {
      throw new Error(`Context.dev news search failed: ${errorMessage((failures[0] as PromiseRejectedResult).reason)}`);
    }
    const wanted = new Set(itemNames.map((n) => n.toLowerCase()));
    return [
      ...state().priceSignals.filter((s) => wanted.has(s.itemName.toLowerCase())),
      ...news.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
    ];
  },

  refreshReport() {
    return { scrapedAt: state().scrapedAt, sources: state().report };
  },
};
