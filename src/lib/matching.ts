// Name matching between inventory items and distributor listings.
// `Product` has no item/category field, so listings are matched to items by name:
// a listing matches when every word of the item name appears in the listing title.
// If real scraped titles don't contain the item name, normalize them in the supply
// module, or agree with the team on adding a field to `Product`.

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word));
}

export function productMatchesItem(productName: string, itemName: string): boolean {
  const productWords = new Set(tokenize(productName));
  const itemWords = tokenize(itemName);
  return itemWords.length > 0 && itemWords.every((word) => productWords.has(word));
}

export function sameItemName(a: string, b: string): boolean {
  return tokenize(a).join(" ") === tokenize(b).join(" ");
}
