// Run a standalone negotiation against one listing (owner: Person 1, Jake).
// Lets the distributor portal "test your agent" after changing its policy, and lets us
// exercise negotiation before the purchasing agent is wired to it.

import { errorResponse, HttpError, readJson } from "@/lib/http";
import { negotiateAll } from "@/lib/negotiation";
import { store } from "@/lib/store";

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
