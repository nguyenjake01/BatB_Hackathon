// Typed client for our API routes.

import type { InventoryItem, OrderWithProduct, Requirement } from "@/types";

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
};
