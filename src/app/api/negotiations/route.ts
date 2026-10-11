// Negotiations (owner: Person 1, Jake).
// GET  ?orderId=…  every negotiation the agent ran for that order (all distributors, including
//                  no-deals), for the dashboard's transcript view.
// POST             run a standalone negotiation against one listing: the distributor portal's
//                  "test your agent" after changing its policy, and a way to exercise negotiation
//                  before the purchasing agent is wired to it.

import type { NextRequest } from "next/server";
import { errorResponse, HttpError, readJson } from "@/lib/http";
import { negotiateAll, negotiationBatch } from "@/lib/negotiation";
import { store } from "@/lib/store";

/**
 * GET /api/negotiations?orderId=…: every negotiation the purchasing agent ran for that order,
 * including the ones that ended in no deal. `quote` is the signed quote the order pays, so it
 * is only set on the negotiation that won.
 */
export async function GET(request: Request) {
  try {
    const orderId = new URL(request.url).searchParams.get("orderId");
    if (!orderId) throw new HttpError(400, "orderId is required");
    const order = await store.getOrder(orderId);
    if (!order) throw new HttpError(404, `Order ${orderId} not found`);

    const ids = order.negotiationIds ?? (order.negotiationId ? [order.negotiationId] : []);
    const entries = await Promise.all(
      ids.map(async (id) => {
        const negotiation = await store.getNegotiation(id);
        if (!negotiation) return null;
        const won = id === order.negotiationId && order.quoteId;
        return {
          negotiation,
          quote: (won && (await store.getQuote(order.quoteId!))) || null,
          product: (await store.getProduct(negotiation.productId)) ?? null,
          distributor: (await store.getDistributor(negotiation.distributorId)) ?? null,
        };
      }),
    );
    return Response.json({ negotiations: entries.filter((e) => e !== null) });
export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get("orderId");
    if (!orderId) throw new HttpError(400, "orderId is required");
    const order = await store.getOrder(orderId);
    if (!order) throw new HttpError(404, `Order ${orderId} not found`);
    if (!order.negotiationId) return Response.json({ negotiations: [] });

    // The order points at the winning negotiation; its batch holds the others from the same run.
    const batch = negotiationBatch(order.negotiationId);
    const all = await store.listNegotiations();
    const related = batch ? all.filter((n) => negotiationBatch(n.id) === batch) : all.filter((n) => n.id === order.negotiationId);
    const quotes = await store.listQuotes();

    const negotiations = await Promise.all(
      related.map(async (negotiation) => ({
        negotiation,
        quote: quotes.find((q) => q.negotiationId === negotiation.id) ?? null,
        product: (await store.getProduct(negotiation.productId)) ?? null,
        distributor: (await store.getDistributor(negotiation.distributorId)) ?? null,
      })),
    );
    // Winner first, then deals before no-deals.
    const rank = (n: { id: string; status: string }) => (n.id === order.negotiationId ? 0 : n.status === "agreed" ? 1 : 2);
    negotiations.sort((a, b) => rank(a.negotiation) - rank(b.negotiation));
    return Response.json({ negotiations });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { productId, quantity, walkAwayUnitPrice } = await readJson(request);
    if (typeof productId !== "string") throw new HttpError(400, "productId is required");
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
      throw new HttpError(400, "quantity must be a positive integer");
    }
    const product = await store.getProduct(productId);
    if (!product) throw new HttpError(404, `Product ${productId} not found`);
    if (walkAwayUnitPrice !== undefined && (typeof walkAwayUnitPrice !== "number" || walkAwayUnitPrice <= 0)) {
      throw new HttpError(400, "walkAwayUnitPrice must be > 0");
    }

    // Default buyer limit: never pay more than list.
    const [result] = await negotiateAll([{ product, quantity, walkAwayUnitPrice: walkAwayUnitPrice ?? product.unitPrice }]);
    await store.saveNegotiations([result.negotiation]);
    if (result.quote) await store.saveQuotes([result.quote]);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
