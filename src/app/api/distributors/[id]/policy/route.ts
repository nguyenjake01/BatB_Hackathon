// Distributor agent settings (owner: Person 1, Jake). P1.

import type { NextRequest } from "next/server";
import type { DistributorPolicy } from "@/types";
import { errorResponse, HttpError, readJson } from "@/lib/http";
import { store } from "@/lib/store";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/distributors/[id]/policy">) {
  try {
    const { id } = await ctx.params;
    return Response.json({ policy: await store.getPolicy(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/distributors/[id]/policy">) {
  try {
    const { id } = await ctx.params;
    if (!(await store.getDistributor(id))?.claimed) throw new HttpError(403, "Claim this distributor first");
    const body = await readJson(request);
    const policy: DistributorPolicy = { ...(await store.getPolicy(id)), isDefault: false };

    for (const key of ["floorPricePct", "concessionRate"] as const) {
      const value = body[key];
      if (value === undefined) continue;
      if (typeof value !== "number" || value < 0 || value > 1) throw new HttpError(400, `${key} must be between 0 and 1`);
      policy[key] = value;
    }
    if (body.highStockThreshold !== undefined) {
      if (typeof body.highStockThreshold !== "number" || body.highStockThreshold < 0) {
        throw new HttpError(400, "highStockThreshold must be >= 0");
      }
      policy.highStockThreshold = body.highStockThreshold;
    }
    if (body.autoAccept !== undefined) {
      if (typeof body.autoAccept !== "boolean") throw new HttpError(400, "autoAccept must be a boolean");
      policy.autoAccept = body.autoAccept;
    }
    if (body.volumeTiers !== undefined) {
      const tiers = body.volumeTiers;
      const valid =
        Array.isArray(tiers) &&
        tiers.every(
          (t) =>
            typeof t?.minQty === "number" && t.minQty >= 1 && typeof t?.discountPct === "number" && t.discountPct >= 0 && t.discountPct < 1,
        );
      if (!valid) throw new HttpError(400, "volumeTiers must be [{ minQty >= 1, discountPct in [0, 1) }]");
      policy.volumeTiers = tiers.map((t: { minQty: number; discountPct: number }) => ({ minQty: t.minQty, discountPct: t.discountPct }));
    }
    return Response.json({ policy: await store.setPolicy(policy) });
  } catch (error) {
    return errorResponse(error);
  }
}
