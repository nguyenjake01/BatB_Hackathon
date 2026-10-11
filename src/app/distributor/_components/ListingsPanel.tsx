"use client";

import { useState } from "react";
import type { Distributor, Product } from "@/types";
import { api } from "@/app/_components/api";
import { EmptyState, Panel } from "@/app/_components/Panel";
import { dateTime, money, num } from "@/app/_components/format";
import { inputClass } from "./styles";
import { button } from "@/app/_components/ui";

export function ListingsPanel({
  distributor,
  listings,
  onSaved,
  onError,
}: {
  distributor: Distributor;
  listings: Product[];
  onSaved: (p: Product) => Promise<void>;
  onError: (text: string) => void;
}) {
  return (
    <Panel
      title="Your listings"
      description={
        distributor.claimed
          ? "Scraped from your website. Edit the price and stock the buyer agent sees."
          : "Scraped from your website. Claim this business to edit them."
      }
    >
      {listings.length === 0 ? (
        <EmptyState>No listings for {distributor.name}.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {listings.map((p) => (
            <ListingRow
              key={`${p.id}-${p.unitPrice}-${p.stockQuantity}-${p.inStock}`}
              product={p}
              editable={distributor.claimed}
              onSave={async (patch) => {
                try {
                  await onSaved(await api.updateProduct(distributor.id, p.id, patch));
                } catch (error) {
                  onError(`Couldn't save ${p.name}: ${(error as Error).message}`);
                }
              }}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ListingRow({
  product,
  editable,
  onSave,
}: {
  product: Product;
  editable: boolean;
  onSave: (patch: Pick<Product, "unitPrice" | "stockQuantity" | "inStock">) => Promise<void>;
}) {
  const [price, setPrice] = useState(String(product.unitPrice));
  const [stock, setStock] = useState(product.stockQuantity === undefined ? "" : String(product.stockQuantity));
  const [inStock, setInStock] = useState(product.inStock);
  const [saving, setSaving] = useState(false);

  const dirty =
    price !== String(product.unitPrice) ||
    stock !== (product.stockQuantity === undefined ? "" : String(product.stockQuantity)) ||
    inStock !== product.inStock;
  const valid = Number(price) > 0 && (stock === "" || (Number.isInteger(Number(stock)) && Number(stock) >= 0));

  async function save() {
    setSaving(true);
    await onSave({ unitPrice: Number(price), stockQuantity: stock === "" ? undefined : Number(stock), inStock });
    setSaving(false);
  }

  return (
    <li className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_8rem_8rem_auto_auto] md:items-end">
      <div>
        <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-stone-900 hover:underline">
          {product.name}
        </a>
        <div className="text-xs text-stone-500">
          {num(product.unitSize)} {product.unit} per pack · shipping {money(product.shippingCost)} · {product.leadTimeDays}-day
          delivery · scraped {dateTime(product.scrapedAt)}
        </div>
      </div>
      <label>
        <span className="mb-1 block text-xs font-medium text-stone-600">Price per pack ($)</span>
        <input
          type="number"
          min={0.01}
          step="0.01"
          value={price}
          disabled={!editable}
          onChange={(e) => setPrice(e.target.value)}
          className={inputClass}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-stone-600">Packs in stock</span>
        <input
          type="number"
          min={0}
          step={1}
          value={stock}
          placeholder="unknown"
          disabled={!editable}
          onChange={(e) => setStock(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 pb-2">
        <input
          type="checkbox"
          checked={inStock}
          disabled={!editable}
          onChange={(e) => setInStock(e.target.checked)}
          className="accent-stone-900"
        />
        <span className="text-stone-700">In stock</span>
      </label>
      <button
        type="button"
        onClick={save}
        disabled={!editable || !dirty || !valid || saving}
        className={button.primary}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </li>
  );
}
