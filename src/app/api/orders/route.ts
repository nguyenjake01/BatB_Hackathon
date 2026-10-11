import { errorResponse } from "@/lib/http";
import { withProducts } from "@/lib/orders";
import { store } from "@/lib/store";

export async function GET() {
  try {
    return Response.json({ orders: await withProducts(await store.listOrders()) });
  } catch (error) {
    return errorResponse(error);
  }
}
