// Typed client for our API routes.

import type {
  AutonomySettings,
  Distributor,
  InventoryItem,
  Negotiation,
  OrderWithProduct,
  Product,
  Quote,
  Requirement,
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

  settings: () => request<SettingsResponse>("/api/settings"),

  saveSettings: (patch: Partial<AutonomySettings>) =>
    request<SettingsResponse>("/api/settings", { method: "PUT", body: JSON.stringify(patch) }),
};
