// Real payments: AUSD over x402 on Base Sepolia, audit log on BSC Testnet.

import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createWalletClient, createPublicClient, isAddressEqual, keccak256, parseAbi, toHex, type Address } from "viem";
import { bscTestnet } from "viem/chains";
import { errorMessage } from "@/lib/http";
import { store } from "@/lib/store";
import { agentAccount, ausdToken, bscTestnetTransport, PAYMENT_NETWORK, purchaseLogAddress, toTokenUnits } from "./chain";
import type { PaymentProvider } from "./index";

const purchaseLogAbi = parseAbi([
  "function logPurchase(string orderId, string distributor, uint256 amount, bytes32 reasoningHash)",
]);

/** Where this app is reachable, so the agent can call the distributor checkout over HTTP. */
function appBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return (body && typeof body.error === "string" && body.error) || `${response.status} ${response.statusText}`;
}

export const onchainPayments: PaymentProvider = {
  async payOrder(order, quote) {
    const token = await ausdToken();
    const account = agentAccount();
    const amount = toTokenUnits(quote.totalPrice, token.decimals).toString();
    const url = `${appBaseUrl()}/api/distributors/${encodeURIComponent(order.distributorId)}/checkout`;
    const init = { method: "POST", body: JSON.stringify({ quote }), cache: "no-store" as const };
    const jsonHeaders = { "Content-Type": "application/json" };

    // 1. Ask for the order without paying. The checkout answers 402 with its requirements.
    const unpaid = await fetch(url, { ...init, headers: jsonHeaders });
    if (unpaid.status !== 402) {
      throw new Error(
        unpaid.ok
          ? `Checkout for ${order.distributorId} did not ask for payment (is it running with USE_MOCKS_PAYMENTS=false?)`
          : `Checkout refused the order: ${await readError(unpaid)}`,
      );
    }

    // 2. Sign an ERC-3009 authorization, but only for exactly what the quote says:
    // AUSD on Base Sepolia, for quote.totalPrice. Anything else is refused before signing.
    const client = new x402HTTPClient(
      x402Client.fromConfig({
        schemes: [{ network: PAYMENT_NETWORK, client: new ExactEvmScheme(account) }],
        spendControls: { allowedAssets: [{ network: PAYMENT_NETWORK, asset: token.address, maxAmountPerPayment: amount }] },
        policies: [
          (_version, requirements) =>
            requirements.filter(
              (r) =>
                r.scheme === "exact" &&
                r.network === PAYMENT_NETWORK &&
                isAddressEqual(r.asset as Address, token.address) &&
                r.amount === amount,
            ),
        ],
      }),
    );
    const paymentRequired = client.getPaymentRequiredResponse((name) => unpaid.headers.get(name), await unpaid.json());
    const payment = await client.createPaymentPayload(paymentRequired);

    // 3. Retry with the payment. From here on the transfer may have been broadcast.
    let paid: Response;
    try {
      paid = await fetch(url, { ...init, headers: { ...jsonHeaders, ...client.encodePaymentSignatureHeader(payment) } });
    } catch (error) {
      throw new Error(
        `Payment status unknown: the checkout did not answer after the payment was sent (${errorMessage(error)}). ` +
          `Check ${account.address} on Base Sepolia before retrying.`,
      );
    }
    // A 402 here is a definite "no": the facilitator rejected or failed to settle it.
    if (paid.status === 402) throw new Error(`Payment not made: ${await readError(paid)}`);
    if (!paid.ok) {
      throw new Error(
        `Payment status unknown: checkout answered ${await readError(paid)} after the payment was sent. ` +
          `Check ${account.address} on Base Sepolia before retrying.`,
      );
    }

    const settlement = client.getPaymentSettleResponse((name) => paid.headers.get(name));
    if (!settlement.success || !settlement.transaction) {
      throw new Error(`Payment was not settled: ${settlement.errorMessage ?? settlement.errorReason ?? "no transaction returned"}`);
    }
    return settlement.transaction;
  },

  async logPurchaseOnChain(order) {
    const token = await ausdToken();
    const account = agentAccount();
    const address = purchaseLogAddress();
    const transport = bscTestnetTransport();
    const wallet = createWalletClient({ account, chain: bscTestnet, transport });
    const reader = createPublicClient({ chain: bscTestnet, transport });

    // The hash commits to the reasoning shown to the owner and, when the price was
    // negotiated, to the full agent-to-agent transcript.
    const negotiation = order.negotiationId ? await store.getNegotiation(order.negotiationId) : undefined;
    const reasoningHash = keccak256(toHex(order.reasoning + (negotiation?.transcriptHash ?? "")));

    const hash = await wallet.writeContract({
      address,
      abi: purchaseLogAbi,
      functionName: "logPurchase",
      args: [order.id, order.distributorId, toTokenUnits(order.totalPrice, token.decimals), reasoningHash],
    });
    // Only report the hash once the event is really on-chain (only the contract owner may log).
    const receipt = await reader.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error(`PurchaseLog transaction ${hash} reverted`);
    return hash;
  },
};
