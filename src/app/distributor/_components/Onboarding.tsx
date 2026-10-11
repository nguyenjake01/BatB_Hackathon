"use client";

import { useState, type FormEvent } from "react";
import type { Distributor, Product } from "@/types";
import { api } from "@/app/_components/api";
import { Panel } from "@/app/_components/Panel";
import { button, input, label } from "@/app/_components/ui";
import { linkDistributor } from "@/lib/supabase";

const WALLET_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/**
 * First visit of a distributor account: claim a company the agent already found by
 * scraping, or register a new one. Either way the account is then linked to that company.
 */
export function Onboarding({
  distributors,
  products,
  lostCompany,
  onLinked,
  onError,
}: {
  distributors: Distributor[];
  products: Product[];
  /** The account was linked to a company the server no longer has (data resets on restart). */
  lostCompany: boolean;
  onLinked: (d: Distributor) => Promise<void>;
  onError: (text: string) => void;
}) {
  // Retail stores (the Walmart baseline) and companies someone already claimed can't be claimed.
  const isRetail = (id: string) => products.some((p) => p.distributorId === id && p.isRetailBaseline);
  const claimable = distributors.filter((d) => !d.claimed && !isRetail(d.id));
  const [mode, setMode] = useState<"claim" | "create">(claimable.length > 0 ? "claim" : "create");
  const [claimId, setClaimId] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [wallet, setWallet] = useState("");
  const [saving, setSaving] = useState(false);
  const walletOk = WALLET_PATTERN.test(wallet.trim());

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const distributor =
        mode === "claim"
          ? await api.claim(claimId, wallet.trim())
          : await api.createDistributor({ name: name.trim(), website: website.trim(), payoutWallet: wallet.trim() });
      await linkDistributor(distributor.id);
      await onLinked(distributor);
    } catch (error) {
      onError(`Couldn't set up your company: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const listingCount = (id: string) => products.filter((p) => p.distributorId === id).length;

  return (
    <Panel
      title="Set up your company"
      description={
        lostCompany
          ? "We couldn't find your company. Demo data resets when the server restarts, so set it up again."
          : "Claim your company if the agent already lists it, or add a new one."
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-2 text-sm sm:max-w-md">
        {(["claim", "create"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg border px-3 py-2 text-left font-medium transition-colors ${
              mode === m ? "border-amber-400 bg-amber-50/70 text-stone-900" : "border-line text-stone-500 hover:bg-stone-50"
            }`}
          >
            {m === "claim" ? "Claim my company" : "Add a new company"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-4 text-sm sm:max-w-xl">
        {mode === "claim" ? (
          claimable.length === 0 ? (
            <p className="text-stone-500">Every listed company is already claimed. Add a new company instead.</p>
          ) : (
            <label>
              <span className={label}>Your company</span>
              <select required value={claimId} onChange={(e) => setClaimId(e.target.value)} className={input}>
                <option value="">Choose your company…</option>
                {claimable.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({listingCount(d.id)} listings found)
                  </option>
                ))}
              </select>
            </label>
          )
        ) : (
          <>
            <label>
              <span className={label}>Company name</span>
              <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Midwest Baking Supply" className={input} />
            </label>
            <label>
              <span className={label}>Website (optional)</span>
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={input} />
            </label>
          </>
        )}
        <label>
          <span className={label}>Payout wallet (Base Sepolia)</span>
          <input
            required
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            className={`${input} font-mono`}
          />
          {wallet && !walletOk && <span className="mt-1 block text-xs text-red-700">Enter a 0x address with 40 hex characters.</span>}
          <span className="mt-1 block text-xs text-stone-500">Buyers&apos; agents pay you here in AUSD.</span>
        </label>
        <div>
          <button
            type="submit"
            disabled={saving || !walletOk || (mode === "claim" && (!claimId || claimable.length === 0))}
            className={button.primary}
          >
            {saving ? "Setting up…" : mode === "claim" ? "Claim company" : "Add company"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
