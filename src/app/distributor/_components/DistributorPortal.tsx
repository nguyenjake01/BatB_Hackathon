"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Distributor, Product } from "@/types";
import { api } from "@/app/_components/api";
import { EmptyState, Loading, NotConnected, Panel } from "@/app/_components/Panel";
import { IncomingOrdersPanel } from "./IncomingOrdersPanel";
import { ListingsPanel } from "./ListingsPanel";
import { PolicyPanel } from "./PolicyPanel";
import { TabBar, useHashTab, type Tab } from "@/app/_components/Tabs";
import { inputClass } from "./styles";
import { button, label as labelClass } from "@/app/_components/ui";
import { useAuth } from "@/app/_components/AuthProvider";
import { distributorIdOf } from "@/lib/supabase";
import { Onboarding } from "./Onboarding";

type Banner = { kind: "error" | "success"; text: string };

type DistributorTab = "listings" | "policy" | "orders";

const WALLET_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export function DistributorPortal({ paymentsMocked }: { paymentsMocked: boolean }) {
  const [distributors, setDistributors] = useState<Distributor[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string>("");
  // With accounts on, a distributor sees only the company its account is linked to.
  // Without Supabase (dev fallback) anyone can pick any distributor, as before.
  const { enabled, user } = useAuth();
  const linkedId = distributorIdOf(user);
  const selectedId = enabled ? (linkedId ?? "") : pickedId;
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
  const tabs: Tab<DistributorTab>[] = [
    { key: "listings", label: "Listings" },
    { key: "policy", label: "Agent policy" },
    { key: "orders", label: "Incoming orders" },
  ];
  const tab = useHashTab(tabs);

  function report(kind: Banner["kind"], text: string) {
    setBanner({ kind, text });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <header className="mb-10">
        <h1 className="text-4xl font-normal tracking-[-0.025em] text-stone-900 sm:text-5xl">
          {enabled && selected ? selected.name : "Distributor portal"}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-stone-600">
          {enabled && selected
            ? "Your listings, your negotiation agent, and the AUSD payments you receive."
            : "Claim your listings, set prices and stock, tell your agent how far it may negotiate, and see AUSD payments."}
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

      <div className="grid grid-cols-1 gap-6">
        {!enabled ? (
          <Panel title="Find your business" description="Every distributor the agent has scraped prices from.">
            {distributors === null ? (
              <Loading>Loading distributors…</Loading>
            ) : distributors.length === 0 ? (
              loadError ? <NotConnected what="The distributor directory" detail={loadError} /> : <EmptyState>No distributors yet.</EmptyState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className={labelClass}>Distributor</span>
                  <select value={selectedId} onChange={(e) => setPickedId(e.target.value)} className={inputClass}>
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
        ) : distributors === null ? (
          <Loading>Loading your company…</Loading>
        ) : !selected ? (
          <Onboarding
            distributors={distributors}
            products={products}
            lostCompany={linkedId !== null}
            onLinked={async (d) => {
              report("success", `You're set up as ${d.name}. Payments for your listings now go to your wallet.`);
              await load();
            }}
            onError={(text) => report("error", text)}
          />
        ) : (
          <Panel title="Your company" description={selected.website || "Self-registered distributor"}>
            <ClaimForm
              key={selected.id}
              distributor={selected}
              onClaimed={async (d) => {
                report("success", `Payout wallet for ${d.name} updated.`);
                await load();
              }}
              onError={(text) => report("error", text)}
            />
          </Panel>
        )}

        {selected && (
          <div className="mt-4 grid gap-6">
            <TabBar tabs={tabs} active={tab} />
            {/* Tabs stay mounted (just hidden) so unsaved edits survive switching. */}
            <div hidden={tab !== "listings"}>
              <ListingsPanel
                distributor={selected}
                listings={listings}
                onSaved={async (p) => {
                  report("success", `Saved ${p.name}.`);
                  await load();
                }}
                onError={(text) => report("error", text)}
              />
            </div>
            <div hidden={tab !== "policy"}>
              <PolicyPanel
                key={selected.id}
                distributor={selected}
                onSaved={() => report("success", "Agent policy saved. It applies to the next negotiation.")}
                onError={(text) => report("error", text)}
              />
            </div>
            <div hidden={tab !== "orders"}>
              <IncomingOrdersPanel key={`orders-${selected.id}`} distributor={selected} paymentsMocked={paymentsMocked} />
            </div>
          </div>
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
  // Optional: an empty wallet means payments are held by the platform until one is added.
  const valid = wallet.trim() === "" ? !distributor.claimed : WALLET_PATTERN.test(wallet.trim());

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onClaimed(await api.claim(distributor.id, wallet.trim() || undefined));
    } catch (error) {
      onError(`Couldn't claim ${distributor.name}: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="text-sm">
      <label className="block">
        <span className={labelClass}>Payout wallet{distributor.payoutWallet ? "" : " (optional)"}</span>
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
          className={button.primary}
        >
          {saving ? "Saving…" : distributor.claimed ? "Update wallet" : "Claim this business"}
        </button>
        <span className="text-xs text-stone-500">
          {distributor.claimed
            ? distributor.payoutWallet
              ? "Payments go to this wallet."
              : "No payout wallet yet: Bizaar holds your payments until you add one."
            : "Unclaimed: payments go to the demo wallet and your agent uses the default policy."}
        </span>
      </div>
    </form>
  );
}
