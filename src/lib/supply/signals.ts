// Supply signals (PRD flow E): price changes found by diffing re-scrapes, and news per
// ingredient from Context.dev web search. Fetched text is untrusted data: it's only
// keyword-scored and displayed, never passed to a model as instructions.

import type { Product, Signal } from "@/types";
import { newId } from "@/lib/ids";
import { searchWeb } from "./contextdev";

/** Price moves smaller than this are noise. */
const PRICE_CHANGE_THRESHOLD = 0.03;

const BUY_EARLY_WORDS = [
  "shortage", "surge", "soar", "spike", "rising", "rise", "rises", "increase", "higher", "jump", "record high",
  "tight supply", "outbreak", "avian flu", "bird flu", "drought", "tariff", "scarce", "inflation",
];
const WAIT_WORDS = [
  "drop", "drops", "fall", "falls", "decline", "declines", "plunge", "lower", "glut", "surplus", "ease", "eases", "cheaper",
  "slump", "oversupply", "slip", "slips", "dip", "dips", "retreat", "soften", "tumble",
];

/** Social posts and forums aren't news sources. */
const EXCLUDED_DOMAINS = [
  "facebook.com", "instagram.com", "linkedin.com", "x.com", "twitter.com", "tiktok.com", "reddit.com", "pinterest.com", "youtube.com", "quora.com",
];

const countHits = (text: string, words: string[]) => words.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(text)).length;

/** Keyword heuristic: buy_early when coverage points to rising prices, wait when falling. */
export function classifyNews(text: string): Signal["direction"] {
  const score = countHits(text, BUY_EARLY_WORDS) - countHits(text, WAIT_WORDS);
  return score > 0 ? "buy_early" : score < 0 ? "wait" : "neutral";
}

const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * Compares a fresh scrape with the previous one. A price cut is a good moment to buy
 * (buy_early); a price rise suggests deferring if there's runway (wait).
 */
export function priceChangeSignals(previous: Product[], current: Product[], itemOf: (p: Product) => string | undefined): Signal[] {
  const before = new Map(previous.map((p) => [p.id, p]));
  const detectedAt = new Date().toISOString();
  const signals: Signal[] = [];
  for (const p of current) {
    const old = before.get(p.id);
    const itemName = itemOf(p);
    if (!old || !itemName || old.unitPrice <= 0) continue;
    const change = (p.unitPrice - old.unitPrice) / old.unitPrice;
    if (Math.abs(change) < PRICE_CHANGE_THRESHOLD) continue;
    const pct = `${Math.round(Math.abs(change) * 100)}%`;
    signals.push({
      id: newId("sig"),
      itemName,
      kind: "price_change",
      direction: change < 0 ? "buy_early" : "wait",
      summary: `${p.distributorName} ${change < 0 ? "cut" : "raised"} "${p.name}" ${pct}, from ${usd(old.unitPrice)} to ${usd(p.unitPrice)}.`,
      sourceUrl: p.sourceUrl,
      detectedAt,
    });
  }
  return signals;
}

/** Recent news per item (last month), keyword-classified. Up to 2 signals per item. */
export async function newsSignals(itemName: string): Promise<Signal[]> {
  const results = await searchWeb(`US wholesale ${itemName.toLowerCase()} prices news`, {
    freshness: "last_month",
    numResults: 10,
    country: "us",
    excludeDomains: EXCLUDED_DOMAINS,
  });
  const detectedAt = new Date().toISOString();
  return results
    .filter((r) => r.relevance !== "low")
    .slice(0, 2)
    .map((r) => {
      const title = r.title.trim();
      const description = (r.description ?? "").trim();
      const text = !description || description.toLowerCase().includes(title.toLowerCase()) ? description || title : `${title}: ${description}`;
      const summary = text.replace(/\s+/g, " ").slice(0, 280);
      return {
        id: newId("sig"),
        itemName,
        kind: "news" as const,
        direction: classifyNews(`${r.title} ${r.description}`),
        summary,
        sourceUrl: r.url,
        detectedAt,
      };
    });
}
