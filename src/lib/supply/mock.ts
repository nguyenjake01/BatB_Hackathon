// Mock supply source: realistic bakery listings from 3 distributors per item,
// including a Costco baseline for price comparison. Prices are made up.

import type { Product, Signal } from "@/types";
import { newId } from "@/lib/ids";
import { productMatchesItem } from "@/lib/matching";
import type { SupplySource } from "./index";

const COSTCO = { distributorId: "costco", distributorName: "Costco Business Center", isRetailBaseline: true };
const DEPOT = { distributorId: "restaurant-depot", distributorName: "Restaurant Depot", isRetailBaseline: false };
const WEBSTAURANT = { distributorId: "webstaurantstore", distributorName: "WebstaurantStore", isRetailBaseline: false };
const US_FOODS = { distributorId: "us-foods-chefstore", distributorName: "US Foods CHEF'STORE", isRetailBaseline: false };

type Listing = Omit<Product, "scrapedAt" | "sourceUrl" | "inStock">;

const LISTINGS: Listing[] = [
  // Flour
  { id: "costco-ap-flour-25lb", name: "All-Purpose Flour, Unbleached, 25 lb bag", ...COSTCO, unitPrice: 12.49, unitSize: 25, unit: "lb", shippingCost: 9.99, leadTimeDays: 2 },
  { id: "depot-bread-flour-50lb", name: "Bread Flour, Unbleached, 50 lb bag", ...DEPOT, unitPrice: 21.99, unitSize: 50, unit: "lb", shippingCost: 18, leadTimeDays: 3 },
  { id: "webstaurant-ap-flour-50lb", name: "All-Purpose Flour, Bleached, 50 lb bag", ...WEBSTAURANT, unitPrice: 19.49, unitSize: 50, unit: "lb", shippingCost: 14.5, leadTimeDays: 4 },

  // Butter
  { id: "costco-butter-4x1lb", name: "Unsalted Butter, 4 x 1 lb", ...COSTCO, unitPrice: 13.99, unitSize: 4, unit: "lb", shippingCost: 9.99, leadTimeDays: 2 },
  { id: "depot-butter-36lb", name: "Unsalted Butter Solids, 36 lb case", ...DEPOT, unitPrice: 112.5, unitSize: 36, unit: "lb", shippingCost: 25, leadTimeDays: 3 },
  { id: "usfoods-euro-butter-36lb", name: "European-Style Unsalted Butter 82%, 36 lb case", ...US_FOODS, unitPrice: 149, unitSize: 36, unit: "lb", shippingCost: 20, leadTimeDays: 4 },

  // Sugar
  { id: "costco-sugar-25lb", name: "Granulated Sugar, 25 lb bag", ...COSTCO, unitPrice: 15.99, unitSize: 25, unit: "lb", shippingCost: 9.99, leadTimeDays: 2 },
  { id: "depot-cane-sugar-50lb", name: "Granulated Cane Sugar, 50 lb bag", ...DEPOT, unitPrice: 29.5, unitSize: 50, unit: "lb", shippingCost: 18, leadTimeDays: 3 },
  { id: "webstaurant-sugar-50lb", name: "Granulated Sugar, 50 lb bag", ...WEBSTAURANT, unitPrice: 34.99, unitSize: 50, unit: "lb", shippingCost: 0, leadTimeDays: 5 },

  // Eggs (sold by the dozen; inventory counts each egg)
  { id: "costco-eggs-5dz", name: "Large Grade AA Eggs, 5 dozen", ...COSTCO, unitPrice: 14.49, unitSize: 5, unit: "dozen", shippingCost: 9.99, leadTimeDays: 1 },
  { id: "depot-eggs-15dz", name: "Large Eggs, 15 dozen case", ...DEPOT, unitPrice: 41.25, unitSize: 15, unit: "dozen", shippingCost: 15, leadTimeDays: 2 },
  { id: "usfoods-cagefree-eggs-15dz", name: "Large Cage-Free Eggs, 15 dozen case", ...US_FOODS, unitPrice: 52, unitSize: 15, unit: "dozen", shippingCost: 12, leadTimeDays: 3 },

  // Yeast
  { id: "costco-instant-yeast-2lb", name: "Instant Dry Yeast, 2 x 1 lb", ...COSTCO, unitPrice: 6.99, unitSize: 2, unit: "lb", shippingCost: 9.99, leadTimeDays: 2 },
  { id: "webstaurant-instant-yeast-20lb", name: "Instant Dry Yeast, 20 x 1 lb case", ...WEBSTAURANT, unitPrice: 79.99, unitSize: 20, unit: "lb", shippingCost: 0, leadTimeDays: 4 },
  { id: "depot-active-yeast-2lb", name: "Active Dry Yeast, 2 lb", ...DEPOT, unitPrice: 8.49, unitSize: 2, unit: "lb", shippingCost: 18, leadTimeDays: 3 },

  // Chocolate chips
  { id: "costco-choc-chips-4.5lb", name: "Semi-Sweet Chocolate Chips, 4.5 lb", ...COSTCO, unitPrice: 14.99, unitSize: 4.5, unit: "lb", shippingCost: 9.99, leadTimeDays: 2 },
  { id: "webstaurant-choc-chips-25lb", name: "Semi-Sweet Chocolate Chips 1M, 25 lb case", ...WEBSTAURANT, unitPrice: 79.99, unitSize: 25, unit: "lb", shippingCost: 0, leadTimeDays: 3 },
  { id: "depot-dark-choc-chips-30lb", name: "Dark Chocolate Chips 60%, 30 lb case", ...DEPOT, unitPrice: 119, unitSize: 30, unit: "lb", shippingCost: 18, leadTimeDays: 3 },
];

function withScrapeInfo(listing: Listing): Product {
  return {
    ...listing,
    inStock: true,
    sourceUrl: `https://example.com/mock-listings/${listing.id}`,
    scrapedAt: new Date().toISOString(),
  };
}

export const mockSupply: SupplySource = {
  async getProducts(itemName) {
    return LISTINGS.filter((l) => productMatchesItem(l.name, itemName)).map(withScrapeInfo);
  },

  async refreshCatalog() {
    return LISTINGS.map(withScrapeInfo);
  },

  async refreshSignals(itemNames) {
    const detectedAt = new Date().toISOString();
    return MOCK_SIGNALS.filter((s) => itemNames.some((name) => name.toLowerCase() === s.itemName.toLowerCase())).map(
      (s) => ({ id: newId("sig"), ...s, detectedAt }),
    );
  },
};

const MOCK_SIGNALS: Omit<Signal, "id" | "detectedAt">[] = [
  {
    itemName: "Butter",
    kind: "news",
    direction: "buy_early",
    summary: "(Mock) Dairy futures up 8% this week on lower milk output; wholesale butter prices expected to rise.",
    sourceUrl: "https://example.com/mock-news/butter-prices",
  },
  {
    itemName: "Sugar",
    kind: "price_change",
    direction: "wait",
    summary: "(Mock) Restaurant Depot cut granulated sugar 50 lb from $31.50 to $29.50.",
    sourceUrl: "https://example.com/mock-listings/depot-cane-sugar-50lb",
  },
];
