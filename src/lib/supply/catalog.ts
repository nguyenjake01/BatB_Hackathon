// What we scrape: distributors with public prices, plus a retail baseline, and the
// search terms per bakery staple. Context.dev reads each distributor's own search page
// for each term, so listings are discovered live rather than pinned to product URLs.
//
// shippingCost / leadTimeDays here are fallbacks, used only when the listing page doesn't
// state them. They come from each distributor's published shipping policy; check before
// the demo and adjust.

export interface DistributorSource {
  id: string;
  name: string;
  website: string;
  isRetailBaseline: boolean;
  searchUrl: (term: string) => string;
  fallbackShippingCost: number;
  fallbackLeadTimeDays: number;
}

export const DISTRIBUTORS: DistributorSource[] = [
  {
    id: "webstaurantstore",
    name: "WebstaurantStore",
    website: "https://www.webstaurantstore.com",
    isRetailBaseline: false,
    searchUrl: (term) => `https://www.webstaurantstore.com/search/${term.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`,
    fallbackShippingCost: 19.99,
    fallbackLeadTimeDays: 4,
  },
  {
    id: "bakers-authority",
    name: "Bakers Authority",
    website: "https://www.bakersauthority.com",
    isRetailBaseline: false,
    searchUrl: (term) => `https://www.bakersauthority.com/search?type=product&q=${encodeURIComponent(term)}`,
    fallbackShippingCost: 24.99,
    fallbackLeadTimeDays: 5,
  },
  {
    // Costco Business Delivery quotes delivered prices, so shipping is included in the price.
    id: "costco-business",
    name: "Costco Business Delivery",
    website: "https://www.costcobusinessdelivery.com",
    isRetailBaseline: true,
    searchUrl: (term) => `https://www.costcobusinessdelivery.com/s?keyword=${encodeURIComponent(term)}`,
    fallbackShippingCost: 0,
    fallbackLeadTimeDays: 3,
  },
];

/** Inventory item name → search term. Item names match the Square inventory. */
export const TRACKED_ITEMS: { itemName: string; term: string }[] = [
  { itemName: "Flour", term: "bread flour 50 lb" },
  { itemName: "Butter", term: "unsalted butter" },
  { itemName: "Sugar", term: "granulated sugar 50 lb" },
  { itemName: "Eggs", term: "large eggs" },
  { itemName: "Yeast", term: "instant dry yeast" },
  { itemName: "Chocolate chips", term: "semi-sweet chocolate chips" },
];

/** Max listings kept per distributor per item. */
export const LISTINGS_PER_SOURCE = 4;

export const LISTING_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full product title as shown" },
          price: { type: "number", description: "Current price in USD for one sellable unit (the case, bag, or box)" },
          packQuantity: { type: "number", description: "Total amount in one sellable unit, e.g. 36 for '1 lb. - 36/Case', 50 for '50 lb bag'" },
          packUnit: { type: "string", description: "Unit of packQuantity: lb, oz, kg, g, each, or dozen" },
          productUrl: { type: ["string", "null"], description: "Absolute URL of the product detail page" },
          inStock: { type: ["boolean", "null"] },
          shippingCost: { type: ["number", "null"], description: "Shipping cost in USD if the page states it, else null" },
          shipsInDays: { type: ["number", "null"], description: "Business days until it ships or arrives if stated, else null" },
        },
        required: ["name", "price", "packQuantity", "packUnit"],
      },
    },
  },
  required: ["products"],
};

export function listingInstructions(term: string): string {
  return (
    `This is a distributor search results page for "${term}". Extract up to 8 product listings that are actually ${term} ` +
    `(skip unrelated items, equipment, and items without a visible price). price is the current price of one sellable unit. ` +
    `packQuantity and packUnit describe the total contents of that unit: "1 lb. - 36/Case" means 36 lb; "2 x 1 lb" means 2 lb; ` +
    `"15 dozen case" means 15 dozen; "360/Case" eggs means 360 each. Do not invent values; use null when not shown.`
  );
}
