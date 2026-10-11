// Run a standalone negotiation against one listing (owner: Person 1, Jake).
// Lets the distributor portal "test your agent" after changing its policy, and lets us
// exercise negotiation before the purchasing agent is wired to it.

import { errorResponse, HttpError, readJson } from "@/lib/http";
import { negotiateAll } from "@/lib/negotiation";
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
