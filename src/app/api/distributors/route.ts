import { errorResponse, HttpError, readJson } from "@/lib/http";
import { store } from "@/lib/store";
import { getInventory } from "@/lib/square";
import { getProducts } from "@/lib/supply";

/**
 * All distributors (claimed or not) with their listings and agent policy, for the
 * distributor portal. On a fresh server, loads the cached catalog (the committed snapshot)
 * rather than re-scraping, which is slow and trips Context.dev's concurrency limit.
 */
export async function GET() {
  try {
    if ((await store.listProducts()).length === 0) {
      const inventory = await getInventory();
      await store.upsertProducts((await Promise.all(inventory.map((item) => getProducts(item.name)))).flat());
    }
    const [distributors, products] = await Promise.all([store.listDistributors(), store.listProducts()]);
    const withDetails = await Promise.all(
      distributors.map(async (d) => ({
        ...d,
        policy: await store.getPolicy(d.id),
        products: products.filter((p) => p.distributorId === d.id),
      })),
    );
    return Response.json({ distributors: withDetails });
  } catch (error) {
    return errorResponse(error);
  }
}

const WALLET = /^0x[0-9a-fA-F]{40}$/;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/**
 * A distributor that signs up itself rather than claiming a scraped listing. It starts
 * claimed (it owns its listings) with the default agent policy. Body: { name, website?, payoutWallet? }.
 */
export async function POST(request: Request) {
  try {
    const { name, website, payoutWallet } = await readJson(request);
    if (typeof name !== "string" || name.trim().length < 2) throw new HttpError(400, "name is required");
    // Optional: without a payout wallet, checkout pays the platform's DEMO_DISTRIBUTOR_WALLET.
    if (payoutWallet !== undefined && payoutWallet !== "" && (typeof payoutWallet !== "string" || !WALLET.test(payoutWallet))) {
      throw new HttpError(400, "payoutWallet must be a 0x-prefixed Base Sepolia address");
    }
    if (website !== undefined && website !== "" && (typeof website !== "string" || !/^https?:\/\//.test(website))) {
      throw new HttpError(400, "website must start with http:// or https://");
    }
    const id = slug(name);
    if (!id) throw new HttpError(400, "name must contain letters or numbers");
    if (await store.getDistributor(id)) throw new HttpError(409, `A distributor named ${name.trim()} already exists. Claim it instead.`);
    const distributor = await store.createDistributor({
      id,
      name: name.trim(),
      website: typeof website === "string" ? website : "",
      claimed: true,
      ...(typeof payoutWallet === "string" && payoutWallet ? { payoutWallet } : {}),
    });
    return Response.json({ distributor }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
