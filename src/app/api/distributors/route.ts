import { errorResponse } from "@/lib/http";
import { store } from "@/lib/store";
import { getInventory } from "@/lib/square";
import { getProducts } from "@/lib/supply";

/**
 * All distributors (claimed or not) with their listings and agent policy, for the
 * distributor portal. On a fresh server, loads the cached catalog (the committed snapshot)
 * rather than re-scraping, which is slow and trips Context.dev's concurrency limit.
 */
export async function GET() {
  try {
    if ((await store.listProducts()).length === 0) {
      const inventory = await getInventory();
      await store.upsertProducts((await Promise.all(inventory.map((item) => getProducts(item.name)))).flat());
    }
    const [distributors, products] = await Promise.all([store.listDistributors(), store.listProducts()]);
    const withDetails = await Promise.all(
      distributors.map(async (d) => ({
        ...d,
        policy: await store.getPolicy(d.id),
        products: products.filter((p) => p.distributorId === d.id),
      })),
    );
    return Response.json({ distributors: withDetails });
  } catch (error) {
    return errorResponse(error);
  }
}
