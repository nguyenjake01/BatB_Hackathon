import type { NextRequest } from "next/server";
import { errorResponse, HttpError } from "@/lib/http";
import { store } from "@/lib/store";

/** A negotiation transcript plus the quote it produced, if any. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/negotiations/[id]">) {
  try {
    const { id } = await ctx.params;
    const negotiation = await store.getNegotiation(id);
    if (!negotiation) throw new HttpError(404, `Negotiation ${id} not found`);
    const product = (await store.getProduct(negotiation.productId)) ?? null;
    return Response.json({ negotiation, product });
  } catch (error) {
    return errorResponse(error);
  }
}
