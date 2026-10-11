// x402 resource-server side of the distributor checkout: builds the payment requirements
// for a quote and verifies + settles the agent's payment through a facilitator.
// The facilitator submits the ERC-3009 `transferWithAuthorization` and pays the gas,
// so the agent wallet only needs AUSD.

import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { PaymentRequirements } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { getAddress } from "viem";
import type { Quote } from "@/types";
import { ausdToken, PAYMENT_NETWORK, toTokenUnits } from "./chain";

/** Public testnet facilitator (no API key). Supports exact payments on Base Sepolia. */
const DEFAULT_FACILITATOR_URL = "https://x402.org/facilitator";

let cachedServer: Promise<x402ResourceServer> | undefined;

export function resourceServer(): Promise<x402ResourceServer> {
  cachedServer ??= (async () => {
    const facilitator = new HTTPFacilitatorClient({ url: process.env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR_URL });
    const server = new x402ResourceServer(facilitator).register(PAYMENT_NETWORK, new ExactEvmScheme());
    await server.initialize();
    return server;
  })();
  cachedServer.catch(() => (cachedServer = undefined));
  return cachedServer;
}

/** What the checkout charges for `quote`: exactly `quote.totalPrice` AUSD to `payTo`. */
export async function requirementsForQuote(quote: Quote, payTo: string): Promise<PaymentRequirements[]> {
  const [server, token] = await Promise.all([resourceServer(), ausdToken()]);
  return server.buildPaymentRequirements({
    scheme: "exact",
    network: PAYMENT_NETWORK,
    payTo: getAddress(payTo),
    price: {
      asset: token.address,
      amount: toTokenUnits(quote.totalPrice, token.decimals).toString(),
      extra: { ...token.eip712 },
    },
    // Quotes live 30 minutes; the payment authorization only needs to outlive one retry.
    maxTimeoutSeconds: 120,
  });
}
