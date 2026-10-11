// Shared types. Everyone codes against these. Source of truth: docs/PRD.md section 9.
// Changing a field here affects all three owners. Tell the team before editing.

/** A distributor listing (Person 1, Supply). */
export interface Product {
  id: string;
  /** Listing title as shown by the distributor, e.g. "Bread Flour, Unbleached, 50 lb bag". */
  name: string;
  /** References `Distributor.id`. */
  distributorId: string;
  /** Display name, e.g. "WebstaurantStore". Denormalized from `Distributor.name`. */
  distributorName: string;
  /** List price of one pack in USD (1 AUSD = 1 USD). */
  unitPrice: number;
  /** Amount of `unit` in one pack, e.g. 50 for a 50 lb bag. */
  unitSize: number;
  /** Unit that `unitSize` is measured in, e.g. "lb", "oz", "each", "dozen". */
  unit: string;
  /** Flat shipping cost per order in USD. */
  shippingCost: number;
  leadTimeDays: number;
  inStock: boolean;
  /**
   * Packs in stock, when known. Scraped listings usually leave this unset; claimed
   * listings set it in the portal. Drives `DistributorPolicy.highStockThreshold`.
   */
  stockQuantity?: number;
  /** True for the Costco-style retail listing used as the savings baseline. */
  isRetailBaseline: boolean;
  sourceUrl: string;
  /** ISO 8601 timestamp. */
  scrapedAt: string;
}

export interface Distributor {
  id: string;
  name: string;
  website: string;
  claimed: boolean;
  /** Base Sepolia address. Unclaimed distributors are paid at DEMO_DISTRIBUTOR_WALLET. */
  payoutWallet?: string;
}

/** A stock item in the business's inventory (Person 3, Square). */
export interface InventoryItem {
  sku: string;
  name: string;
  quantityOnHand: number;
  /** Unit for `quantityOnHand` and `dailyUsage`, e.g. "lb", "each". */
  unit: string;
  dailyUsage: number;
  shelfLifeDays: number;
}

/** An owner-defined purchasing rule for one item. */
export interface Requirement {
  id: string;
  /** Matches `InventoryItem.name` (case-insensitive). */
  itemName: string;
  /** Reorder when stock on arrival would drop below this, in the inventory item's unit. */
  minStockLevel: number;
  /** Max USD to spend on a single order of this item, shipping included. */
  maxBudget: number;
  /** Free text, e.g. "unbleached", "unsalted, European-style". */
  qualityNotes?: string;
}

export interface AutonomySettings {
  mode: "approval" | "auto";
  /** USD. Auto mode only pays orders at or below this. */
  perOrderLimit: number;
  /** USD, rolling 7 days. */
  weeklyBudget: number;
}

export interface Signal {
  id: string;
  itemName: string;
  kind: "price_change" | "news";
  direction: "buy_early" | "wait" | "neutral";
  summary: string;
  sourceUrl: string;
  /** ISO 8601 timestamp. */
  detectedAt: string;
}

/** A distributor agent's negotiation limits. */
export interface DistributorPolicy {
  distributorId: string;
  /** True for unclaimed distributors running the default policy (label it in the UI). */
  isDefault: boolean;
  /** Minimum price as a fraction of list, e.g. 0.9. */
  floorPricePct: number;
  /** Fraction of the gap conceded per round, e.g. 0.3. */
  concessionRate: number;
  volumeTiers: { minQty: number; discountPct: number }[];
  /** Concede 1.5x faster when `Product.stockQuantity` is above this. */
  highStockThreshold: number;
  autoAccept: boolean;
}

export interface NegotiationMessage {
  round: number;
  from: "buyer" | "distributor";
  /** USD per pack. */
  unitPrice: number;
  text: string;
  /** ISO 8601 timestamp. */
  at: string;
}

export interface Negotiation {
  id: string;
  productId: string;
  distributorId: string;
  /** Packs. */
  quantity: number;
  messages: NegotiationMessage[];
  status: "open" | "agreed" | "no_deal";
  agreedUnitPrice?: number;
  transcriptHash?: string;
}

/** A signed price commitment. The x402 checkout charges exactly `totalPrice`. */
export interface Quote {
  id: string;
  /** Unset for list-price quotes (negotiation didn't run). */
  negotiationId?: string;
  productId: string;
  distributorId: string;
  /** Packs. */
  quantity: number;
  /** USD per pack. */
  unitPrice: number;
  /** USD, shipping included. */
  totalPrice: number;
  /** ISO 8601 timestamp, 30 minutes after signing. */
  expiresAt: string;
  /** HMAC-SHA256 hex over the other fields, keyed by NEGOTIATION_SIGNING_SECRET. See src/lib/quotes.ts. */
  signature: string;
}

export type OrderStatus = "proposed" | "approved" | "paid" | "rejected" | "failed";

/** A purchase decided by the agent (Person 2). */
export interface Order {
  id: string;
  productId: string;
  distributorId: string;
  /** Number of packs of the product (not base units). */
  quantity: number;
  /** USD, shipping included. Equals the quote's `totalPrice`. */
  totalPrice: number;
  /** USD at list price, shipping included (to show the negotiated discount). */
  listTotal?: number;
  /** USD the retail baseline would cost for the same amount. */
  baselinePrice?: number;
  /** Savings vs the retail baseline, 0..1. */
  savingsPct?: number;
  /** Plain-language explanation shown to the owner. */
  reasoning: string;
  signalIds: string[];
  negotiationId?: string;
  quoteId?: string;
  status: OrderStatus;
  /** True when auto mode paid it without approval. */
  autoPurchased: boolean;
  /** Payment transaction (AUSD via x402 on Base Sepolia). */
  txHash?: string;
  /** Audit log transaction (PurchaseLog on BSC Testnet). */
  auditTxHash?: string;
  error?: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

// ---- API response shapes ----

/** An order joined with its product and distributor, as returned by the orders and agent APIs. */
export type OrderWithProduct = Order & { product: Product | null; distributor: Distributor | null };
