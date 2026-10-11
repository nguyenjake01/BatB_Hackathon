// Distributor checkout (owner: Person 2, Jason). P0.
// Stands in for a distributor that accepts AUSD over x402. The agent's payOrder() calls
// this with the signed quote; the amount charged is exactly quote.totalPrice.
//
// x402 flow: a request without a PAYMENT-SIGNATURE header gets HTTP 402 with the payment
// requirements (AUSD on Base Sepolia, amount, payTo). A request with one is verified and
// settled through the facilitator, and the settlement tx hash is returned.

import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import type { PaymentPayload } from "@x402/core/types";
import type { NextRequest } from "next/server";
import type { Quote } from "@/types";
import { isMockMode } from "@/lib/config";
import { errorMessage, errorResponse, HttpError, readJson } from "@/lib/http";
import { newId } from "@/lib/ids";
import { requirementsForQuote, resourceServer } from "@/lib/payments/x402";
import { quoteProblem } from "@/lib/quotes";
import { store } from "@/lib/store";

// Selector of OpenZeppelin's ERC20InsufficientBalance(address,uint256,uint256), which AUSD
// reverts with when the payer can't cover the transfer.
const INSUFFICIENT_BALANCE_SELECTOR = "0xe450d38c";

/** One readable line from a facilitator verify/settle failure (their messages are long viem dumps). */
function explainFailure(reason?: string, message?: string): string {
  if (message?.includes(INSUFFICIENT_BALANCE_SELECTOR) || reason?.includes("insufficient")) {
    return "the paying wallet does not hold enough AUSD on Base Sepolia";
  }
  const firstLine = message?.split("\n")[0].trim();
  return [reason, firstLine].filter(Boolean).join(": ") || "no reason given";
}

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
    const claimedWallet = distributor?.claimed ? distributor.payoutWallet : undefined;
    const payTo = claimedWallet || process.env.DEMO_DISTRIBUTOR_WALLET;
    const confirmation = {
      distributorId: id,
      payTo: payTo ?? null,
      payoutRouting: claimedWallet ? "claimed" : "unclaimed",
      quoteId: quote!.id,
      amountDue: quote!.totalPrice,
      currency: "AUSD",
    };

    // Mock payments never reach this route with a payment, so there is nothing to charge.
    if (isMockMode("payments")) {
      return Response.json({ confirmationId: newId("conf"), status: "confirmed", ...confirmation });
    }

    if (!payTo) throw new HttpError(500, "No payout wallet: set DEMO_DISTRIBUTOR_WALLET in .env.local");
    const server = await resourceServer();
    const requirements = await requirementsForQuote(quote!, payTo);
    const resource = { url: request.url, description: `Order payment for quote ${quote!.id}`, mimeType: "application/json" };

    const paymentRequired = async (error: string) => {
      const response = await server.createPaymentRequiredResponse(requirements, resource, error);
      return Response.json(
        { error, ...confirmation, accepts: response.accepts },
        { status: 402, headers: { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(response) } },
      );
    };

    const header = request.headers.get("PAYMENT-SIGNATURE");
    if (!header) return paymentRequired("Payment required");

    let payment: PaymentPayload;
    try {
      payment = decodePaymentSignatureHeader(header);
    } catch {
      throw new HttpError(400, "PAYMENT-SIGNATURE header is not a valid x402 payment");
    }
    // The payment must be for this quote's exact amount, asset, and recipient.
    const matched = server.findMatchingRequirements(requirements, payment);
    if (!matched) return paymentRequired("Payment does not match this quote's requirements");

    const verified = await server.verifyPayment(payment, matched);
    if (!verified.isValid) {
      return paymentRequired(`Facilitator rejected the payment: ${explainFailure(verified.invalidReason, verified.invalidMessage)}`);
    }

    const settled = await server.settlePayment(payment, matched);
    if (!settled.success || !settled.transaction) {
      return paymentRequired(`Settlement failed: ${explainFailure(settled.errorReason, settled.errorMessage)}`);
    }

    return Response.json(
      { confirmationId: newId("conf"), status: "paid", ...confirmation, txHash: settled.transaction, payer: settled.payer },
      { headers: { "PAYMENT-RESPONSE": encodePaymentResponseHeader(settled) } },
    );
  } catch (error) {
    // The facilitator being unreachable is not the caller's fault and not a 402.
    if (!(error instanceof HttpError) && /facilitator/i.test(errorMessage(error))) {
      return errorResponse(new HttpError(502, `x402 facilitator error: ${errorMessage(error)}`));
    }
    return errorResponse(error);
  }
}
