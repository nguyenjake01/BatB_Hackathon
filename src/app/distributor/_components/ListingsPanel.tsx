"use client";

import { useState, type FormEvent } from "react";
import type { Distributor, Product } from "@/types";
import { api } from "@/app/_components/api";
import { EmptyState, Panel } from "@/app/_components/Panel";
import { dateTime, money, num } from "@/app/_components/format";
import { inputClass } from "./styles";
import { button, label as labelClass } from "@/app/_components/ui";

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
          ? "Edit the price and stock buyers' agents see, or add a product."
          : "Scraped from your website. Claim this business to edit them."
      }
    >
      {listings.length === 0 ? (
        <EmptyState>No listings yet{distributor.claimed ? ". Add your first product below." : "."}</EmptyState>
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
      {distributor.claimed && <AddListingForm distributor={distributor} onSaved={onSaved} onError={onError} />}
    </Panel>
  );
}

const UNITS = ["lb", "oz", "kg", "g", "each", "dozen"];
const EMPTY = { name: "", unitPrice: "", unitSize: "", unit: "lb", shippingCost: "0", leadTimeDays: "3", stockQuantity: "" };

/** Lists a new product. The name should say what it is ("Unsalted Butter, 36 lb case") so the agent can match it. */
function AddListingForm({
  distributor,
  onSaved,
  onError,
}: {
  distributor: Distributor;
  onSaved: (p: Product) => Promise<void>;
  onError: (text: string) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof EMPTY>) => setForm({ ...form, ...patch });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const product = await api.addProduct(distributor.id, {
        name: form.name.trim(),
        unitPrice: Number(form.unitPrice),
        unitSize: Number(form.unitSize),
        unit: form.unit,
        shippingCost: Number(form.shippingCost),
        leadTimeDays: Number(form.leadTimeDays),
        stockQuantity: form.stockQuantity === "" ? undefined : Number(form.stockQuantity),
      });
      setForm(EMPTY);
      await onSaved(product);
    } catch (error) {
      onError(`Couldn't add the listing: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-3 border-t border-line pt-5 text-sm sm:grid-cols-6">
      <div className="font-medium text-stone-900 sm:col-span-6">Add a product</div>
      <label className="sm:col-span-6">
        <span className={labelClass}>Product name</span>
        <input
          required
          minLength={3}
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Unsalted Butter, 36 lb case"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-stone-500">Include the ingredient (flour, butter, sugar, eggs, yeast, chocolate chips) so buyers&apos; agents find it.</span>
      </label>
      <label className="sm:col-span-2">
        <span className={labelClass}>Price per pack ($)</span>
        <input required type="number" min={0.01} step="0.01" value={form.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} className={inputClass} />
      </label>
      <label className="sm:col-span-2">
        <span className={labelClass}>Pack size</span>
        <input required type="number" min={0.01} step="any" value={form.unitSize} onChange={(e) => set({ unitSize: e.target.value })} className={inputClass} />
      </label>
      <label className="sm:col-span-2">
        <span className={labelClass}>Unit</span>
        <select value={form.unit} onChange={(e) => set({ unit: e.target.value })} className={inputClass}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className={labelClass}>Shipping per order ($)</span>
        <input required type="number" min={0} step="0.01" value={form.shippingCost} onChange={(e) => set({ shippingCost: e.target.value })} className={inputClass} />
      </label>
      <label className="sm:col-span-2">
        <span className={labelClass}>Delivery (days)</span>
        <input required type="number" min={1} step={1} value={form.leadTimeDays} onChange={(e) => set({ leadTimeDays: e.target.value })} className={inputClass} />
      </label>
      <label className="sm:col-span-2">
        <span className={labelClass}>Packs in stock</span>
        <input type="number" min={0} step={1} value={form.stockQuantity} placeholder="optional" onChange={(e) => set({ stockQuantity: e.target.value })} className={inputClass} />
      </label>
      <div className="sm:col-span-6">
        <button type="submit" disabled={saving} className={button.primary}>
          {saving ? "Adding…" : "Add product"}
        </button>
      </div>
    </form>
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
