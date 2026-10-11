// Data store. Everything persists through this interface so we can swap the
// in-memory implementation for a database later without touching callers.
//
// Note: in-memory data resets when the server restarts, and on Vercel it is not
// shared between serverless instances. Swap in a database before relying on a
// deployed demo.

import type { Order, Product, Requirement } from "@/types";
import { newId } from "@/lib/ids";
import { sameItemName } from "@/lib/matching";

export type RequirementInput = Omit<Requirement, "id">;

export interface Store {
  listRequirements(): Promise<Requirement[]>;
  /** Creates the requirement, or replaces the existing one for the same item. */
  upsertRequirement(input: RequirementInput): Promise<Requirement>;

  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  upsertProducts(products: Product[]): Promise<void>;

  /** Newest first. */
  listOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  /** Drops all orders still in "proposed" status and adds `orders`. History is kept. */
  replaceProposedOrders(orders: Order[]): Promise<void>;
  updateOrder(id: string, patch: Partial<Omit<Order, "id">>): Promise<Order | undefined>;
}

const SEED_REQUIREMENTS: RequirementInput[] = [
  { itemName: "Flour", minStockLevel: 150, maxBudget: 300, qualityNotes: "unbleached" },
  { itemName: "Butter", minStockLevel: 24, maxBudget: 400, qualityNotes: "unsalted" },
  { itemName: "Sugar", minStockLevel: 90, maxBudget: 150, qualityNotes: "granulated" },
  { itemName: "Eggs", minStockLevel: 180, maxBudget: 350, qualityNotes: "large" },
  { itemName: "Yeast", minStockLevel: 1, maxBudget: 60, qualityNotes: "instant" },
  { itemName: "Chocolate chips", minStockLevel: 10, maxBudget: 250, qualityNotes: "semi-sweet" },
];

class MemoryStore implements Store {
  private requirements: Requirement[] = SEED_REQUIREMENTS.map((r) => ({ id: newId("req"), ...r }));
  private products = new Map<string, Product>();
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

  async listProducts() {
    return structuredClone([...this.products.values()]);
  }

  async getProduct(id: string) {
    const product = this.products.get(id);
    return product && structuredClone(product);
  }

  async upsertProducts(products: Product[]) {
    for (const product of products) this.products.set(product.id, structuredClone(product));
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
}

// Kept on globalThis so dev hot reloads and separate route bundles share one instance.
const globalForStore = globalThis as unknown as { __store?: Store };

export const store: Store = (globalForStore.__store ??= new MemoryStore());
