// Claim a scraped listing and set the payout wallet (owner: Person 1, Jake). P1.
// No real auth (PRD non-goal): the role switcher stands in for login.

import type { NextRequest } from "next/server";
import { errorResponse, HttpError, readJson } from "@/lib/http";
import { store } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/distributors/[id]/claim">) {
  try {
    const { id } = await ctx.params;
    const { payoutWallet } = await readJson(request);
    // Optional: without a payout wallet, checkout pays the platform's DEMO_DISTRIBUTOR_WALLET.
    if (payoutWallet !== undefined && payoutWallet !== "" && (typeof payoutWallet !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payoutWallet))) {
      throw new HttpError(400, "payoutWallet must be a 0x-prefixed Base Sepolia address");
    }
    const distributor = await store.updateDistributor(id, { claimed: true, ...(payoutWallet ? { payoutWallet: payoutWallet as string } : {}) });
    if (!distributor) throw new HttpError(404, `Distributor ${id} not found`);
    return Response.json({ distributor });
  } catch (error) {
    return errorResponse(error);
  }
}
