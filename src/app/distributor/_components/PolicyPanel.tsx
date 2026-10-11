"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Distributor, DistributorPolicy } from "@/types";
import { api } from "@/app/_components/api";
import { Loading, NotConnected, Panel } from "@/app/_components/Panel";
import { inputClass } from "./styles";
import { button, label as labelClass, pill } from "@/app/_components/ui";

/** Percent fields are edited as whole percents and stored as fractions. */
interface Draft {
  floorPct: string;
  concessionPct: string;
  highStockThreshold: string;
  autoAccept: boolean;
  tiers: { minQty: string; discountPct: string }[];
}

const toDraft = (p: DistributorPolicy): Draft => ({
  floorPct: String(Math.round(p.floorPricePct * 1000) / 10),
  concessionPct: String(Math.round(p.concessionRate * 1000) / 10),
  highStockThreshold: String(p.highStockThreshold),
  autoAccept: p.autoAccept,
  tiers: p.volumeTiers.map((t) => ({ minQty: String(t.minQty), discountPct: String(Math.round(t.discountPct * 1000) / 10) })),
});

const narrowInput = inputClass.replace("w-full", "w-24");

const inRange = (s: string, min: number, max: number) => s !== "" && Number(s) >= min && Number(s) <= max;

export function PolicyPanel({
  distributor,
  onSaved,
  onError,
}: {
  distributor: Distributor;
  onSaved: () => void;
  onError: (text: string) => void;
}) {
  const [policy, setPolicy] = useState<DistributorPolicy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.policy(distributor.id).then(
      (p) => {
        if (cancelled) return;
        setPolicy(p);
        setDraft(toDraft(p));
      },
      (e: Error) => {
        if (!cancelled) setLoadError(e.message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [distributor.id]);

  const editable = distributor.claimed;
  const badge = policy?.isDefault && (
    <span className={pill.gray}>default policy</span>
  );

  if (!policy || !draft) {
    return (
      <Panel title="Your negotiation agent" description="How far your agent may go when the buyer's agent haggles.">
        {loadError ? <NotConnected what="Agent policy" detail={loadError} /> : <Loading>Loading policy…</Loading>}
      </Panel>
    );
  }

  const valid =
    inRange(draft.floorPct, 1, 100) &&
    inRange(draft.concessionPct, 0, 100) &&
    inRange(draft.highStockThreshold, 0, Infinity) &&
    draft.tiers.every((t) => inRange(t.minQty, 1, Infinity) && inRange(t.discountPct, 0, 99.9));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !policy) return;
    setSaving(true);
    try {
      const saved = await api.savePolicy({
        distributorId: distributor.id,
        isDefault: false,
        floorPricePct: Number(draft.floorPct) / 100,
        concessionRate: Number(draft.concessionPct) / 100,
        highStockThreshold: Number(draft.highStockThreshold),
        autoAccept: draft.autoAccept,
        volumeTiers: draft.tiers
          .map((t) => ({ minQty: Number(t.minQty), discountPct: Number(t.discountPct) / 100 }))
          .sort((a, b) => a.minQty - b.minQty),
      });
      setPolicy(saved);
      setDraft(toDraft(saved));
      onSaved();
    } catch (error) {
      onError(`Couldn't save the policy: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  return (
    <Panel
      title="Your negotiation agent"
      description={
        editable
          ? "How far your agent may go when the buyer's agent haggles."
          : "Unclaimed businesses negotiate with the default policy. Claim yours to change it."
      }
      action={badge}
    >
      <form onSubmit={submit} className="grid gap-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className={labelClass}>Floor price (% of list)</span>
            <input
              type="number"
              min={1}
              max={100}
              step="any"
              value={draft.floorPct}
              disabled={!editable}
              onChange={(e) => set({ floorPct: e.target.value })}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-stone-500">Your agent never sells below this.</span>
          </label>
          <label>
            <span className={labelClass}>Concession per round (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              value={draft.concessionPct}
              disabled={!editable}
              onChange={(e) => set({ concessionPct: e.target.value })}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-stone-500">Share of the price gap it gives up each round.</span>
          </label>
          <label>
            <span className={labelClass}>High-stock threshold (packs)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={draft.highStockThreshold}
              disabled={!editable}
              onChange={(e) => set({ highStockThreshold: e.target.value })}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-stone-500">Above this, it concedes 1.5× faster.</span>
          </label>
        </div>

        <fieldset>
          <legend className="mb-1 font-medium text-stone-700">Volume discounts</legend>
          {draft.tiers.length === 0 && <p className="text-xs text-stone-500">No volume discounts.</p>}
          <ul className="grid gap-2">
            {draft.tiers.map((tier, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="text-stone-600">From</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={tier.minQty}
                  disabled={!editable}
                  aria-label="Minimum packs"
                  onChange={(e) => set({ tiers: draft.tiers.map((t, j) => (j === i ? { ...t, minQty: e.target.value } : t)) })}
                  className={narrowInput}
                />
                <span className="text-stone-600">packs,</span>
                <input
                  type="number"
                  min={0}
                  max={99.9}
                  step="any"
                  value={tier.discountPct}
                  disabled={!editable}
                  aria-label="Discount percent"
                  onChange={(e) =>
                    set({ tiers: draft.tiers.map((t, j) => (j === i ? { ...t, discountPct: e.target.value } : t)) })
                  }
                  className={narrowInput}
                />
                <span className="text-stone-600">% off</span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => set({ tiers: draft.tiers.filter((_, j) => j !== i) })}
                    className={`${button.ghost} px-2 py-1 text-xs`}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editable && (
            <button
              type="button"
              onClick={() => set({ tiers: [...draft.tiers, { minQty: "", discountPct: "" }] })}
              className={`${button.link} mt-2 text-xs`}
            >
              Add discount tier
            </button>
          )}
        </fieldset>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.autoAccept}
            disabled={!editable}
            onChange={(e) => set({ autoAccept: e.target.checked })}
            className="accent-stone-900"
          />
          <span className="text-stone-700">Auto-accept deals within these limits</span>
        </label>

        {editable && (
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!valid || saving}
              className={button.primary}
            >
              {saving ? "Saving…" : "Save policy"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(toDraft(policy))}
              className={button.ghost}
            >
              Reset
            </button>
          </div>
        )}
      </form>
    </Panel>
  );
}
