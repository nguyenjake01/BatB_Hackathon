// Typed client for our API routes.

import type {
  AutonomySettings,
  Distributor,
  DistributorPolicy,
  InventoryItem,
  Negotiation,
  OrderWithProduct,
  Product,
  Quote,
  Requirement,
  Signal,
} from "@/types";

/**
 * One entry of GET /api/negotiations?orderId=… (owner: Jake): every negotiation the agent ran
 * for that order, including the ones that ended in no deal. `quote` is set when the agents agreed.
 */
export interface NegotiationEntry {
  negotiation: Negotiation;
  quote: Quote | null;
  product: Product | null;
  distributor: Distributor | null;
}

/** Shape of GET/PUT /api/settings (owner: Jason). `spentThisWeek` is USD paid in the last 7 days. */
export interface SettingsResponse {
  settings: AutonomySettings;
  spentThisWeek: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
  return data as T;
}

export const api = {
  inventory: () => request<{ inventory: InventoryItem[] }>("/api/inventory").then((d) => d.inventory),
  requirements: () => request<{ requirements: Requirement[] }>("/api/requirements").then((d) => d.requirements),
  orders: () => request<{ orders: OrderWithProduct[] }>("/api/orders").then((d) => d.orders),

  saveRequirement: (input: Omit<Requirement, "id">) =>
    request<{ requirement: Requirement }>("/api/requirements", { method: "POST", body: JSON.stringify(input) }),

  runAgent: () => request<{ orders: OrderWithProduct[] }>("/api/agent/run", { method: "POST" }).then((d) => d.orders),

  approve: (id: string) =>
    request<{ order: OrderWithProduct; warning?: string }>(`/api/orders/${encodeURIComponent(id)}/approve`, {
      method: "POST",
    }),

  reject: (id: string) =>
    request<{ order: OrderWithProduct }>(`/api/orders/${encodeURIComponent(id)}/reject`, { method: "POST" }),

  negotiationsForOrder: (orderId: string) =>
    request<{ negotiations: NegotiationEntry[] }>(`/api/negotiations?orderId=${encodeURIComponent(orderId)}`).then(
      (d) => d.negotiations,
    ),

  // ---- Signals (routes owned by Jake) ----

  signals: () => request<{ signals: Signal[] }>("/api/signals").then((d) => d.signals),

  refreshSignals: () =>
    request<{ signals: Signal[] }>("/api/signals/refresh", { method: "POST" }).then((d) => d.signals),

  // ---- Distributor portal (routes owned by Jake) ----

  products: () => request<{ products: Product[] }>("/api/products").then((d) => d.products),

  distributors: () => request<{ distributors: Distributor[] }>("/api/distributors").then((d) => d.distributors),

  claim: (distributorId: string, payoutWallet: string) =>
    request<{ distributor: Distributor }>(`/api/distributors/${encodeURIComponent(distributorId)}/claim`, {
      method: "POST",
      body: JSON.stringify({ payoutWallet }),
    }).then((d) => d.distributor),

  updateProduct: (distributorId: string, productId: string, patch: Pick<Product, "unitPrice" | "stockQuantity" | "inStock">) =>
    request<{ product: Product }>(
      `/api/distributors/${encodeURIComponent(distributorId)}/products/${encodeURIComponent(productId)}`,
      { method: "PUT", body: JSON.stringify(patch) },
    ).then((d) => d.product),

  policy: (distributorId: string) =>
    request<{ policy: DistributorPolicy }>(`/api/distributors/${encodeURIComponent(distributorId)}/policy`).then(
      (d) => d.policy,
    ),

  savePolicy: (policy: DistributorPolicy) =>
    request<{ policy: DistributorPolicy }>(`/api/distributors/${encodeURIComponent(policy.distributorId)}/policy`, {
      method: "PUT",
      body: JSON.stringify(policy),
    }).then((d) => d.policy),

  distributorOrders: (distributorId: string) =>
    request<{ orders: OrderWithProduct[] }>(`/api/distributors/${encodeURIComponent(distributorId)}/orders`).then(
      (d) => d.orders,
    ),

  settings: () => request<SettingsResponse>("/api/settings"),

  saveSettings: (patch: Partial<AutonomySettings>) =>
    request<SettingsResponse>("/api/settings", { method: "PUT", body: JSON.stringify(patch) }),
};
