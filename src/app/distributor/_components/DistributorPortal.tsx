"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Distributor, Product } from "@/types";
import { api } from "@/app/_components/api";
import { EmptyState, Panel } from "@/app/_components/Panel";
import { IncomingOrdersPanel } from "./IncomingOrdersPanel";
import { ListingsPanel } from "./ListingsPanel";
import { PolicyPanel } from "./PolicyPanel";
import { inputClass } from "./styles";

type Banner = { kind: "error" | "success"; text: string };

const WALLET_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export function DistributorPortal({ paymentsMocked }: { paymentsMocked: boolean }) {
  const [distributors, setDistributors] = useState<Distributor[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [banner, setBanner] = useState<Banner | null>(null);

  const load = useCallback(async () => {
    const [d, p] = await Promise.allSettled([api.distributors(), api.products()]);
    if (d.status === "fulfilled") setDistributors(d.value);
    if (p.status === "fulfilled") setProducts(p.value);
    const failed = [d, p].find((r): r is PromiseRejectedResult => r.status === "rejected");
    setLoadError(failed ? (failed.reason as Error).message : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.distributors(), api.products()]).then(([d, p]) => {
      if (cancelled) return;
      setDistributors(d.status === "fulfilled" ? d.value : []);
      if (p.status === "fulfilled") setProducts(p.value);
      const failed = [d, p].find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed) setLoadError((failed.reason as Error).message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = distributors?.find((d) => d.id === selectedId) ?? null;
  const listings = products.filter((p) => p.distributorId === selectedId);

  function report(kind: Banner["kind"], text: string) {
    setBanner({ kind, text });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Distributor portal</h1>
        <p className="text-sm text-stone-500">
          Claim your listings, set prices and stock, tell your agent how far it may negotiate, and see AUSD payments.
        </p>
      </header>

      {banner && (
        <div
          className={`mb-6 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            banner.kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="font-medium opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6">
        <Panel title="Find your business" description="Every distributor the agent has scraped prices from.">
          {distributors === null ? (
            <EmptyState>Loading distributors…</EmptyState>
          ) : distributors.length === 0 ? (
            <EmptyState>{loadError ? `Distributors unavailable: ${loadError}` : "No distributors yet."}</EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-stone-700">Distributor</span>
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
                  <option value="">Choose your business…</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.claimed ? " (claimed)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <ClaimForm
                  key={selected.id}
                  distributor={selected}
                  onClaimed={async (d) => {
                    report("success", `${d.name} is claimed. Payments now go to your wallet.`);
                    await load();
                  }}
                  onError={(text) => report("error", text)}
                />
              )}
            </div>
          )}
        </Panel>

        {selected && (
          <>
            <ListingsPanel
              distributor={selected}
              listings={listings}
              onSaved={async (p) => {
                report("success", `Saved ${p.name}.`);
                await load();
              }}
              onError={(text) => report("error", text)}
            />
            <PolicyPanel
              key={selected.id}
              distributor={selected}
              onSaved={() => report("success", "Agent policy saved. It applies to the next negotiation.")}
              onError={(text) => report("error", text)}
            />
            <IncomingOrdersPanel key={`orders-${selected.id}`} distributor={selected} paymentsMocked={paymentsMocked} />
          </>
        )}
      </div>
    </div>
  );
}

function ClaimForm({
  distributor,
  onClaimed,
  onError,
}: {
  distributor: Distributor;
  onClaimed: (d: Distributor) => Promise<void>;
  onError: (text: string) => void;
}) {
  const [wallet, setWallet] = useState(distributor.payoutWallet ?? "");
  const [saving, setSaving] = useState(false);
  const valid = WALLET_PATTERN.test(wallet.trim());

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onClaimed(await api.claim(distributor.id, wallet.trim()));
    } catch (error) {
      onError(`Couldn't claim ${distributor.name}: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="text-sm">
      <label className="block">
        <span className="mb-1 block font-medium text-stone-700">Payout wallet (Base Sepolia)</span>
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          className={`${inputClass} font-mono`}
        />
      </label>
      {wallet && !valid && <p className="mt-1 text-xs text-red-700">Enter a 0x address with 40 hex characters.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!valid || saving || wallet.trim() === distributor.payoutWallet}
          className="rounded-md bg-stone-900 px-4 py-2 font-medium text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : distributor.claimed ? "Update wallet" : "Claim this business"}
        </button>
        <span className="text-xs text-stone-500">
          {distributor.claimed
            ? "Claimed. AUSD payments go to this wallet."
            : "Unclaimed: payments go to the demo wallet and your agent uses the default policy."}
        </span>
      </div>
    </form>
  );
}
