import { errorResponse } from "@/lib/http";
import { getInventory } from "@/lib/square";
import { store } from "@/lib/store";
import { refreshSignals } from "@/lib/supply";

/** Runs price monitoring + news search for every inventory item and replaces the signals. */
export async function POST() {
  try {
    const inventory = await getInventory();
    const signals = await refreshSignals(inventory.map((item) => item.name));
    await store.replaceSignals(signals);
    return Response.json({ signals });
  } catch (error) {
    return errorResponse(error);
  }
}
