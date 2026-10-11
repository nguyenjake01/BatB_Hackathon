"use client";

import { useState, type FormEvent } from "react";
import type { InventoryItem, Requirement } from "@/types";
import { sameItemName } from "@/lib/matching";
import { EmptyState, Panel } from "./Panel";
import { money, qty } from "./format";
import { button, input as inputClass, label as labelClass } from "./ui";

const EMPTY_FORM = { itemName: "", minStockLevel: "", maxBudget: "", qualityNotes: "" };


export function RequirementsPanel({
  requirements,
  inventory,
  onSave,
}: {
  requirements: Requirement[];
  inventory: InventoryItem[];
  onSave: (input: Omit<Requirement, "id">) => Promise<boolean>;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const unitFor = (itemName: string) => inventory.find((i) => sameItemName(i.name, itemName))?.unit ?? "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const saved = await onSave({
      itemName: form.itemName,
      minStockLevel: Number(form.minStockLevel),
      maxBudget: Number(form.maxBudget),
      qualityNotes: form.qualityNotes,
    });
    setSaving(false);
    if (saved) setForm(EMPTY_FORM);
  }

  function edit(r: Requirement) {
    setForm({
      itemName: r.itemName,
      minStockLevel: String(r.minStockLevel),
      maxBudget: String(r.maxBudget),
      qualityNotes: r.qualityNotes ?? "",
    });
  }

  const formUnit = unitFor(form.itemName);

  return (
    <Panel title="Requirements" description="Rules the agent follows for each item. Saving an existing item replaces it.">
      {requirements.length === 0 ? (
        <EmptyState>No requirements yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {requirements.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div>
                <div className="font-medium text-stone-900">{r.itemName}</div>
                <div className="text-stone-500">
                  Min {qty(r.minStockLevel, unitFor(r.itemName) || "units")} · Budget {money(r.maxBudget)}
                  {r.qualityNotes && <> · “{r.qualityNotes}”</>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => edit(r)}
                className={`${button.link} shrink-0 text-xs`}
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className={labelClass}>Item</span>
          <input
            required
            list="inventory-items"
            value={form.itemName}
            onChange={(e) => setForm({ ...form, itemName: e.target.value })}
            placeholder="e.g. Flour"
            className={inputClass}
          />
          <datalist id="inventory-items">
            {inventory.map((i) => (
              <option key={i.sku} value={i.name} />
            ))}
          </datalist>
        </label>
        <label className="text-sm">
          <span className={labelClass}>
            Minimum stock{formUnit && ` (${formUnit})`}
          </span>
          <input
            required
            type="number"
            min={0}
            step="any"
            value={form.minStockLevel}
            onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Max budget per order ($)</span>
          <input
            required
            type="number"
            min={0.01}
            step="0.01"
            value={form.maxBudget}
            onChange={(e) => setForm({ ...form, maxBudget: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Quality notes</span>
          <input
            value={form.qualityNotes}
            onChange={(e) => setForm({ ...form, qualityNotes: e.target.value })}
            placeholder="e.g. unbleached"
            className={inputClass}
          />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className={button.primary}
          >
            {saving ? "Saving…" : "Save requirement"}
          </button>
          {form !== EMPTY_FORM && (
            <button
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
              className={button.ghost}
            >
              Clear
            </button>
          )}
        </div>
      </form>
    </Panel>
  );
}
