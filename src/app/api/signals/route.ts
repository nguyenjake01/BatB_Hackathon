import { errorResponse } from "@/lib/http";
import { store } from "@/lib/store";

export async function GET() {
  try {
    return Response.json({ signals: await store.listSignals() });
  } catch (error) {
    return errorResponse(error);
  }
}
