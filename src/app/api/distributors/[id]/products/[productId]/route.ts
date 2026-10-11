// Update price/stock on a claimed listing (owner: Person 1, Jake). P1.

import type { NextRequest } from "next/server";
import type { Product } from "@/types";
import { errorResponse, HttpError, readJson } from "@/lib/http";
import { store } from "@/lib/store";

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/distributors/[id]/products/[productId]">) {
  try {
    const { id, productId } = await ctx.params;
    const product = await store.getProduct(productId);
    if (!product || product.distributorId !== id) throw new HttpError(404, `Product ${productId} not found for ${id}`);
    if (!(await store.getDistributor(id))?.claimed) throw new HttpError(403, "Claim this distributor first");

    const body = await readJson(request);
    const patch: Partial<Product> = {};
    if (body.unitPrice !== undefined) {
      if (typeof body.unitPrice !== "number" || !(body.unitPrice > 0)) throw new HttpError(400, "unitPrice must be > 0");
      patch.unitPrice = Math.round(body.unitPrice * 100) / 100;
    }
    if (body.stockQuantity !== undefined) {
      if (typeof body.stockQuantity !== "number" || !Number.isInteger(body.stockQuantity) || body.stockQuantity < 0) {
        throw new HttpError(400, "stockQuantity must be a whole number >= 0");
      }
      patch.stockQuantity = body.stockQuantity;
      patch.inStock = body.stockQuantity > 0;
    }
    if (body.inStock !== undefined) {
      if (typeof body.inStock !== "boolean") throw new HttpError(400, "inStock must be a boolean");
      patch.inStock = body.inStock;
    }
    return Response.json({ product: await store.updateProduct(productId, patch) });
  } catch (error) {
    return errorResponse(error);
  }
}
