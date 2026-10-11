import { isMockMode } from "@/lib/config";
import { errorResponse } from "@/lib/http";
import { refreshReport } from "@/lib/supply";

/** Where the catalog comes from and how the last scrape went (per distributor and item). */
export async function GET() {
  try {
    return Response.json({ mock: isMockMode("supply"), ...refreshReport() });
  } catch (error) {
    return errorResponse(error);
  }
}
