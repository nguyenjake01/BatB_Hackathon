import { errorResponse } from "@/lib/http";
import { runAgentAndPropose, withProducts } from "@/lib/orders";

/** Runs the agent and replaces any pending proposals with fresh ones. */
export async function POST() {
  try {
    const orders = await runAgentAndPropose();
    return Response.json({ orders: await withProducts(orders) });
  } catch (error) {
    return errorResponse(error);
  }
}
