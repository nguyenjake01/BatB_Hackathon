// Real supply source backed by the Context.dev web-scraping API.

import { NotImplementedError } from "@/lib/config";
import type { SupplySource } from "./index";

export const contextDevSupply: SupplySource = {
  async getProducts(itemName) {
    // TODO(Person 1): Scrape distributor listings for `itemName` with the Context.dev API
    // (process.env.CONTEXT_DEV_API_KEY) and map each result to a `Product`.
    // Include a Costco listing as the price baseline. Normalize units with `normalizeUnit`
    // from "@/lib/units", and make sure titles contain the item name (see "@/lib/matching").
    throw new NotImplementedError(`Context.dev getProducts("${itemName}")`, "supply");
  },

  async refreshCatalog() {
    // TODO(Person 1): Re-scrape all tracked items (the inventory item names) and return
    // the combined catalog. Consider caching so the agent doesn't scrape on every run.
    throw new NotImplementedError("Context.dev refreshCatalog()", "supply");
  },
};
