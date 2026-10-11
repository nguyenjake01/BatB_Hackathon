import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { store } from "@/lib/store";
import { getProducts, refreshCatalog } from "@/lib/supply";

/**
 * GET /api/products               cached catalog (scraped on first call)
 * GET /api/products?item=Flour    live listings for one item
 * GET /api/products?refresh=true  re-scrape the full catalog
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const item = searchParams.get("item");

    if (item) {
      const products = await getProducts(item);
      await store.upsertProducts(products);
      return Response.json({ products });
    }

    let products = await store.listProducts();
    if (products.length === 0 || searchParams.get("refresh") === "true") {
      products = await refreshCatalog();
      await store.upsertProducts(products);
    }
    return Response.json({ products });
  } catch (error) {
    return errorResponse(error);
  }
}
