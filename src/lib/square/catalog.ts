// Square API helper and the bakery's own item config (owner: Person 3).
//
// Kept free of "@/" imports so the seed script (seed.mjs) can import it directly with Node.
// API reference: https://developer.squareup.com/reference/square

const SQUARE_VERSION = "2026-09-16";

/** Days of inventory history used to compute `dailyUsage`. The seed script writes this much. */
export const USAGE_WINDOW_DAYS = 14;

/**
 * What Square doesn't store for us, keyed by item variation SKU. Square has no shelf life
 * field, and we keep units here instead of reading measurement units back from the catalog.
 */
export const ITEM_CONFIG: Record<string, { unit: string; shelfLifeDays: number }> = {
  "BAK-FLOUR": { unit: "lb", shelfLifeDays: 180 },
  "BAK-BUTTER": { unit: "lb", shelfLifeDays: 60 },
  "BAK-SUGAR": { unit: "lb", shelfLifeDays: 730 },
  "BAK-EGGS": { unit: "each", shelfLifeDays: 14 },
  "BAK-YEAST": { unit: "lb", shelfLifeDays: 120 },
  "BAK-CHOC-CHIPS": { unit: "lb", shelfLifeDays: 365 },
};

function baseUrl(): string {
  return process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

/** Calls the Square API and throws with Square's own error detail on failure. */
export async function squareFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN is not set. Add it to .env.local or set USE_MOCKS_SQUARE=true.");
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data.errors ?? []).map((e: { code?: string; detail?: string }) => e.detail ?? e.code).join("; ");
    throw new Error(`Square ${path} failed: ${res.status} ${detail || res.statusText}`);
  }
  return data as T;
}

/** The seller's first active location. Sandbox accounts come with one. */
export async function getLocationId(): Promise<string> {
  const { locations = [] } = await squareFetch<{ locations?: { id: string; status: string }[] }>("/v2/locations");
  const location = locations.find((l) => l.status === "ACTIVE");
  if (!location) throw new Error("No active Square location found.");
  return location.id;
}
