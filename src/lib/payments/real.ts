// Real payments: AUSD over x402 on Base Sepolia, audit log on BSC Testnet.

import { NotImplementedError } from "@/lib/config";
import type { PaymentProvider } from "./index";

export const onchainPayments: PaymentProvider = {
  async payOrder(order, quote) {
    // TODO(Person 2): Pay for the order in AUSD via x402 on Base Sepolia (ERC-3009 gasless
    // transfer). POST { quote } to /api/distributors/[order.distributorId]/checkout, get the
    // 402, sign the authorization from the agent wallet, retry with payment. Use the Agora
    // Docs MCP for package names and the AUSD address; don't guess. Agent wallet:
    // (process.env.AGENT_WALLET_PRIVATE_KEY, process.env.AUSD_CONTRACT_ADDRESS,
    // process.env.BASE_SEPOLIA_RPC_URL). Return the settlement transaction hash.
    throw new NotImplementedError(`x402 payOrder(${order.id}, ${quote.totalPrice} AUSD)`, "payments");
  },

  async logPurchaseOnChain(order) {
    // TODO(Person 2): Call PurchaseLog.logPurchase(orderId, distributor, amount, reasoningHash)
    // on BSC Testnet (process.env.PURCHASE_LOG_CONTRACT_ADDRESS, process.env.BSC_TESTNET_RPC_URL),
    // signing with the wallet that deployed the contract (only the owner can log).
    // distributor: order.distributorId.
    // amount: order.totalPrice in AUSD base units (check the token's decimals()).
    // reasoningHash: keccak256 of order.reasoning plus the negotiation's transcriptHash, if any.
    // The ABI is in contracts/artifacts after `npm run compile` in contracts/.
    throw new NotImplementedError(`PurchaseLog logPurchaseOnChain(${order.id})`, "payments");
  },
};
