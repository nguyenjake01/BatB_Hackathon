// What we scrape: distributors with public prices, plus a retail baseline, and the page
// per bakery staple that lists its products. Context.dev reads each listing page, so
// products are discovered live rather than pinned to product URLs.
//
// Verified with Context.dev on 2026-10-11:
// - WebstaurantStore search pages render server-side: works.
// - Bakers Authority search loads by JavaScript (empty), but its collection pages render: works
//   (occasionally captures an empty page, hence the wait and the retry in real.ts).
// - Costco Business Delivery: search never finishes loading and product pages hide prices
//   until a ZIP is set, so it can't be the baseline. Walmart search renders prices: works.
//
// shippingCost / leadTimeDays here are fallbacks, used only when the listing page doesn't
// state them. They come from each distributor's published shipping policy; check before
// the demo and adjust.

export interface DistributorSource {
  id: string;
  name: string;
  website: string;
  isRetailBaseline: boolean;
  /** The page listing this item's products, or null if this distributor doesn't carry it. */
  listingUrl: (item: TrackedItem) => string | null;
  /** Extra browser wait before capture, for pages that render listings with JavaScript. */
  waitForMs?: number;
  fallbackShippingCost: number;
  fallbackLeadTimeDays: number;
}

const BAKERS_AUTHORITY_COLLECTIONS: Record<string, string> = {
  Flour: "artisan-bread-flour",
  Butter: "bulk-butters",
  Sugar: "granulated-white-sugars",
  Eggs: "eggs-egg-products",
  Yeast: "yeasts-leavening",
  "Chocolate chips": "chocolate-chips-chunks",
};

export const DISTRIBUTORS: DistributorSource[] = [
  {
    id: "webstaurantstore",
    name: "WebstaurantStore",
    website: "https://www.webstaurantstore.com",
    isRetailBaseline: false,
    listingUrl: ({ term }) => `https://www.webstaurantstore.com/search/${term.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`,
    fallbackShippingCost: 19.99,
    fallbackLeadTimeDays: 4,
  },
  {
    // "Orders ship next business day."
    id: "bakers-authority",
    name: "Bakers Authority",
    website: "https://www.bakersauthority.com",
    isRetailBaseline: false,
    listingUrl: ({ itemName }) =>
      BAKERS_AUTHORITY_COLLECTIONS[itemName] ? `https://www.bakersauthority.com/collections/${BAKERS_AUTHORITY_COLLECTIONS[itemName]}` : null,
    // Collection pages occasionally capture before the product grid renders.
    waitForMs: 3000,
    fallbackShippingCost: 24.99,
    fallbackLeadTimeDays: 4,
  },
  {
    // Retail baseline: what the bakery pays today. Free shipping on orders over $35.
    id: "walmart",
    name: "Walmart",
    website: "https://www.walmart.com",
    isRetailBaseline: true,
    listingUrl: ({ retailTerm, term }) => `https://www.walmart.com/search?q=${encodeURIComponent(retailTerm ?? term)}`,
    waitForMs: 3000,
    fallbackShippingCost: 0,
    fallbackLeadTimeDays: 2,
  },
];

export interface TrackedItem {
  /** Matches the Square inventory item name. */
  itemName: string;
  term: string;
  /** Search term for the retail baseline, where bulk sizes don't exist. Defaults to `term`. */
  retailTerm?: string;
  /** Listings whose title matches are substitutes or a different product, not this staple. */
  exclude: RegExp;
}

export const TRACKED_ITEMS: TrackedItem[] = [
  { itemName: "Flour", term: "bread flour 50 lb", retailTerm: "bread flour", exclude: /\b(gluten[- ]free|almond|rice|coconut|oat|corn|mix)\b/i },
  {
    itemName: "Butter",
    term: "unsalted butter",
    exclude: /\b(vegan|plant[- ]based|margarine|substitute|blend|spread|sheets?|whipped|cups?|pats?|chips?|reddies)\b/i,
  },
  {
    itemName: "Sugar",
    term: "granulated sugar 50 lb",
    retailTerm: "granulated sugar",
    exclude: /\b(brown|powdered|confectioners?|substitute|packets?|cubes?|coarse|sanding|icing)\b/i,
  },
  {
    itemName: "Eggs",
    term: "large eggs",
    exclude: /\b(liquid|powder(ed)?|dried|substitute|egg whites?|yolks?|hard[- ]boiled|patty|patties|scrambled|plastic|easter|chocolate)\b/i,
  },
  { itemName: "Yeast", term: "instant dry yeast", exclude: /\b(nutritional|extract|fresh|cake)\b/i },
  {
    itemName: "Chocolate chips",
    term: "semi-sweet chocolate chips",
    exclude: /\b(white|milk chocolate|cookies?|carob|butterscotch|peanut)\b/i,
  },
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
    `This is a product listing page (search results or a category) where we want "${term}". Extract up to 8 product listings that are actually ${term} ` +
    `(skip unrelated items, equipment, vegan or plant-based substitutes, and items without a visible price). Prefer plain ` +
    `bulk/foodservice packs. price is the current price of one sellable unit. ` +
    `packQuantity and packUnit describe the total contents of that unit: "1 lb. - 36/Case" means 36 lb; "2 x 1 lb" means 2 lb; ` +
    `"15 dozen case" means 15 dozen; "360/Case" eggs means 360 each. Do not invent values; use null when not shown.`
  );
}
