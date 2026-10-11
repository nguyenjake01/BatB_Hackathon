// Shared types. Everyone codes against these.
// Changing a field here affects all three owners. Tell the team before editing.

/** A distributor listing (Person 1, Supply). */
export interface Product {
  id: string;
  /** Listing title as shown by the distributor, e.g. "Bread Flour, Unbleached, 50 lb bag". */
  name: string;
  /** Distributor name, e.g. "Restaurant Depot". */
  distributor: string;
  /** Price of one pack in USD (1 AUSD = 1 USD). */
  unitPrice: number;
  /** Amount of `unit` in one pack, e.g. 50 for a 50 lb bag. */
  unitSize: number;
  /** Unit that `unitSize` is measured in, e.g. "lb", "oz", "each", "dozen". */
  unit: string;
  /** Flat shipping cost per order in USD. */
  shippingCost: number;
  leadTimeDays: number;
  sourceUrl: string;
  /** ISO 8601 timestamp. */
  scrapedAt: string;
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
  /** Reorder when stock would drop below this, in the inventory item's unit. */
  minStockLevel: number;
  /** Max USD to spend on a single order of this item, shipping included. */
  maxBudget: number;
  /** Free text, e.g. "unbleached", "unsalted, European-style". */
  qualityNotes: string;
}

export type OrderStatus = "proposed" | "approved" | "paid" | "failed";

/** A purchase proposed by the agent (Person 2). */
export interface Order {
  id: string;
  productId: string;
  /** Number of packs of the product (not base units). */
  quantity: number;
  /** USD, shipping included. */
  totalPrice: number;
  /** Plain-language explanation shown to the owner. */
  reasoning: string;
  status: OrderStatus;
  /** Payment transaction (AUSD via x402 on Base Sepolia). */
  txHash?: string;
  /** Audit log transaction (PurchaseLog on BSC Testnet). */
  auditTxHash?: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

// ---- API response shapes ----

/** An order joined with its product, as returned by the orders and agent APIs. */
export type OrderWithProduct = Order & { product: Product | null };
