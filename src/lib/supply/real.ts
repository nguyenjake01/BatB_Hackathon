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
import {
  DISTRIBUTORS,
  LISTING_SCHEMA,
  LISTINGS_PER_SOURCE,
  listingInstructions,
  TRACKED_ITEMS,
  type DistributorSource,
  type TrackedItem,
} from "./catalog";
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
/** Parallel Context.dev requests. The free plan allows 1; set CONTEXT_DEV_CONCURRENCY to your plan's limit. */
const SCRAPE_CONCURRENCY = Math.max(1, Number(process.env.CONTEXT_DEV_CONCURRENCY) || 1);
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

/** Freight-only lots no small business buys. */
const BULK_FREIGHT = /(skids?|pallets?|truckload)/i;

/** A listing belongs to a tracked item when its title names the item and isn't a substitute or a freight lot. */
const belongsTo = (p: Product, item: TrackedItem) =>
  productMatchesItem(p.name, item.itemName) && !item.exclude.test(p.name) && !BULK_FREIGHT.test(p.name);

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

async function scrapeSource(item: TrackedItem, source: DistributorSource): Promise<{ products: Product[]; entry: RefreshReportEntry }> {
  const { itemName, term } = item;
  const url = source.listingUrl(item);
  if (!url) return { products: [], entry: { itemName, distributorId: source.id, url: "", ok: true, count: 0, error: "not carried" } };
  const scrapedAt = new Date().toISOString();
  try {
    const extract = async () => {
      // The baseline searches retail sizes, so don't ask the extractor for bulk ones.
      const wanted = source.isRetailBaseline ? (item.retailTerm ?? term) : term;
      const data = await scrapeJson<{ products?: ScrapedListing[] }>(url, LISTING_SCHEMA, listingInstructions(wanted), {
        waitForMs: source.waitForMs,
      });
      return (data.products ?? [])
        .map((raw) => toProduct(raw, source, url, scrapedAt))
        .filter((p): p is Product => p !== null && belongsTo(p, item))
        .slice(0, LISTINGS_PER_SOURCE);
    };
    // Pages sometimes capture before listings render; one retry (costs another scrape).
    let products = await extract();
    if (products.length === 0) products = await extract();
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
async function scrape(items: TrackedItem[]): Promise<Product[]> {
  const s = state();
  const jobs = items.flatMap((item) => DISTRIBUTORS.map((source) => ({ item, source })));
  const results = await pool(jobs, SCRAPE_CONCURRENCY, ({ item, source }) => scrapeSource(item, source));

  const fresh: Product[] = [];
  results.forEach(({ products, entry }, i) => {
    if (entry.ok && products.length > 0) {
      fresh.push(...products);
    } else {
      // Keep the cached listings for this item/distributor rather than losing them.
      fresh.push(...s.products.filter((p) => p.distributorId === entry.distributorId && belongsTo(p, jobs[i].item)));
    }
  });
  if (results.every((r) => !r.entry.ok)) {
    throw new Error(`Context.dev scraping failed for every source: ${results[0]?.entry.error ?? "unknown error"}`);
  }

  const itemOf = (p: Product) => items.find((i) => belongsTo(p, i))?.itemName;
  s.priceSignals = priceChangeSignals(s.products, fresh, itemOf);
  // Listings for the scraped items are replaced wholesale (`fresh` already carries over failed sources).
  s.products = [...s.products.filter((p) => !items.some((i) => productMatchesItem(p.name, i.itemName))), ...fresh];
  s.scrapedAt = new Date().toISOString();
  // Merge so refreshing one item keeps the other items' report entries.
  const refreshed = new Set(results.map((r) => `${r.entry.itemName}|${r.entry.distributorId}`));
  s.report = [...s.report.filter((e) => !refreshed.has(`${e.itemName}|${e.distributorId}`)), ...results.map((r) => r.entry)];
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
    const tracked = TRACKED_ITEMS.find((i) => productMatchesItem(i.itemName, itemName));
    if (!tracked) return state().products.filter((p) => productMatchesItem(p.name, itemName));
    const cached = state().products.filter((p) => belongsTo(p, tracked));
    if (cached.length > 0) return cached;
    return (await scrape([tracked])).filter((p) => belongsTo(p, tracked));
  },

  async refreshCatalog(itemNames) {
    const items = itemNames?.length ? TRACKED_ITEMS.filter((i) => itemNames.some((n) => productMatchesItem(i.itemName, n))) : TRACKED_ITEMS;
    if (items.length === 0) throw new Error(`No tracked items match ${itemNames?.join(", ")}`);
    await scrape(items);
    return state().products.filter((p) => TRACKED_ITEMS.some((i) => belongsTo(p, i)));
  },

  async refreshSignals(itemNames) {
    const news = await pool(itemNames, SCRAPE_CONCURRENCY, (name) =>
      newsSignals(name).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ),
    );
    const failures = news.filter((r) => r.status === "rejected");
    if (failures.length === news.length && news.length > 0) {
      throw new Error(`Context.dev news search failed: ${errorMessage((failures[0] as { reason: unknown }).reason)}`);
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
