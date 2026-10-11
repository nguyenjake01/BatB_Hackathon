// Distributor checkout (owner: Person 2, Jason). P0.
// Stands in for a distributor that accepts AUSD over x402. The agent's payOrder() calls
// this with the signed quote; the amount charged is exactly quote.totalPrice.

import type { NextRequest } from "next/server";
import type { Quote } from "@/types";
import { errorResponse, HttpError, readJson } from "@/lib/http";
import { newId } from "@/lib/ids";
import { quoteProblem } from "@/lib/quotes";
import { store } from "@/lib/store";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/distributors/[id]/checkout">) {
  try {
    const { id } = await ctx.params;
    const body = await readJson(request);
    const quote = body.quote as Quote | undefined;

    const problem = quoteProblem(quote);
    if (problem) throw new HttpError(400, problem);
    if (quote!.distributorId !== id) throw new HttpError(400, "quote is for a different distributor");

    const distributor = await store.getDistributor(id);
    // P1 payout routing: claimed listings pay the distributor's wallet, unclaimed pay the demo wallet.
    const payTo = (distributor?.claimed && distributor.payoutWallet) || process.env.DEMO_DISTRIBUTOR_WALLET;

    // TODO(Person 2): Put this handler behind x402 (AUSD on Base Sepolia). Without a valid
    // payment, answer 402 with payment requirements { amount: quote.totalPrice, payTo, asset:
    // AUSD }. With one, verify/settle it and include the settlement txHash below.
    return Response.json({
      confirmationId: newId("conf"),
      status: "confirmed",
      distributorId: id,
      payTo: payTo ?? null,
      quoteId: quote!.id,
      amountDue: quote!.totalPrice,
      currency: "AUSD",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
