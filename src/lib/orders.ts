// Order workflows shared by the API routes.

import type { Order, OrderWithProduct } from "@/types";
import { runAgent } from "@/lib/agent";
import { isMockMode } from "@/lib/config";
import { errorMessage, HttpError } from "@/lib/http";
import { logPurchaseOnChain, payOrder } from "@/lib/payments";
import { getInventory } from "@/lib/square";
import { store } from "@/lib/store";
import { getProducts } from "@/lib/supply";

export async function withProducts(orders: Order[]): Promise<OrderWithProduct[]> {
  return Promise.all(
    orders.map(async (order) => ({
      ...order,
      product: (await store.getProduct(order.productId)) ?? null,
      distributor: (await store.getDistributor(order.distributorId)) ?? null,
    })),
  );
}

/**
 * Loads inventory, requirements, listings, signals, and settings, runs the agent, and
 * stores its orders. Orders the agent auto-approved (auto mode, within limits) are paid
 * right away; the returned list reflects their final status.
 */
export async function runAgentAndPropose(): Promise<Order[]> {
  const [inventory, requirements, signals, settings, spentLast7Days] = await Promise.all([
    getInventory(),
    store.listRequirements(),
    store.listSignals(),
    store.getSettings(),
    store.spentLast7Days(),
  ]);
  const listings = (await Promise.all(inventory.map((item) => getProducts(item.name)))).flat();
  await store.upsertProducts(listings);
  // Keep scraped listings plus any listing a claimed distributor added itself in the portal.
  const claimed = new Set((await store.listDistributors()).filter((d) => d.claimed).map((d) => d.id));
  const ownListings = (await store.listProducts()).filter((p) => claimed.has(p.distributorId)).map((p) => p.id);
  await store.retainProducts([...listings.map((p) => p.id), ...ownListings]);
  // Read back from the store so distributor edits to claimed listings apply.
  const products = await store.listProducts();

  const { orders, quotes, negotiations } = await runAgent({
    inventory,
    requirements,
    products,
    signals,
    settings,
    spentLast7Days,
  });
  await store.saveQuotes(quotes);
  await store.saveNegotiations(negotiations);
  await store.replaceProposedOrders(orders);

  const results: Order[] = [];
  for (const order of orders) {
    if (order.status !== "approved") {
      results.push(order);
      continue;
    }
    try {
      results.push((await payAndLog(order)).order);
    } catch {
      results.push((await store.getOrder(order.id)) ?? order);
    }
  }
  return results;
}

/** Approves a proposed (or failed) order and pays for it. */
export async function approveOrder(id: string): Promise<{ order: Order; warning?: string }> {
  const order = await store.getOrder(id);
  if (!order) throw new HttpError(404, `Order ${id} not found`);
  if (order.status !== "proposed" && order.status !== "failed") {
    throw new HttpError(409, `Order ${id} is already ${order.status}`);
  }
  return payAndLog((await store.updateOrder(id, { status: "approved", error: undefined }))!);
}

export async function rejectOrder(id: string): Promise<Order> {
  const order = await store.getOrder(id);
  if (!order) throw new HttpError(404, `Order ${id} not found`);
  if (order.status !== "proposed") throw new HttpError(409, `Order ${id} is already ${order.status}`);
  return (await store.updateOrder(id, { status: "rejected" }))!;
}

/**
 * Pays the distributor at the quoted price, then records the purchase on-chain.
 * A failed payment marks the order "failed" (it can be approved again to retry).
 * A failed audit log keeps the order "paid" and returns a warning instead.
 */
async function payAndLog(order: Order): Promise<{ order: Order; warning?: string }> {
  let current = order;
  try {
    const quote = order.quoteId ? await store.getQuote(order.quoteId) : undefined;
    if (!quote) throw new HttpError(409, `Order ${order.id} has no quote. Run the agent again.`);
    const txHash = await payOrder(current, quote);
    current = (await store.updateOrder(order.id, { status: "paid", txHash }))!;
  } catch (error) {
    await store.updateOrder(order.id, { status: "failed", error: errorMessage(error) });
    throw error;
  }

  // The BSC audit log is optional for now: skip it quietly until the PurchaseLog contract is
  // deployed and PURCHASE_LOG_CONTRACT_ADDRESS is set (mock payments still return a fake hash).
  if (!isMockMode("payments") && !process.env.PURCHASE_LOG_CONTRACT_ADDRESS) return { order: current };

  try {
    const auditTxHash = await logPurchaseOnChain(current);
    current = (await store.updateOrder(order.id, { auditTxHash }))!;
    return { order: current };
  } catch (error) {
    const warning = `Paid, but the on-chain audit log failed: ${errorMessage(error)}`;
    current = (await store.updateOrder(order.id, { error: warning }))!;
    return { order: current, warning };
  }
}
