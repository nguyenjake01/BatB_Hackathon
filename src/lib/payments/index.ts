// Payments + audit trail (owner: Person 2).
// Pays distributors in AUSD via x402 (Base Sepolia) and logs each purchase to the
// PurchaseLog contract on BSC Testnet.

import type { Order } from "@/types";
import { isMockMode } from "@/lib/config";
import { mockPayments } from "./mock";
import { onchainPayments } from "./real";

export interface PaymentProvider {
  /** Pays for an approved order. Returns the payment transaction hash. */
  payOrder(order: Order): Promise<string>;
  /** Records a paid order in the on-chain audit log. Returns the audit transaction hash. */
  logPurchaseOnChain(order: Order): Promise<string>;
}

function provider(): PaymentProvider {
  return isMockMode("payments") ? mockPayments : onchainPayments;
}

export function payOrder(order: Order): Promise<string> {
  return provider().payOrder(order);
}

export function logPurchaseOnChain(order: Order): Promise<string> {
  return provider().logPurchaseOnChain(order);
}
