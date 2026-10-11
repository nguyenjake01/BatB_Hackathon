import { errorResponse } from "@/lib/http";
import { store } from "@/lib/store";
import { refreshCatalog } from "@/lib/supply";

/**
 * All distributors (claimed or not) with their listings and agent policy, for the
 * distributor portal. Loads the catalog first if nothing has been scraped yet.
 */
export async function GET() {
  try {
    if ((await store.listProducts()).length === 0) await store.upsertProducts(await refreshCatalog());
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
