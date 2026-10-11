// Add a listing to a claimed distributor (added for self-signed-up distributors).
import type { NextRequest } from "next/server";
import type { Product } from "@/types";
import { errorResponse, HttpError, readJson } from "@/lib/http";
import { store } from "@/lib/store";
import { normalizeUnit } from "@/lib/units";

const UNITS = new Set(["lb", "oz", "kg", "g", "each", "dozen"]);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function positive(value: unknown, key: string, { integer = false, allowZero = false } = {}): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    throw new HttpError(400, `${key} must be a number ${allowZero ? ">= 0" : "> 0"}`);
  }
  if (integer && !Number.isInteger(value)) throw new HttpError(400, `${key} must be a whole number`);
  return value;
}

/** Body: { name, unitPrice, unitSize, unit, shippingCost, leadTimeDays, stockQuantity? }. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/distributors/[id]/products">) {
  try {
    const { id } = await ctx.params;
    const distributor = await store.getDistributor(id);
    if (!distributor) throw new HttpError(404, `Distributor ${id} not found`);
    if (!distributor.claimed) throw new HttpError(403, "Claim this distributor first");

    const body = await readJson(request);
    if (typeof body.name !== "string" || body.name.trim().length < 3) throw new HttpError(400, "name is required");
    const unit = normalizeUnit(String(body.unit ?? ""));
    if (!UNITS.has(unit)) throw new HttpError(400, `unit must be one of ${[...UNITS].join(", ")}`);
    const stockQuantity =
      body.stockQuantity === undefined ? undefined : positive(body.stockQuantity, "stockQuantity", { integer: true, allowZero: true });

    const product: Product = {
      id: `${id}-${slug(body.name)}`,
      name: body.name.trim(),
      distributorId: id,
      distributorName: distributor.name,
      unitPrice: Math.round(positive(body.unitPrice, "unitPrice") * 100) / 100,
      unitSize: positive(body.unitSize, "unitSize"),
      unit,
      shippingCost: Math.round(positive(body.shippingCost, "shippingCost", { allowZero: true }) * 100) / 100,
      leadTimeDays: positive(body.leadTimeDays, "leadTimeDays", { integer: true }),
      inStock: stockQuantity === undefined ? true : stockQuantity > 0,
      stockQuantity,
      isRetailBaseline: false,
      // Listed by the distributor rather than scraped: its own website is the source.
      sourceUrl: distributor.website,
      scrapedAt: new Date().toISOString(),
    };
    if (await store.getProduct(product.id)) throw new HttpError(409, `You already list ${product.name}. Edit it instead.`);
    await store.upsertProducts([product]);
    return Response.json({ product }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
