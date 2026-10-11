// Data store. Everything persists through this interface so we can swap the
// in-memory implementation for a database later without touching callers.
//
// Note: in-memory data resets when the server restarts, and on Vercel it is not
// shared between serverless instances. Swap in a hosted KV/SQLite store behind this
// same interface before relying on a deployed demo.

import type {
  AutonomySettings,
  Distributor,
  DistributorPolicy,
  Negotiation,
  Order,
  Product,
  Quote,
  Requirement,
  Signal,
} from "@/types";
import { newId } from "@/lib/ids";
import { sameItemName } from "@/lib/matching";

export type RequirementInput = Omit<Requirement, "id">;

export interface Store {
  listRequirements(): Promise<Requirement[]>;
  /** Creates the requirement, or replaces the existing one for the same item. */
  upsertRequirement(input: RequirementInput): Promise<Requirement>;

  getSettings(): Promise<AutonomySettings>;
  updateSettings(patch: Partial<AutonomySettings>): Promise<AutonomySettings>;

  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  /** Also creates an unclaimed `Distributor` for any new `distributorId`. */
  upsertProducts(products: Product[]): Promise<void>;
  updateProduct(id: string, patch: Partial<Omit<Product, "id">>): Promise<Product | undefined>;
  /** Drops listings not in `ids` (delisted, or filtered out by a re-scrape). Distributors are kept. */
  retainProducts(ids: string[]): Promise<void>;

  listDistributors(): Promise<Distributor[]>;
  getDistributor(id: string): Promise<Distributor | undefined>;
  updateDistributor(id: string, patch: Partial<Omit<Distributor, "id">>): Promise<Distributor | undefined>;
  /** The distributor's own policy, or `defaultPolicy(id)` if it hasn't set one. */
  getPolicy(distributorId: string): Promise<DistributorPolicy>;
  setPolicy(policy: DistributorPolicy): Promise<DistributorPolicy>;

  listSignals(): Promise<Signal[]>;
  /** Replaces all signals. */
  replaceSignals(signals: Signal[]): Promise<void>;

  getNegotiation(id: string): Promise<Negotiation | undefined>;
  saveNegotiations(negotiations: Negotiation[]): Promise<void>;
  listNegotiations(): Promise<Negotiation[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  saveQuotes(quotes: Quote[]): Promise<void>;
  listQuotes(): Promise<Quote[]>;

  /** Newest first. */
  listOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  /** Drops all orders still in "proposed" status and adds `orders`. History is kept. */
  replaceProposedOrders(orders: Order[]): Promise<void>;
  updateOrder(id: string, patch: Partial<Omit<Order, "id">>): Promise<Order | undefined>;
  /** Total USD of orders paid in the last 7 days (for the weekly budget). */
  spentLast7Days(): Promise<number>;
}

/** PRD 7.6: unclaimed distributors use floor 90% of list, 30% concession, 5% off at volume. */
export function defaultPolicy(distributorId: string): DistributorPolicy {
  return {
    distributorId,
    isDefault: true,
    floorPricePct: 0.9,
    concessionRate: 0.3,
    volumeTiers: [{ minQty: 10, discountPct: 0.05 }],
    highStockThreshold: 100,
    autoAccept: false,
  };
}

const DEFAULT_SETTINGS: AutonomySettings = { mode: "approval", perOrderLimit: 150, weeklyBudget: 600 };

const SEED_REQUIREMENTS: RequirementInput[] = [
  { itemName: "Flour", minStockLevel: 150, maxBudget: 300, qualityNotes: "unbleached" },
  { itemName: "Butter", minStockLevel: 24, maxBudget: 400, qualityNotes: "unsalted" },
  { itemName: "Sugar", minStockLevel: 90, maxBudget: 150, qualityNotes: "granulated" },
  { itemName: "Eggs", minStockLevel: 180, maxBudget: 350, qualityNotes: "large" },
  { itemName: "Yeast", minStockLevel: 1, maxBudget: 60, qualityNotes: "instant" },
  { itemName: "Chocolate chips", minStockLevel: 10, maxBudget: 250, qualityNotes: "semi-sweet" },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function websiteOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

class MemoryStore implements Store {
  private requirements: Requirement[] = SEED_REQUIREMENTS.map((r) => ({ id: newId("req"), ...r }));
  private settings: AutonomySettings = { ...DEFAULT_SETTINGS };
  private products = new Map<string, Product>();
  private distributors = new Map<string, Distributor>();
  private policies = new Map<string, DistributorPolicy>();
  private signals: Signal[] = [];
  private negotiations = new Map<string, Negotiation>();
  private quotes = new Map<string, Quote>();
  private orders: Order[] = [];

  async listRequirements() {
    return structuredClone(this.requirements);
  }

  async upsertRequirement(input: RequirementInput) {
    const existing = this.requirements.find((r) => sameItemName(r.itemName, input.itemName));
    const requirement: Requirement = { id: existing?.id ?? newId("req"), ...input };
    this.requirements = existing
      ? this.requirements.map((r) => (r.id === existing.id ? requirement : r))
      : [...this.requirements, requirement];
    return structuredClone(requirement);
  }

  async getSettings() {
    return { ...this.settings };
  }

  async updateSettings(patch: Partial<AutonomySettings>) {
    this.settings = { ...this.settings, ...patch };
    return { ...this.settings };
  }

  async listProducts() {
    return structuredClone([...this.products.values()]);
  }

  async getProduct(id: string) {
    const product = this.products.get(id);
    return product && structuredClone(product);
  }

  async upsertProducts(products: Product[]) {
    for (const product of products) {
      // Re-scrapes must not undo what a distributor set on a claimed listing.
      const existing = this.products.get(product.id);
      const claimed = this.distributors.get(product.distributorId)?.claimed;
      const merged =
        existing && claimed
          ? { ...product, unitPrice: existing.unitPrice, inStock: existing.inStock, stockQuantity: existing.stockQuantity }
          : product;
      this.products.set(product.id, structuredClone(merged));

      if (!this.distributors.has(product.distributorId)) {
        this.distributors.set(product.distributorId, {
          id: product.distributorId,
          name: product.distributorName,
          website: websiteOf(product.sourceUrl),
          claimed: false,
        });
      }
    }
  }

  async updateProduct(id: string, patch: Partial<Omit<Product, "id">>) {
    const product = this.products.get(id);
    if (!product) return undefined;
    const updated = { ...product, ...patch };
    this.products.set(id, updated);
    return structuredClone(updated);
  }

  async retainProducts(ids: string[]) {
    const keep = new Set(ids);
    for (const id of [...this.products.keys()]) if (!keep.has(id)) this.products.delete(id);
  }

  async listDistributors() {
    return structuredClone([...this.distributors.values()]);
  }

  async getDistributor(id: string) {
    const distributor = this.distributors.get(id);
    return distributor && structuredClone(distributor);
  }

  async updateDistributor(id: string, patch: Partial<Omit<Distributor, "id">>) {
    const distributor = this.distributors.get(id);
    if (!distributor) return undefined;
    const updated = { ...distributor, ...patch };
    this.distributors.set(id, updated);
    return structuredClone(updated);
  }

  async getPolicy(distributorId: string) {
    return structuredClone(this.policies.get(distributorId) ?? defaultPolicy(distributorId));
  }

  async setPolicy(policy: DistributorPolicy) {
    this.policies.set(policy.distributorId, structuredClone(policy));
    return structuredClone(policy);
  }

  async listSignals() {
    return structuredClone(this.signals);
  }

  async replaceSignals(signals: Signal[]) {
    this.signals = structuredClone(signals);
  }

  async getNegotiation(id: string) {
    const negotiation = this.negotiations.get(id);
    return negotiation && structuredClone(negotiation);
  }

  async saveNegotiations(negotiations: Negotiation[]) {
    for (const n of negotiations) this.negotiations.set(n.id, structuredClone(n));
  }

  async listNegotiations() {
    return structuredClone([...this.negotiations.values()]);
  }

  async getQuote(id: string) {
    const quote = this.quotes.get(id);
    return quote && structuredClone(quote);
  }

  async saveQuotes(quotes: Quote[]) {
    for (const q of quotes) this.quotes.set(q.id, structuredClone(q));
  }

  async listQuotes() {
    return structuredClone([...this.quotes.values()]);
  }

  async listOrders() {
    return structuredClone(this.orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getOrder(id: string) {
    const order = this.orders.find((o) => o.id === id);
    return order && structuredClone(order);
  }

  async replaceProposedOrders(orders: Order[]) {
    this.orders = [...this.orders.filter((o) => o.status !== "proposed"), ...structuredClone(orders)];
  }

  async updateOrder(id: string, patch: Partial<Omit<Order, "id">>) {
    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) return undefined;
    this.orders[index] = { ...this.orders[index], ...patch };
    return structuredClone(this.orders[index]);
  }

  async spentLast7Days() {
    const since = Date.now() - WEEK_MS;
    return this.orders
      .filter((o) => o.status === "paid" && Date.parse(o.createdAt) >= since)
      .reduce((sum, o) => sum + o.totalPrice, 0);
  }
}

// Kept on globalThis so dev hot reloads and separate route bundles share one instance.
const globalForStore = globalThis as unknown as { __store?: Store };

export const store: Store = (globalForStore.__store ??= new MemoryStore());
