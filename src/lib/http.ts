// Small helpers for API route handlers.

import { NotImplementedError } from "@/lib/config";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Converts a thrown error into a JSON `{ error }` response with a sensible status code. */
export function errorResponse(error: unknown): Response {
  const status =
    error instanceof HttpError ? error.status : error instanceof NotImplementedError ? 501 : 500;
  if (status >= 500) console.error(error);
  return Response.json({ error: errorMessage(error) }, { status });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}
