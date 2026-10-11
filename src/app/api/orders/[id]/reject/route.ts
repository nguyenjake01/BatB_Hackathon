import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { rejectOrder, withProducts } from "@/lib/orders";

/** Rejects a proposed order. It stays in the history as "rejected" and is never paid. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/orders/[id]/reject">) {
  try {
    const { id } = await ctx.params;
    const [order] = await withProducts([await rejectOrder(id)]);
    return Response.json({ order });
  } catch (error) {
    return errorResponse(error);
  }
}
