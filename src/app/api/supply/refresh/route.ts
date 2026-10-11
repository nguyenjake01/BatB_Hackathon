import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { store } from "@/lib/store";
import { refreshCatalog, refreshReport } from "@/lib/supply";

/**
 * Re-scrapes distributor catalogs, caches the result, and reports which sources worked.
 * POST /api/supply/refresh              every tracked item (slow on the free plan: ~1 min per page)
 * POST /api/supply/refresh?item=Butter  just these items (repeatable)
 */
export async function POST(request: NextRequest) {
  try {
    const items = request.nextUrl.searchParams.getAll("item");
    const catalog = await refreshCatalog(items.length ? items : undefined);
    await store.upsertProducts(catalog);
    await store.retainProducts(catalog.map((p) => p.id));
    return Response.json({ products: await store.listProducts(), report: refreshReport() });
  } catch (error) {
    return errorResponse(error);
  }
}
