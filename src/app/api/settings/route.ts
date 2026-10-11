// Autonomy settings (owner: Person 2, Jason). P0.
// Both methods return `{ settings, spentLast7Days }` so the UI can show "spent this week".

import type { AutonomySettings } from "@/types";
import { errorResponse, HttpError, readJson } from "@/lib/http";
import { store } from "@/lib/store";

async function respond(settings: AutonomySettings) {
  return Response.json({ settings, spentLast7Days: await store.spentLast7Days() });
}

export async function GET() {
  try {
    return await respond(await store.getSettings());
  } catch (error) {
    return errorResponse(error);
  }
}

/** Updates any subset of `mode`, `perOrderLimit`, `weeklyBudget`. */
export async function PUT(request: Request) {
  try {
    return await respond(await store.updateSettings(parseSettings(await readJson(request))));
  } catch (error) {
    return errorResponse(error);
  }
}

function parseSettings(body: Record<string, unknown>): Partial<AutonomySettings> {
  const patch: Partial<AutonomySettings> = {};
  if (body.mode !== undefined) {
    if (body.mode !== "approval" && body.mode !== "auto") throw new HttpError(400, 'mode must be "approval" or "auto"');
    patch.mode = body.mode;
  }
  for (const key of ["perOrderLimit", "weeklyBudget"] as const) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new HttpError(400, `${key} must be a number >= 0`);
    }
    patch[key] = value;
  }
  if (Object.keys(patch).length === 0) throw new HttpError(400, "Provide mode, perOrderLimit, or weeklyBudget");
  return patch;
}
