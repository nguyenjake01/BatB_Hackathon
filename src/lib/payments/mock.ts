// Mock payments: no chain calls, just realistic-looking transaction hashes.

import type { PaymentProvider } from "./index";

function fakeTxHash(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockPayments: PaymentProvider = {
  async payOrder() {
    await delay(400);
    return fakeTxHash();
  },

  async logPurchaseOnChain() {
    await delay(200);
    return fakeTxHash();
  },
};
