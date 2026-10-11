// Order workflows shared by the API routes.

import type { Order, OrderWithProduct } from "@/types";
import { runAgent } from "@/lib/agent";
import { errorMessage, HttpError } from "@/lib/http";
import { logPurchaseOnChain, payOrder } from "@/lib/payments";
import { getInventory } from "@/lib/square";
import { store } from "@/lib/store";
import { getProducts } from "@/lib/supply";

export async function withProducts(orders: Order[]): Promise<OrderWithProduct[]> {
  return Promise.all(
    orders.map(async (order) => ({ ...order, product: (await store.getProduct(order.productId)) ?? null })),
  );
}

/** Loads inventory, requirements, and listings, runs the agent, and stores its proposals. */
export async function runAgentAndPropose(): Promise<Order[]> {
  const [inventory, requirements] = await Promise.all([getInventory(), store.listRequirements()]);
  const listingsPerItem = await Promise.all(inventory.map((item) => getProducts(item.name)));
  const products = listingsPerItem.flat();
  await store.upsertProducts(products);

  const orders = await runAgent(inventory, requirements, products);
  await store.replaceProposedOrders(orders);
  return orders;
}

/**
 * Approves an order: pays the distributor, then records the purchase on-chain.
 * A failed payment marks the order "failed" (it can be approved again to retry).
 * A failed audit log keeps the order "paid" and returns a warning instead.
 */
export async function approveOrder(id: string): Promise<{ order: Order; warning?: string }> {
  const order = await store.getOrder(id);
  if (!order) throw new HttpError(404, `Order ${id} not found`);
  if (order.status !== "proposed" && order.status !== "failed") {
    throw new HttpError(409, `Order ${id} is already ${order.status}`);
  }

  let current = (await store.updateOrder(id, { status: "approved" }))!;

  try {
    const txHash = await payOrder(current);
    current = (await store.updateOrder(id, { status: "paid", txHash }))!;
  } catch (error) {
    await store.updateOrder(id, { status: "failed" });
    throw error;
  }

  try {
    const auditTxHash = await logPurchaseOnChain(current);
    current = (await store.updateOrder(id, { auditTxHash }))!;
    return { order: current };
  } catch (error) {
    return { order: current, warning: `Paid, but the on-chain audit log failed: ${errorMessage(error)}` };
  }
}
