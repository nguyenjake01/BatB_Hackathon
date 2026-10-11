// Distributor agent endpoint (owner: Person 1, Jake). P1. Spec: docs/PRD.md section 7.6.
// Takes a request for quote (no lastOfferUnitPrice) or a counteroffer and returns this
// distributor agent's next move under its policy. Stateless, so an external agent could
// implement the same contract.

import type { NextRequest } from "next/server";
import { errorResponse, HttpError, readJson } from "@/lib/http";
import { distributorRespond } from "@/lib/negotiation";

const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/distributors/[id]/negotiate">) {
  try {
    const { id } = await ctx.params;
    const { productId, quantity, buyerUnitPrice, lastOfferUnitPrice } = await readJson(request);
    if (typeof productId !== "string" || !productId) throw new HttpError(400, "productId is required");
    if (!positive(quantity) || !Number.isInteger(quantity)) throw new HttpError(400, "quantity must be a positive integer");
    if (!positive(buyerUnitPrice)) throw new HttpError(400, "buyerUnitPrice must be > 0");
    if (lastOfferUnitPrice !== undefined && !positive(lastOfferUnitPrice)) {
      throw new HttpError(400, "lastOfferUnitPrice must be > 0");
    }
    const turn = await distributorRespond(id, { productId, quantity, buyerUnitPrice, lastOfferUnitPrice });
    return Response.json(turn);
  } catch (error) {
    return errorResponse(error);
  }
}
