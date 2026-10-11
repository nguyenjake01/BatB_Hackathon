// Real agent: the deterministic decision logic of docs/PRD.md section 8.
// Every number in an order and in its reasoning is computed here. Step numbers in the
// comments refer to section 8.
//
// Interpretation notes (the PRD leaves these open):
// - The retail baseline (Costco-style) listing is the yardstick for savings, never a
//   purchase candidate.
// - The reorder rule (step 4) depends on lead time, so it is evaluated with the lead
//   time of the listing the agent would buy at list prices.
// - Out-of-stock listings are skipped whether or not the distributor claimed them.

import type { AutonomySettings, InventoryItem, Negotiation, Order, Product, Quote, Requirement, Signal } from "@/types";
import { NotImplementedError } from "@/lib/config";
import { errorMessage } from "@/lib/http";
import { newId } from "@/lib/ids";
import { productMatchesItem, sameItemName, tokenize } from "@/lib/matching";
import { negotiateAll, type NegotiationResult } from "@/lib/negotiation";
import { signQuote } from "@/lib/quotes";
import { convertUnits } from "@/lib/units";
import type { PurchasingAgent } from "./index";

/** Step 5: each order covers this many days of usage before the caps apply. */
const TARGET_COVER_DAYS = 14;
/** Step 6: a "wait" signal only defers a purchase while stock outlasts lead time by this buffer. */
const WAIT_SAFETY_BUFFER_DAYS = 3;

const STOP_WORDS = new Set(["a", "an", "and", "or", "the", "with", "only", "must", "prefer", "preferred"]);

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Candidate {
  product: Product;
  /** One pack, in the inventory item's unit. */
  packSize: number;
  /** Packs. */
  quantity: number;
  /** Total ordered, in the inventory item's unit. */
  amount: number;
  /** USD per pack: list price, or the agreed price after negotiation. */
  unitPrice: number;
  /** USD at list price, shipping included. */
  listTotal: number;
  /** USD actually charged, shipping included. */
  totalPrice: number;
  /** Step 3: total price per inventory unit, shipping included. */
  landedUnitCost: number;
  arrivesInTime: boolean;
  qualityMatches: number;
  cappedBy: "shelf life" | "budget" | null;
  /** True when a buy_early signal raised the quantity above the target window. */
  raisedForSignal: boolean;
  /** Step 7: max USD per pack the buyer accepts in negotiation. */
  walkAwayUnitPrice: number;
  /** What the retail baseline costs per inventory unit for the same amount, if there is one. */
  baselineUnitCost?: number;
  quote?: Quote;
  negotiation?: Negotiation;
}

interface Plan {
  item: InventoryItem;
  requirement: Requirement;
  daysLeft: number;
  keywords: string[];
  baseline?: Product;
  /** Latest buy_early / wait signal for the item, if any. */
  signal?: Signal;
  listingCount: number;
}

/** An order that still needs the autonomy decision (step 10). */
interface Draft {
  plan: Plan;
  pick: Candidate;
  quote: Quote;
  lines: string[];
  /** Every negotiation run for this item, for the transcript view. */
  negotiationIds: string[];
}

export const llmAgent: PurchasingAgent = {
  async runAgent(ctx) {
    const drafts: Draft[] = [];
    const negotiations: Negotiation[] = [];

    await Promise.all(
      ctx.inventory.map(async (item) => {
        // Section 8 covers items "with a matching Requirement"; the rest are left alone.
        const requirement = ctx.requirements.find((r) => sameItemName(r.itemName, item.name));
        if (!requirement || item.dailyUsage <= 0) return;
        const listings = uniqueById(ctx.products.filter((p) => productMatchesItem(p.name, item.name)));
        const result = await planItem(item, requirement, listings, ctx.signals);
        negotiations.push(...result.negotiations);
        if (result.draft) drafts.push(result.draft);
      }),
    );

    // Most urgent first, so limited auto-buy budget goes to the items closest to running out.
    drafts.sort((a, b) => a.plan.daysLeft - b.plan.daysLeft);

    const createdAt = new Date().toISOString();
    const orders: Order[] = [];
    let committed = ctx.spentLast7Days;
    for (const { plan, pick, quote, lines, negotiationIds } of drafts) {
      const decision = decideAutonomy(pick.totalPrice, ctx.settings, committed);
      if (decision.autoPurchase) committed += pick.totalPrice;

      const baselinePrice = pick.baselineUnitCost === undefined ? undefined : round2(pick.baselineUnitCost * pick.amount);
      orders.push({
        id: newId("ord"),
        productId: pick.product.id,
        distributorId: pick.product.distributorId,
        quantity: pick.quantity,
        totalPrice: pick.totalPrice,
        listTotal: pick.listTotal,
        baselinePrice,
        savingsPct: baselinePrice ? Math.round(((baselinePrice - pick.totalPrice) / baselinePrice) * 10000) / 10000 : undefined,
        reasoning: [...lines, decision.line].join("\n"),
        signalIds: plan.signal ? [plan.signal.id] : [],
        negotiationId: pick.negotiation?.id,
        negotiationIds: negotiationIds.length > 0 ? negotiationIds : undefined,
        quoteId: quote.id,
        status: decision.autoPurchase ? "approved" : "proposed",
        autoPurchased: decision.autoPurchase,
        createdAt,
      });
    }

    return { orders, quotes: drafts.map((d) => d.quote), negotiations };
  },
};

async function planItem(
  item: InventoryItem,
  requirement: Requirement,
  listings: Product[],
  signals: Signal[],
): Promise<{ draft?: Draft; negotiations: Negotiation[] }> {
  const none = { negotiations: [] };
  const plan: Plan = {
    item,
    requirement,
    // Step 1: runway.
    daysLeft: item.quantityOnHand / item.dailyUsage,
    keywords: tokenize(requirement.qualityNotes ?? "").filter((w) => !STOP_WORDS.has(w)),
    baseline: cheapestBaseline(listings, item),
    signal: signals
      .filter((s) => s.direction !== "neutral" && sameItemName(s.itemName, item.name))
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))[0],
    listingCount: listings.filter((p) => !p.isRetailBaseline).length,
  };
  const buyEarly = plan.signal?.direction === "buy_early";

  // Steps 2, 3, 5: candidates sized within shelf life and budget, with landed cost.
  const sized = listings
    .filter((p) => !p.isRetailBaseline && p.inStock)
    .map((p) => sizeCandidate(p, plan, buyEarly))
    .filter((c): c is Candidate => c !== null);
  if (sized.length === 0) return none;

  // Step 2, quality notes: keep the listings that match the most keywords.
  const bestMatch = Math.max(...sized.map((c) => c.qualityMatches));
  const candidates = plan.keywords.length === 0 || bestMatch === 0 ? sized : sized.filter((c) => c.qualityMatches === bestMatch);
  const skippedForQuality = sized.filter((c) => !candidates.includes(c));

  // Step 4: reorder when stock on arrival would be below the minimum.
  const likely = pickBest(candidates);
  const stockOnArrival = item.quantityOnHand - item.dailyUsage * likely.product.leadTimeDays;
  const due = stockOnArrival < requirement.minStockLevel;

  // Step 6: signals move the timing.
  const waitSignal = plan.signal?.direction === "wait";
  if (waitSignal && plan.daysLeft > likely.product.leadTimeDays + WAIT_SAFETY_BUFFER_DAYS) return none;
  if (!due && !buyEarly) return none;

  // Step 7: negotiate with every candidate in parallel; fall back to list prices.
  const negotiated = await negotiate(candidates);
  const negotiations = negotiated?.map((r) => r.negotiation) ?? [];
  const walkedAway: Candidate[] = [];
  const open = candidates.filter((c) => {
    const result = negotiated?.find((r) => r.negotiation.productId === c.product.id);
    if (!result) return true;
    c.negotiation = result.negotiation;
    if (result.negotiation.status !== "agreed" || !result.quote) {
      walkedAway.push(c);
      return false;
    }
    applyQuote(c, result.quote, plan);
    return true;
  });
  if (open.length === 0) {
    console.warn(`[agent] ${item.name}: every negotiation ended in no_deal, so no order was created.`);
    return { negotiations };
  }

  // Step 8: pick. Step 9 (savings) is in the candidate and the reasoning.
  const pick = pickBest(open);
  const quote =
    pick.quote ??
    signQuote({
      productId: pick.product.id,
      distributorId: pick.product.distributorId,
      quantity: pick.quantity,
      unitPrice: pick.unitPrice,
      totalPrice: pick.totalPrice,
    });

  const lines = explain(plan, pick, { open, walkedAway, skippedForQuality, due, stockOnArrival: stockOnArrivalFor(pick, item) });
  return { draft: { plan, pick, quote, lines, negotiationIds: negotiations.map((n) => n.id) }, negotiations };
}

function stockOnArrivalFor(c: Candidate, item: InventoryItem): number {
  return item.quantityOnHand - item.dailyUsage * c.product.leadTimeDays;
}

/** Steps 2, 3, 5 for one listing. Returns null when it can't be bought within the caps. */
function sizeCandidate(product: Product, plan: Plan, raiseToShelfCap: boolean): Candidate | null {
  const { item, requirement, baseline } = plan;
  const packSize = convertUnits(product.unitSize, product.unit, item.unit);
  if (!packSize || packSize <= 0 || product.unitPrice <= 0) return null;

  // Step 5: cover the target window, in whole packs.
  const targetPacks = Math.ceil((item.dailyUsage * TARGET_COVER_DAYS) / packSize - 1e-9);
  let quantity = targetPacks;
  let cappedBy: Candidate["cappedBy"] = null;

  // Shelf-life cap: qty * unitSize <= dailyUsage * shelfLifeDays - quantityOnHand.
  const shelfPacks = Math.floor((item.dailyUsage * item.shelfLifeDays - item.quantityOnHand) / packSize + 1e-9);
  // Step 6: a buy_early signal raises the quantity up to the shelf-life cap.
  if (raiseToShelfCap) quantity = Math.max(quantity, shelfPacks);
  if (quantity > shelfPacks) {
    quantity = shelfPacks;
    cappedBy = "shelf life";
  }

  // Budget cap: totalPrice <= maxBudget (shipping included).
  const budgetPacks = Math.floor((requirement.maxBudget - product.shippingCost) / product.unitPrice + 1e-9);
  if (quantity > budgetPacks) {
    quantity = budgetPacks;
    cappedBy = "budget";
  }
  if (quantity <= 0) return null;
  // A cap that only undid a signal's raise didn't limit the normal order.
  if (quantity === targetPacks) cappedBy = null;

  const amount = quantity * packSize;
  const listTotal = round2(quantity * product.unitPrice + product.shippingCost);
  const productWords = new Set(tokenize(product.name));
  const baselineUnitCost = baseline && landedCostFor(baseline, amount, item);

  // Step 7 / PRD section 20: walk away above the budget cap, or once this listing stops
  // beating the retail baseline on landed cost.
  const budgetWalkAway = (requirement.maxBudget - product.shippingCost) / quantity;
  const baselineWalkAway =
    baselineUnitCost === undefined ? Infinity : (baselineUnitCost * amount - product.shippingCost) / quantity;

  return {
    product,
    packSize,
    quantity,
    amount,
    unitPrice: product.unitPrice,
    listTotal,
    totalPrice: listTotal,
    // Step 3: (unitPrice * qty + shippingCost) / (qty * unitSize).
    landedUnitCost: listTotal / amount,
    arrivesInTime: product.leadTimeDays <= plan.daysLeft,
    qualityMatches: plan.keywords.filter((w) => productWords.has(w)).length,
    cappedBy,
    raisedForSignal: quantity > targetPacks,
    walkAwayUnitPrice: Math.floor(Math.min(budgetWalkAway, baselineWalkAway) * 100) / 100,
    baselineUnitCost,
  };
}

/** Landed cost per inventory unit of buying at least `amount` of the item from `product`. */
function landedCostFor(product: Product, amount: number, item: InventoryItem): number | undefined {
  const packSize = convertUnits(product.unitSize, product.unit, item.unit);
  if (!packSize || packSize <= 0 || product.unitPrice <= 0) return undefined;
  const packs = Math.max(1, Math.ceil(amount / packSize - 1e-9));
  return (packs * product.unitPrice + product.shippingCost) / (packs * packSize);
}

/** The retail baseline for the item: its cheapest baseline listing per unit, ignoring shipping. */
function cheapestBaseline(listings: Product[], item: InventoryItem): Product | undefined {
  const perUnit = (p: Product) => p.unitPrice / (convertUnits(p.unitSize, p.unit, item.unit) || NaN);
  return listings
    .filter((p) => p.isRetailBaseline && Number.isFinite(perUnit(p)))
    .sort((a, b) => perUnit(a) - perUnit(b))[0];
}

/** Step 7. Returns null when negotiation is unavailable, so the caller uses list prices. */
async function negotiate(candidates: Candidate[]): Promise<NegotiationResult[] | null> {
  try {
    return await negotiateAll(
      candidates.map((c) => ({ product: c.product, quantity: c.quantity, walkAwayUnitPrice: c.walkAwayUnitPrice })),
    );
  } catch (error) {
    if (!(error instanceof NotImplementedError)) {
      console.warn(`[agent] Negotiation failed, using list prices: ${errorMessage(error)}`);
    }
    return null;
  }
}

/** Replaces a candidate's list price with the negotiated quote. */
function applyQuote(c: Candidate, quote: Quote, plan: Plan): void {
  c.quote = quote;
  c.quantity = quote.quantity;
  c.amount = quote.quantity * c.packSize;
  c.unitPrice = quote.unitPrice;
  c.totalPrice = quote.totalPrice;
  c.listTotal = round2(quote.quantity * c.product.unitPrice + c.product.shippingCost);
  c.landedUnitCost = quote.totalPrice / c.amount;
  c.baselineUnitCost = plan.baseline && landedCostFor(plan.baseline, c.amount, plan.item);
}

/** Step 8: lowest landed cost among listings that arrive before stockout, else the fastest. */
function pickBest(candidates: Candidate[]): Candidate {
  const byCost = (a: Candidate, b: Candidate) => a.landedUnitCost - b.landedUnitCost;
  const inTime = candidates.filter((c) => c.arrivesInTime);
  return inTime.length > 0
    ? [...inTime].sort(byCost)[0]
    : [...candidates].sort((a, b) => a.product.leadTimeDays - b.product.leadTimeDays || byCost(a, b))[0];
}

/** Step 10. `committed` is what was paid in the last 7 days plus what this run already auto-bought. */
function decideAutonomy(
  totalPrice: number,
  settings: AutonomySettings,
  committed: number,
): { autoPurchase: boolean; line: string } {
  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (settings.mode !== "auto") return { autoPurchase: false, line: "Approval mode is on, so this waits for your approval." };

  if (totalPrice > settings.perOrderLimit) {
    return {
      autoPurchase: false,
      line: `Needs your approval: over the per-order limit (${money(totalPrice)} is above ${money(settings.perOrderLimit)}).`,
    };
  }
  if (committed + totalPrice > settings.weeklyBudget) {
    return {
      autoPurchase: false,
      line:
        `Needs your approval: over the weekly budget (${money(committed)} already spent or committed in the last 7 days ` +
        `plus ${money(totalPrice)} is above ${money(settings.weeklyBudget)}).`,
    };
  }
  return {
    autoPurchase: true,
    line:
      `Approved automatically: within your ${money(settings.perOrderLimit)} per-order limit and ` +
      `${money(settings.weeklyBudget)} weekly budget (${money(committed + totalPrice)} in the last 7 days including this order).`,
  };
}

function uniqueById(products: Product[]): Product[] {
  return [...new Map(products.map((p) => [p.id, p])).values()];
}

interface ExplainContext {
  /** Candidates still in play after negotiation. */
  open: Candidate[];
  walkedAway: Candidate[];
  skippedForQuality: Candidate[];
  due: boolean;
  stockOnArrival: number;
}

/** Why this item, why now, why this distributor, why this quantity, and savings vs the baseline. */
function explain(plan: Plan, pick: Candidate, ctx: ExplainContext): string[] {
  const { item, requirement, daysLeft, keywords, signal, baseline } = plan;
  const p = pick.product;
  const notes = requirement.qualityNotes?.trim() ?? "";

  const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const qty = (n: number) => `${num(n)} ${item.unit === "each" ? item.name.toLowerCase() : item.unit}`;
  const perUnit = (n: number) => (item.unit === "each" ? `${money(n)} each` : `${money(n)}/${item.unit}`);
  const days = (n: number) => `${num(n)} day${n === 1 ? "" : "s"}`;
  const pct = (n: number) => `${Math.round(Math.abs(n) * 100)}%`;
  const packs = (n: number) => `${n} pack${n === 1 ? "" : "s"}`;

  const lines: string[] = [];

  // Why this item.
  lines.push(
    `${item.name}: ${qty(item.quantityOnHand)} on hand, using ${qty(item.dailyUsage)}/day, so about ${days(daysLeft)} left. ` +
      `Your minimum is ${qty(requirement.minStockLevel)}.`,
  );

  // Why now.
  const arrival = `with a ${num(p.leadTimeDays)}-day lead time, stock on arrival would be ${qty(Math.max(0, ctx.stockOnArrival))}`;
  if (signal?.direction === "buy_early") {
    lines.push(
      `Buying early because of a supply signal: ${signal.summary} (source: ${signal.sourceUrl}).` +
        (ctx.due ? ` It was due anyway: ${arrival}, below your minimum.` : ""),
    );
  } else {
    lines.push(`Ordering now: ${arrival}, below your minimum.`);
    if (signal?.direction === "wait") {
      lines.push(
        `A signal suggested waiting: ${signal.summary} (source: ${signal.sourceUrl}). ` +
          `With only ${days(daysLeft)} of stock left, that is too close to the delivery time to wait.`,
      );
    }
  }

  // Why this distributor.
  const shipping = p.shippingCost > 0 ? ` including ${money(p.shippingCost)} shipping` : " with free shipping";
  const listings = `${plan.listingCount} distributor listing${plan.listingCount === 1 ? "" : "s"}`;
  lines.push(
    `Picked ${p.distributorName}: ${p.name} × ${pick.quantity} (${qty(pick.amount)}) for ${money(pick.totalPrice)}${shipping}, ` +
      `${perUnit(pick.landedUnitCost)} landed. ` +
      (pick.arrivesInTime
        ? `Of ${listings}, it has the lowest landed cost among those that fit your requirements and arrive before you run out (${days(p.leadTimeDays)}).`
        : `Warning: ${daysLeft <= 0 ? "you're already out" : `you run out in ${days(daysLeft)}`} and no listing arrives in time, ` +
          `so this is the fastest delivery (${days(p.leadTimeDays)}).`),
  );

  // Negotiation.
  if (pick.quote?.negotiationId && pick.negotiation) {
    const rounds = Math.max(...pick.negotiation.messages.map((m) => m.round), 1);
    lines.push(
      pick.unitPrice < p.unitPrice
        ? `Negotiated with ${p.distributorName}'s agent: ${money(p.unitPrice)} list down to ${money(pick.unitPrice)} per pack ` +
            `in ${rounds} round${rounds === 1 ? "" : "s"}, ${pct(1 - pick.totalPrice / pick.listTotal)} off the ${money(pick.listTotal)} list total.`
        : `Negotiated with ${p.distributorName}'s agent, which held its list price of ${money(p.unitPrice)} per pack.`,
    );
  }
  if (ctx.walkedAway.length > 0) {
    lines.push(
      `No deal with ${ctx.walkedAway.map((c) => c.product.distributorName).join(", ")}: ` +
        `${ctx.walkedAway.length === 1 ? "its agent" : "their agents"} would not go low enough to beat the retail baseline or fit your budget.`,
    );
  }

  // Why this quantity.
  const target = `${TARGET_COVER_DAYS} days of usage (${qty(item.dailyUsage * TARGET_COVER_DAYS)})`;
  const supplyDays = (Math.max(0, ctx.stockOnArrival) + pick.amount) / item.dailyUsage;
  if (pick.raisedForSignal) {
    lines.push(
      `Quantity: raised from ${target} to ${packs(pick.quantity)} (${qty(pick.amount)}) because of the signal, ` +
        (pick.cappedBy === "budget"
          ? `as much as your ${money(requirement.maxBudget)} budget for this item allows.`
          : `the most that can be used within the ${item.shelfLifeDays}-day shelf life.`) +
        ` That leaves about ${days(supplyDays)} of supply on arrival.`,
    );
  } else if (pick.cappedBy === "shelf life") {
    lines.push(
      `Quantity: capped at ${packs(pick.quantity)} (${qty(pick.amount)}) so everything is used within the ` +
        `${item.shelfLifeDays}-day shelf life. That leaves about ${days(supplyDays)} of supply on arrival.`,
    );
  } else if (pick.cappedBy === "budget") {
    lines.push(
      `Quantity: limited to ${packs(pick.quantity)} to stay within your ${money(requirement.maxBudget)} budget for this item. ` +
        `That leaves about ${days(supplyDays)} of supply on arrival.`,
    );
  } else {
    lines.push(
      `Quantity: ${target} rounds up to ${packs(pick.quantity)} of ${qty(pick.packSize)}. ` +
        `That leaves about ${days(supplyDays)} of supply on arrival.`,
    );
  }

  // Savings vs the retail baseline.
  if (baseline && pick.baselineUnitCost !== undefined) {
    const baselinePrice = round2(pick.baselineUnitCost * pick.amount);
    const diff = (baselinePrice - pick.totalPrice) / baselinePrice;
    const ref = `${baseline.distributorName} (${perUnit(pick.baselineUnitCost)} landed, ${money(baselinePrice)} for the same amount)`;
    lines.push(
      diff >= 0
        ? `Savings: ${pct(diff)} cheaper than the retail baseline, ${ref}.`
        : `This costs ${pct(diff)} more than the retail baseline, ${ref}.`,
    );
  }

  // Quality notes.
  if (keywords.length > 0) {
    if (pick.qualityMatches === 0) {
      lines.push(`None of the listings I can order within your budget mention "${notes}", so check quality before approving.`);
    } else {
      const cheaperSkipped = ctx.skippedForQuality
        .filter((c) => c.landedUnitCost < pick.landedUnitCost)
        .sort((a, b) => a.landedUnitCost - b.landedUnitCost)[0];
      lines.push(
        cheaperSkipped
          ? `Skipped a cheaper ${cheaperSkipped.product.distributorName} listing (${perUnit(cheaperSkipped.landedUnitCost)}) because it doesn't match "${notes}".`
          : `Matches your quality notes ("${notes}").`,
      );
    }
  }

  return lines;
}
