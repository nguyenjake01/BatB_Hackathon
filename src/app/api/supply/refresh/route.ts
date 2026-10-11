import { errorResponse } from "@/lib/http";
import { store } from "@/lib/store";
import { refreshCatalog, refreshReport } from "@/lib/supply";

/** Re-scrapes every distributor catalog, caches the result, and reports which sources worked. */
export async function POST() {
  try {
    await store.upsertProducts(await refreshCatalog());
    return Response.json({ products: await store.listProducts(), report: refreshReport() });
  } catch (error) {
    return errorResponse(error);
  }
}
