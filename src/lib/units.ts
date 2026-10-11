// Unit normalization and conversion, shared by supply and agent code.
// Scraped listings use many spellings ("lbs", "LB", "pound"), so normalize first.

const ALIASES: Record<string, string> = {
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  kg: "kg",
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",
  g: "g",
  gram: "g",
  grams: "g",
  each: "each",
  ea: "each",
  ct: "each",
  count: "each",
  dozen: "dozen",
  dz: "dozen",
};

/** Size of each unit in its dimension's base unit (lb for mass, each for count). */
const FACTORS: Record<string, { dimension: "mass" | "count"; factor: number }> = {
  lb: { dimension: "mass", factor: 1 },
  oz: { dimension: "mass", factor: 1 / 16 },
  kg: { dimension: "mass", factor: 2.20462 },
  g: { dimension: "mass", factor: 0.00220462 },
  each: { dimension: "count", factor: 1 },
  dozen: { dimension: "count", factor: 12 },
};

export function normalizeUnit(unit: string): string {
  const key = unit.trim().toLowerCase();
  return ALIASES[key] ?? key;
}

/** Converts `quantity` from one unit to another. Returns null if the units are incompatible. */
export function convertUnits(quantity: number, from: string, to: string): number | null {
  const a = normalizeUnit(from);
  const b = normalizeUnit(to);
  if (a === b) return quantity;
  const fa = FACTORS[a];
  const fb = FACTORS[b];
  if (!fa || !fb || fa.dimension !== fb.dimension) return null;
  return (quantity * fa.factor) / fb.factor;
}
