// Agent-to-agent negotiation (owner: Person 1, Jake). P1. Spec: docs/PRD.md section 7.6.
//
// Both agents run in our backend, but the distributor agent sits behind
// POST /api/distributors/[id]/negotiate so a distributor could host their own later.
// No mock/real switch: the concession math is deterministic and has no external calls.
//
// Contract with the agent (Person 2): the agent calls `negotiateAll` at PRD section 8
// step 7 with every candidate. Results with status "agreed" come with a signed quote
// (see "@/lib/quotes"); "no_deal" candidates are dropped. If this throws
// NotImplementedError, the agent falls back to list-price quotes.

import type { Negotiation, Product, Quote } from "@/types";
import { NotImplementedError } from "@/lib/config";

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

/** Negotiates with every candidate in parallel (max 3 rounds each). */
export async function negotiateAll(candidates: NegotiationCandidate[]): Promise<NegotiationResult[]> {
  // TODO(Person 1): Buyer agent (opening = lowest list price per item unit among candidates,
  // minus 15%, converted back to this pack; concede 30% of the gap per round) talks to each
  // distributor agent via its policy (store.getPolicy). Agree within 2% (split the difference),
  // else no_deal. Template message text; hash the transcript (transcriptHash); sign the quote
  // with signQuote. Unit-test: agreed price >= floor and <= walkAwayUnitPrice.
  throw new NotImplementedError(`negotiateAll(${candidates.length} candidates)`, "negotiation");
}
