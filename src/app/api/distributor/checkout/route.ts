// Mock distributor checkout (owner: Person 2).
// Stands in for a distributor that accepts AUSD over x402. The agent's payOrder()
// will call this endpoint once real payments are wired up.

import { errorResponse, HttpError, readJson } from "@/lib/http";
import { newId } from "@/lib/ids";
import { store } from "@/lib/store";

export async function POST(request: Request) {
  try {
    // TODO(Person 2): Put this handler behind x402 payment middleware (AUSD on Base Sepolia).
    // Without a valid payment it should answer 402 with the payment requirements for the order
    // total; with one, verify/settle the payment before confirming the order below.
    const body = await readJson(request);
    const { productId, quantity } = body;
    if (typeof productId !== "string" || !productId) {
      throw new HttpError(400, "productId is required");
    }
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
      throw new HttpError(400, "quantity must be a positive integer");
    }

    const product = await store.getProduct(productId);
    if (!product) throw new HttpError(404, `Unknown product ${productId}`);

    const amountDue = Math.round((product.unitPrice * quantity + product.shippingCost) * 100) / 100;
    return Response.json({
      confirmationId: newId("conf"),
      status: "confirmed",
      distributor: product.distributor,
      productId,
      quantity,
      amountDue,
      currency: "AUSD",
      estimatedDelivery: new Date(Date.now() + product.leadTimeDays * 86_400_000).toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
