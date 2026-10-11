import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { withProducts } from "@/lib/orders";
import { store } from "@/lib/store";

/** Orders placed with this distributor (any status), newest first, plus AUSD received. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/distributors/[id]/orders">) {
  try {
    const { id } = await ctx.params;
    const orders = (await store.listOrders()).filter((o) => o.distributorId === id);
    const received = orders.filter((o) => o.status === "paid").reduce((sum, o) => sum + o.totalPrice, 0);
    return Response.json({ orders: await withProducts(orders), receivedAusd: Math.round(received * 100) / 100 });
  } catch (error) {
    return errorResponse(error);
  }
}
