// Agent-to-agent negotiation (owner: Person 1, Jake). P1. Spec: docs/PRD.md section 7.6.
//
// Both agents run in our backend, but the distributor agent also sits behind
// POST /api/distributors/[id]/negotiate (see `distributorRespond`) so a distributor could
// host their own later. No mock/real switch: the math is deterministic with no external calls.
//
// Contract with the agent (Person 2): the agent calls `negotiateAll` at PRD section 8
// step 7 with every candidate. Results with status "agreed" come with a signed quote
// (see "@/lib/quotes"); "no_deal" candidates are dropped.

import { createHash } from "node:crypto";
import type { Negotiation, NegotiationMessage, Product, Quote } from "@/types";
import { HttpError } from "@/lib/http";
import { newId } from "@/lib/ids";
import { signQuote } from "@/lib/quotes";
import { store } from "@/lib/store";
import { convertUnits } from "@/lib/units";
import { BUYER_TARGET_DISCOUNT, distributorTurn, round2, runNegotiation, type DistributorTurn } from "./engine";

export interface NegotiationCandidate {
  product: Product;
  /** Packs the buyer wants. */
  quantity: number;
  /**
   * Max USD per pack the buyer accepts: the lower of the budget cap
   * ((maxBudget - shippingCost) / quantity) and the price at which this listing's landed
   * cost per item unit equals the retail baseline's. Computed by the agent.
   */
  walkAwayUnitPrice: number;
}

export interface NegotiationResult {
  negotiation: Negotiation;
  /** Set when `negotiation.status === "agreed"`. */
  quote?: Quote;
}

export function transcriptHash(messages: NegotiationMessage[]): string {
  const canonical = messages.map((m) => [m.round, m.from, m.unitPrice, m.text]);
  return `0x${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}

/**
 * Buyer opening offers: the lowest list price per item unit among all candidates,
 * minus the target discount, converted back to each candidate's pack size.
 */
export function buyerOpenings(candidates: NegotiationCandidate[]): number[] {
  const unit = candidates[0]?.product.unit;
  const perUnit = candidates.map(({ product }) => {
    const size = unit ? convertUnits(product.unitSize, product.unit, unit) : null;
    return size && size > 0 ? product.unitPrice / size : null;
  });
  const known = perUnit.filter((p): p is number => p !== null);
  const lowest = known.length > 0 ? Math.min(...known) : null;

  return candidates.map(({ product }, i) => {
    const size = unit ? convertUnits(product.unitSize, product.unit, unit) : null;
    const reference = lowest !== null && size && perUnit[i] !== null ? lowest * size : product.unitPrice;
    return round2(reference * (1 - BUYER_TARGET_DISCOUNT));
  });
}

/**
 * Negotiations from one `negotiateAll` call share an id prefix (`neg_<batch>_<n>`), so the
 * UI can show every distributor the buyer talked to for an order, including no-deals.
 */
export function negotiationBatch(negotiationId: string): string | null {
  const match = /^(neg_[a-z0-9]+)_\d+$/.exec(negotiationId);
  return match ? match[1] : null;
}

/** Negotiates with every candidate in parallel (max 3 rounds each). */
export async function negotiateAll(candidates: NegotiationCandidate[]): Promise<NegotiationResult[]> {
  const openings = buyerOpenings(candidates);
  const batch = newId("neg");
  return Promise.all(
    candidates.map(async ({ product, quantity, walkAwayUnitPrice }, i): Promise<NegotiationResult> => {
      const policy = await store.getPolicy(product.distributorId);
      const outcome = runNegotiation({
        listPrice: product.unitPrice,
        quantity,
        stockQuantity: product.stockQuantity,
        policy,
        buyerOpening: openings[i],
        walkAway: walkAwayUnitPrice,
        productName: product.name,
        distributorName: product.distributorName,
      });

      const negotiation: Negotiation = {
        id: `${batch}_${i}`,
        productId: product.id,
        distributorId: product.distributorId,
        quantity,
        messages: outcome.messages,
        status: outcome.status,
        agreedUnitPrice: outcome.agreedUnitPrice,
        transcriptHash: transcriptHash(outcome.messages),
      };
      if (outcome.status !== "agreed") return { negotiation };

      const unitPrice = outcome.agreedUnitPrice!;
      const quote = signQuote({
        negotiationId: negotiation.id,
        productId: product.id,
        distributorId: product.distributorId,
        quantity,
        unitPrice,
        totalPrice: round2(unitPrice * quantity + product.shippingCost),
      });
      return { negotiation, quote };
    }),
  );
}

export interface DistributorRequest {
  productId: string;
  quantity: number;
  /** The buyer's current offer per pack. */
  buyerUnitPrice: number;
  /** This distributor's previous offer; omit to request an opening quote. */
  lastOfferUnitPrice?: number;
}

/** The distributor agent's single turn, as served by POST /api/distributors/[id]/negotiate. */
export async function distributorRespond(distributorId: string, req: DistributorRequest): Promise<DistributorTurn> {
  const product = await store.getProduct(req.productId);
  if (!product || product.distributorId !== distributorId) {
    throw new HttpError(404, `Product ${req.productId} not found for ${distributorId}`);
  }
  if (!product.inStock) throw new HttpError(409, `${product.name} is out of stock`);
  return distributorTurn({
    listPrice: product.unitPrice,
    quantity: req.quantity,
    stockQuantity: product.stockQuantity,
    policy: await store.getPolicy(distributorId),
    buyerUnitPrice: req.buyerUnitPrice,
    lastOfferUnitPrice: req.lastOfferUnitPrice,
  });
}
