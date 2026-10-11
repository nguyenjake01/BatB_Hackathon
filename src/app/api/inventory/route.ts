import { errorResponse } from "@/lib/http";
import { getInventory } from "@/lib/square";

export async function GET() {
  try {
    return Response.json({ inventory: await getInventory() });
  } catch (error) {
    return errorResponse(error);
  }
}
