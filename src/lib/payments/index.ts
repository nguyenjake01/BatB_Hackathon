// Payments + audit trail (owner: Person 2, Jason).
// Pays distributors in AUSD via x402 (Base Sepolia) and logs each purchase to the
// PurchaseLog contract on BSC Testnet.

import type { Order, Quote } from "@/types";
import { isMockMode } from "@/lib/config";
import { mockPayments } from "./mock";
import { onchainPayments } from "./real";

export interface PaymentProvider {
  /**
   * Pays for an approved order by calling POST /api/distributors/[distributorId]/checkout
   * with the signed quote, answering its 402 with an x402 AUSD payment. Returns the tx hash.
   */
  payOrder(order: Order, quote: Quote): Promise<string>;
  /** Records a paid order in the on-chain audit log. Returns the audit transaction hash. */
  logPurchaseOnChain(order: Order): Promise<string>;
}

function provider(): PaymentProvider {
  return isMockMode("payments") ? mockPayments : onchainPayments;
}

export function payOrder(order: Order, quote: Quote): Promise<string> {
  return provider().payOrder(order, quote);
}

export function logPurchaseOnChain(order: Order): Promise<string> {
  return provider().logPurchaseOnChain(order);
}
