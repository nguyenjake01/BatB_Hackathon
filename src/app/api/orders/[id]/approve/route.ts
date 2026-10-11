import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { approveOrder, withProducts } from "@/lib/orders";

/** Pays for the order, logs it on-chain, and returns the updated order. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/orders/[id]/approve">) {
  try {
    const { id } = await ctx.params;
    const { order, warning } = await approveOrder(id);
    const [withProduct] = await withProducts([order]);
    return Response.json({ order: withProduct, warning });
  } catch (error) {
    return errorResponse(error);
  }
}
