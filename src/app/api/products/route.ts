import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { getInventory } from "@/lib/square";
import { store } from "@/lib/store";
import { getProducts, refreshCatalog } from "@/lib/supply";

/**
 * GET /api/products               cached catalog (the committed snapshot on a fresh server)
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
    if (searchParams.get("refresh") === "true") {
      products = await refreshCatalog();
      await store.upsertProducts(products);
    } else if (products.length === 0) {
      // Load the cache instead of re-scraping: a live scrape is slow and trips Context.dev's concurrency limit.
      const inventory = await getInventory();
      products = (await Promise.all(inventory.map((item) => getProducts(item.name)))).flat();
      await store.upsertProducts(products);
    }
    return Response.json({ products });
  } catch (error) {
    return errorResponse(error);
  }
}
