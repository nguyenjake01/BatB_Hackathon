// Deterministic negotiation math (PRD section 7.6). Pure functions, no I/O, so the
// bounds can be unit-tested with `npm test`. Prices are USD per pack.

import type { DistributorPolicy, NegotiationMessage } from "@/types";

export const MAX_ROUNDS = 3;
/** Agree when the gap is within this fraction of the distributor's offer. */
export const AGREE_GAP = 0.02;
export const BUYER_TARGET_DISCOUNT = 0.15;
export const BUYER_CONCESSION = 0.3;
/** Distributors concede this much faster when stock is above `highStockThreshold`. */
export const HIGH_STOCK_MULTIPLIER = 1.5;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function floorPrice(listPrice: number, policy: DistributorPolicy): number {
  return round2(listPrice * policy.floorPricePct);
}

/** Best volume-tier discount for `quantity` packs (0 if none applies). */
export function volumeDiscount(quantity: number, policy: DistributorPolicy): number {
  return policy.volumeTiers.filter((t) => quantity >= t.minQty).reduce((best, t) => Math.max(best, t.discountPct), 0);
}

export interface DistributorTurnInput {
  listPrice: number;
  quantity: number;
  stockQuantity?: number;
  policy: DistributorPolicy;
  /** The buyer's latest offer. */
  buyerUnitPrice: number;
  /** This distributor's previous offer; omit on the opening turn. */
  lastOfferUnitPrice?: number;
}

export interface DistributorTurn {
  action: "offer" | "accept";
  unitPrice: number;
  /** True when the offer is pinned at the floor. */
  atFloor: boolean;
}

/** One distributor-agent turn: open, concede toward the buyer, or accept. Never below floor. */
export function distributorTurn(input: DistributorTurnInput): DistributorTurn {
  const { listPrice, quantity, stockQuantity, policy, buyerUnitPrice, lastOfferUnitPrice } = input;
  const floor = floorPrice(listPrice, policy);

  if (policy.autoAccept && buyerUnitPrice >= floor) {
    return { action: "accept", unitPrice: round2(buyerUnitPrice), atFloor: buyerUnitPrice <= floor };
  }

  let price: number;
  if (lastOfferUnitPrice === undefined) {
    price = listPrice * (1 - volumeDiscount(quantity, policy));
  } else {
    const highStock = stockQuantity !== undefined && stockQuantity > policy.highStockThreshold;
    const rate = Math.min(1, policy.concessionRate * (highStock ? HIGH_STOCK_MULTIPLIER : 1));
    price = lastOfferUnitPrice - rate * Math.max(0, lastOfferUnitPrice - buyerUnitPrice);
  }
  price = Math.max(floor, round2(price));
  return { action: "offer", unitPrice: price, atFloor: price <= floor };
}

/** The buyer's next offer: concede a fixed fraction toward the distributor, never above walk-away. */
export function buyerCounter(lastBuyer: number, distributorOffer: number, walkAway: number): number {
  const next = lastBuyer + BUYER_CONCESSION * Math.max(0, distributorOffer - lastBuyer);
  return round2(Math.min(walkAway, next));
}

export function withinAgreeGap(buyer: number, distributor: number): boolean {
  return distributor - buyer <= AGREE_GAP * distributor;
}

export interface NegotiationInput {
  listPrice: number;
  quantity: number;
  stockQuantity?: number;
  policy: DistributorPolicy;
  /** Buyer's opening offer (per pack). */
  buyerOpening: number;
  /** Max per pack the buyer will pay. */
  walkAway: number;
  /** Labels used in message text. */
  productName: string;
  distributorName: string;
  now?: () => string;
}

export interface NegotiationOutcome {
  status: "agreed" | "no_deal";
  agreedUnitPrice?: number;
  messages: NegotiationMessage[];
}

const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * Runs up to MAX_ROUNDS rounds. Each round: the buyer offers, the distributor answers.
 * Agreement: gap within 2% (split the difference, clamped to both sides' limits), or the
 * distributor accepts. In the last round the buyer also takes any distributor offer at or
 * below its walk-away price (rejecting a price inside its own limits would be irrational).
 */
export function runNegotiation(input: NegotiationInput): NegotiationOutcome {
  const { listPrice, quantity, stockQuantity, policy, walkAway, productName, distributorName } = input;
  const now = input.now ?? (() => new Date().toISOString());
  const floor = floorPrice(listPrice, policy);
  const messages: NegotiationMessage[] = [];
  const say = (round: number, from: "buyer" | "distributor", unitPrice: number, text: string) =>
    messages.push({ round, from, unitPrice, text, at: now() });

  let buyer = round2(Math.min(input.buyerOpening, walkAway));
  let distributor: number | undefined;

  const agree = (round: number, price: number, text: string): NegotiationOutcome => {
    const agreed = round2(Math.min(walkAway, Math.max(floor, price)));
    say(round, "buyer", agreed, text.replace("{price}", usd(agreed)));
    return { status: "agreed", agreedUnitPrice: agreed, messages };
  };

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (round === 1) {
      say(round, "buyer", buyer, `Request for quote: ${quantity} × ${productName}. Opening at ${usd(buyer)} per pack.`);
    } else {
      buyer = buyerCounter(buyer, distributor!, walkAway);
      say(round, "buyer", buyer, `I can move to ${usd(buyer)} per pack.`);
    }

    const turn = distributorTurn({ listPrice, quantity, stockQuantity, policy, buyerUnitPrice: buyer, lastOfferUnitPrice: distributor });
    if (turn.action === "accept") {
      say(round, "distributor", turn.unitPrice, `${distributorName} accepts ${usd(turn.unitPrice)} per pack.`);
      return { status: "agreed", agreedUnitPrice: turn.unitPrice, messages };
    }
    distributor = turn.unitPrice;
    const tier = round === 1 && volumeDiscount(quantity, policy) > 0 ? " (volume discount applied)" : "";
    say(
      round,
      "distributor",
      distributor,
      turn.atFloor
        ? `${usd(distributor)} per pack is the lowest ${distributorName} can go.`
        : round === 1
          ? `${distributorName} can offer ${usd(distributor)} per pack${tier}. List is ${usd(listPrice)}.`
          : `${distributorName} can come down to ${usd(distributor)} per pack.`,
    );

    if (withinAgreeGap(buyer, distributor)) {
      return agree(round, (buyer + distributor) / 2, "We're close. Let's split the difference at {price} per pack. Deal.");
    }
    if (round === MAX_ROUNDS && distributor <= walkAway) {
      return agree(round, distributor, "That's within my limit. I accept {price} per pack.");
    }
  }

  say(MAX_ROUNDS, "buyer", buyer, `${usd(distributor!)} is above my limit. I'll look at other distributors.`);
  return { status: "no_deal", messages };
}
