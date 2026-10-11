// Signed quotes (shared: negotiation creates them, the agent creates list-price ones,
// the x402 checkout verifies them). HMAC-SHA256 keyed by NEGOTIATION_SIGNING_SECRET.
// The checkout receives the full quote in the request body, so verification needs no
// shared memory (Vercel serverless instances don't share the store).

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Quote } from "@/types";
import { isMockMode } from "@/lib/config";
import { newId } from "@/lib/ids";

export const QUOTE_TTL_MS = 30 * 60 * 1000;

export type QuoteInput = Omit<Quote, "id" | "expiresAt" | "signature">;

function secret(): string {
  const value = process.env.NEGOTIATION_SIGNING_SECRET;
  if (value) return value;
  if (isMockMode()) return "mock-signing-secret";
  throw new Error("NEGOTIATION_SIGNING_SECRET is not set");
}

/** Canonical string over every field except the signature. */
function payload(q: Omit<Quote, "signature">): string {
  return [q.id, q.negotiationId ?? "", q.productId, q.distributorId, q.quantity, q.unitPrice, q.totalPrice, q.expiresAt].join("|");
}

function hmac(q: Omit<Quote, "signature">): string {
  return createHmac("sha256", secret()).update(payload(q)).digest("hex");
}

export function signQuote(input: QuoteInput, now = Date.now()): Quote {
  const unsigned = { id: newId("quote"), ...input, expiresAt: new Date(now + QUOTE_TTL_MS).toISOString() };
  return { ...unsigned, signature: hmac(unsigned) };
}

/** Returns null when the quote is valid, otherwise the reason it isn't. */
export function quoteProblem(quote: Quote | undefined, now = Date.now()): string | null {
  if (!quote) return "missing quote";
  if (Date.parse(quote.expiresAt) <= now) return "quote expired";
  const expected = Buffer.from(hmac(quote), "hex");
  const actual = Buffer.from(quote.signature ?? "", "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return "invalid quote signature";
  return null;
}
