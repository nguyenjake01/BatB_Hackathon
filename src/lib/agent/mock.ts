// Rule-based agent (the mock). No LLM, but the logic is real: it projects when
// each item runs low, filters listings by the owner's requirements, scores them by
// landed cost (price + shipping) and lead time, sizes the order within shelf life
// and budget, and explains the choice in plain language.
//
// Known gaps vs docs/PRD.md section 8 (Person 2 to fix in the real agent):
// reorder trigger uses a 7-day horizon instead of `onHand - usage * lead < min`;
// ranking adds 2%/day of lead time instead of pure landed cost; target window is
// min + 14 days instead of 14 days; no signals, negotiation, savings fields, or autonomy.

import type { InventoryItem, Order, Product, Quote, Requirement } from "@/types";
import { newId } from "@/lib/ids";
import { signQuote } from "@/lib/quotes";
import { productMatchesItem, sameItemName, tokenize } from "@/lib/matching";
import { convertUnits } from "@/lib/units";
import type { PurchasingAgent } from "./index";

/** Reorder when stock is projected to reach the minimum within this many days. */
const REORDER_HORIZON_DAYS = 7;
/** Each order aims to leave this many days of usage on top of the minimum stock level. */
const TARGET_COVER_DAYS = 14;
/** Minimum stock for items without a requirement, in days of usage. */
const DEFAULT_MIN_STOCK_DAYS = 7;
/** Each day of lead time adds 2% to a listing's effective cost when ranking. */
const LEAD_TIME_WEIGHT = 0.02;

const STOP_WORDS = new Set(["a", "an", "and", "or", "the", "with", "only", "must", "prefer", "preferred"]);

interface Candidate {
  product: Product;
  packs: number;
  /** Total ordered, in the inventory item's unit. */
  amount: number;
  totalPrice: number;
  /** Total price per inventory unit, shipping included. */
  landedUnitCost: number;
  stockAtArrival: number;
  arrivesInTime: boolean;
  qualityMatches: number;
  cappedBy: "shelf life" | "budget" | null;
}

interface Plan {
  item: InventoryItem;
  requirement: Requirement | undefined;
  minStock: number;
  maxBudget: number;
  daysLeft: number;
  keywords: string[];
}

export const ruleBasedAgent: PurchasingAgent = {
  async runAgent({ inventory, requirements, products }) {
    const createdAt = new Date().toISOString();
    const orders: Order[] = [];
    const quotes: Quote[] = [];
    for (const item of inventory) {
      const requirement = requirements.find((r) => sameItemName(r.itemName, item.name));
      const listings = uniqueById(products.filter((p) => productMatchesItem(p.name, item.name)));
      const order = planItem(item, requirement, listings, createdAt);
      if (!order) continue;
      // List-price quote, so the checkout has a signed amount to charge.
      const product = listings.find((p) => p.id === order.productId)!;
      const quote = signQuote({
        productId: order.productId,
        distributorId: order.distributorId,
        quantity: order.quantity,
        unitPrice: product.unitPrice,
        totalPrice: order.totalPrice,
      });
      quotes.push(quote);
      orders.push({ ...order, quoteId: quote.id });
    }
    return { orders, quotes, negotiations: [] };
  },
};

function planItem(
  item: InventoryItem,
  requirement: Requirement | undefined,
  listings: Product[],
  createdAt: string,
): Order | null {
  const usage = item.dailyUsage;
  if (usage <= 0) return null;

  const plan: Plan = {
    item,
    requirement,
    minStock: requirement?.minStockLevel ?? usage * DEFAULT_MIN_STOCK_DAYS,
    maxBudget: requirement?.maxBudget ?? Infinity,
    daysLeft: item.quantityOnHand / usage,
    keywords: tokenize(requirement?.qualityNotes ?? "").filter((w) => !STOP_WORDS.has(w)),
  };

  // Enough stock to stay above the minimum for the whole horizon: nothing to do yet.
  const daysUntilMin = (item.quantityOnHand - plan.minStock) / usage;
  if (daysUntilMin > REORDER_HORIZON_DAYS) return null;

  // Candidates that fit the unit, shelf life, and budget.
  const candidates = listings.map((p) => buildCandidate(p, plan)).filter((c): c is Candidate => c !== null);
  if (candidates.length === 0) return null;

  // Quality: keep the listings that match the most quality keywords.
  const bestMatch = Math.max(...candidates.map((c) => c.qualityMatches));
  const qualityOk =
    plan.keywords.length === 0 || bestMatch === 0
      ? candidates
      : candidates.filter((c) => c.qualityMatches === bestMatch);

  // Timing: prefer listings that arrive before stock runs out. If none do, take the fastest.
  const inTime = qualityOk.filter((c) => c.arrivesInTime);
  const best =
    inTime.length > 0
      ? [...inTime].sort((a, b) => score(a) - score(b))[0]
      : [...qualityOk].sort((a, b) => a.product.leadTimeDays - b.product.leadTimeDays || score(a) - score(b))[0];

  return {
    id: newId("ord"),
    productId: best.product.id,
    distributorId: best.product.distributorId,
    quantity: best.packs,
    totalPrice: best.totalPrice,
    reasoning: explain(plan, best, candidates, qualityOk, listings.length),
    signalIds: [],
    status: "proposed",
    autoPurchased: false,
    createdAt,
  };
}

function buildCandidate(product: Product, plan: Plan): Candidate | null {
  const { item, minStock, maxBudget, daysLeft, keywords } = plan;
  const packSize = convertUnits(product.unitSize, product.unit, item.unit);
  if (!packSize || packSize <= 0 || product.unitPrice <= 0) return null;

  const usage = item.dailyUsage;
  const lead = product.leadTimeDays;
  const stockAtArrival = Math.max(0, item.quantityOnHand - usage * lead);
  const needed = minStock + usage * TARGET_COVER_DAYS - stockAtArrival;
  if (needed <= 0) return null;

  let packs = Math.ceil(needed / packSize);
  let cappedBy: Candidate["cappedBy"] = null;

  // Don't buy more than can be used before it expires.
  const shelfCapacity = usage * item.shelfLifeDays - stockAtArrival;
  if (packs * packSize > shelfCapacity) {
    packs = Math.floor(shelfCapacity / packSize);
    cappedBy = "shelf life";
  }

  const affordablePacks = Math.floor((maxBudget - product.shippingCost) / product.unitPrice);
  if (packs > affordablePacks) {
    packs = affordablePacks;
    cappedBy = "budget";
  }

  if (packs <= 0) return null;

  const amount = packs * packSize;
  const totalPrice = Math.round((packs * product.unitPrice + product.shippingCost) * 100) / 100;
  const productWords = new Set(tokenize(product.name));

  return {
    product,
    packs,
    amount,
    totalPrice,
    landedUnitCost: totalPrice / amount,
    stockAtArrival,
    arrivesInTime: lead <= daysLeft,
    qualityMatches: keywords.filter((w) => productWords.has(w)).length,
    cappedBy,
  };
}

/** Effective cost per unit: landed cost, nudged up for slower delivery. Lower is better. */
function score(c: Candidate): number {
  return c.landedUnitCost * (1 + LEAD_TIME_WEIGHT * c.product.leadTimeDays);
}

function isBaseline(product: Product): boolean {
  return product.isRetailBaseline;
}

function uniqueById(products: Product[]): Product[] {
  return [...new Map(products.map((p) => [p.id, p])).values()];
}

function explain(plan: Plan, best: Candidate, candidates: Candidate[], qualityOk: Candidate[], listingCount: number): string {
  const { item, requirement, minStock, maxBudget, daysLeft, keywords } = plan;
  const p = best.product;
  const notes = requirement?.qualityNotes?.trim() ?? "";

  const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const qty = (n: number) => `${num(n)} ${item.unit === "each" ? item.name.toLowerCase() : item.unit}`;
  const perUnit = (n: number) => (item.unit === "each" ? `${money(n)} each` : `${money(n)}/${item.unit}`);
  const days = (n: number) => `${num(n)} day${n === 1 ? "" : "s"}`;
  const pct = (n: number) => `${Math.round(Math.abs(n) * 100)}%`;

  const lines: string[] = [];

  lines.push(
    `${item.name}: ${qty(item.quantityOnHand)} on hand, using ${qty(item.dailyUsage)}/day, so about ${days(daysLeft)} left. ` +
      (requirement
        ? `Your minimum is ${qty(minStock)}.`
        : `No requirement set, so I used a minimum of ${DEFAULT_MIN_STOCK_DAYS} days of usage (${qty(minStock)}).`),
  );

  lines.push(
    `Best of ${listingCount} listing${listingCount === 1 ? "" : "s"}: ${p.distributorName}, ${p.name} × ${best.packs} ` +
      `(${qty(best.amount)}) for ${money(best.totalPrice)}` +
      (p.shippingCost > 0 ? ` including ${money(p.shippingCost)} shipping` : " with free shipping") +
      `, ${perUnit(best.landedUnitCost)} landed.`,
  );

  if (best.arrivesInTime) {
    lines.push(`Arrives in ${days(p.leadTimeDays)}, before you run out.`);
  } else {
    const when = daysLeft <= 0 ? "You're already out" : `You run out in ${days(daysLeft)}`;
    lines.push(`Warning: ${when} and no listing arrives in time, so I picked the fastest delivery (${days(p.leadTimeDays)}).`);
  }

  const baseline = candidates.find((c) => c !== best && isBaseline(c.product));
  if (isBaseline(p)) {
    lines.push("This is the Costco baseline, the best overall on landed cost and delivery time.");
  } else if (baseline) {
    const diff = (baseline.landedUnitCost - best.landedUnitCost) / baseline.landedUnitCost;
    const ref = `the Costco baseline (${perUnit(baseline.landedUnitCost)})`;
    if (diff >= 0) {
      lines.push(`That's ${pct(diff)} cheaper per ${item.unit === "each" ? "unit" : item.unit} than ${ref}.`);
    } else {
      const why = !qualityOk.includes(baseline)
        ? "Costco's listing doesn't match your quality notes"
        : !baseline.arrivesInTime
          ? "Costco wouldn't arrive before you run out"
          : "it arrives sooner";
      lines.push(`It costs ${pct(diff)} more than ${ref}, but ${why}.`);
    }
  }

  if (keywords.length > 0) {
    if (qualityOk.length === candidates.length && best.qualityMatches === 0) {
      lines.push(`No listing mentions "${notes}", so check quality before approving.`);
    } else {
      const cheaperSkipped = candidates
        .filter((c) => !qualityOk.includes(c) && c.landedUnitCost < best.landedUnitCost)
        .sort((a, b) => a.landedUnitCost - b.landedUnitCost)[0];
      lines.push(
        cheaperSkipped
          ? `Skipped a cheaper ${cheaperSkipped.product.distributorName} listing (${perUnit(cheaperSkipped.landedUnitCost)}) because it doesn't match "${notes}".`
          : `Matches your quality notes ("${notes}").`,
      );
    }
  }

  const supplyDays = (best.stockAtArrival + best.amount) / item.dailyUsage;
  if (best.cappedBy === "shelf life") {
    lines.push(`Capped at ${qty(best.amount)} so it's used within the ${item.shelfLifeDays}-day shelf life (about ${days(supplyDays)} of supply).`);
  } else if (best.cappedBy === "budget") {
    lines.push(`Limited to ${best.packs} to stay within your ${money(maxBudget)} budget. That's only about ${days(supplyDays)} of supply, so consider raising the budget.`);
  } else {
    lines.push(`Brings you to about ${days(supplyDays)} of supply.`);
  }

  return lines.join("\n");
}
