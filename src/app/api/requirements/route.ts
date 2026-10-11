import { errorResponse, HttpError, readJson } from "@/lib/http";
import { store, type RequirementInput } from "@/lib/store";

export async function GET() {
  try {
    return Response.json({ requirements: await store.listRequirements() });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Creates a requirement, or replaces the existing one for the same item. */
export async function POST(request: Request) {
  try {
    const input = parseRequirement(await readJson(request));
    return Response.json({ requirement: await store.upsertRequirement(input) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function parseRequirement(body: Record<string, unknown>): RequirementInput {
  const { itemName, minStockLevel, maxBudget, qualityNotes = "" } = body;
  if (typeof itemName !== "string" || !itemName.trim()) {
    throw new HttpError(400, "itemName is required");
  }
  if (typeof minStockLevel !== "number" || !Number.isFinite(minStockLevel) || minStockLevel < 0) {
    throw new HttpError(400, "minStockLevel must be a number >= 0");
  }
  if (typeof maxBudget !== "number" || !Number.isFinite(maxBudget) || maxBudget <= 0) {
    throw new HttpError(400, "maxBudget must be a number > 0");
  }
  if (typeof qualityNotes !== "string") {
    throw new HttpError(400, "qualityNotes must be a string");
  }
  return { itemName: itemName.trim(), minStockLevel, maxBudget, qualityNotes: qualityNotes.trim() };
}
