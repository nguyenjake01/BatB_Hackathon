// Minimal Context.dev REST client (https://docs.context.dev, OpenAPI at /openapi.json).
// Auth: `Authorization: Bearer $CONTEXT_DEV_API_KEY`. Server-only.

const BASE_URL = "https://api.context.dev/v1";

export class ContextDevError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ContextDevError";
  }
}

async function post<T>(path: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  const key = process.env.CONTEXT_DEV_API_KEY;
  if (!key) throw new ContextDevError("CONTEXT_DEV_API_KEY is not set");

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.message ?? data?.error?.message ?? data?.error ?? res.statusText;
    throw new ContextDevError(`Context.dev ${path} failed (${res.status}): ${typeof detail === "string" ? detail : JSON.stringify(detail)}`, res.status);
  }
  return data as T;
}

interface ScrapeOutput<T> {
  requested: boolean;
  success: boolean | null;
  data: T | null;
  error_code?: string;
  message?: string;
}

/**
 * POST /web/scrape with the `json` format: Context.dev renders the page and returns an
 * object matching `schema`. `maxAgeMs: 0` forces a fresh scrape (needed for price monitoring).
 */
export async function scrapeJson<T>(url: string, schema: object, instructions: string, maxAgeMs = 0): Promise<T> {
  const res = await post<{ url: string; json: ScrapeOutput<T> }>("/web/scrape", {
    url,
    formats: { json: true },
    jsonParams: { schema, instructions },
    sharedParams: { country: "US", dismissPopups: true },
    maxAgeMs,
  });
  if (!res.json?.success || !res.json.data) {
    throw new ContextDevError(`Scrape of ${url} failed: ${res.json?.error_code ?? "no data"} ${res.json?.message ?? ""}`.trim());
  }
  return res.json.data;
}

export interface SearchResult {
  url: string;
  title: string;
  description: string;
  relevance: "high" | "medium" | "low";
}

/** POST /web/search: ranked web results (10–100). */
export async function searchWeb(
  query: string,
  options: { freshness?: "last_24_hours" | "last_week" | "last_month" | "last_year"; numResults?: number } = {},
): Promise<SearchResult[]> {
  const res = await post<{ results: SearchResult[] }>("/web/search", { query, numResults: 10, ...options });
  return res.results ?? [];
}
