"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderWithProduct } from "@/types";
import { api, type NegotiationEntry } from "./api";
import { dateTime, money, pct, shortHash } from "./format";

/**
 * Every negotiation the buyer agent ran for an order, side by side: the one that won (and became
 * the order) first, then the ones that ended in no deal or lost on price.
 */
export function NegotiationDialog({ order, onClose }: { order: OrderWithProduct; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<NegotiationEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    let cancelled = false;
    // Until the per-order list route exists, fall back to the order's own (winning) negotiation.
    const load = api.negotiationsForOrder(order.id).catch(() =>
      api.negotiation(order.negotiationId!).then(({ negotiation, product }): NegotiationEntry[] => [
        { negotiation, product, quote: null, distributor: order.distributor },
      ]),
    );
    load.then(
      (list) => {
        if (cancelled) return;
        const isWinner = (e: NegotiationEntry) => e.negotiation.id === order.negotiationId;
        setEntries([...list.filter(isWinner), ...list.filter((e) => !isWinner(e))]);
      },
      (e: Error) => {
        if (!cancelled) setError(e.message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [order]);

  const itemName = order.product?.name ?? order.productId;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
      className="m-auto w-[min(64rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-2xl backdrop:bg-stone-900/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div>
          <h2 className="text-xl font-medium tracking-[-0.01em] text-stone-900">Agent negotiations</h2>
          <p className="text-sm text-stone-500">
            {itemName} × {order.quantity}
            {entries && entries.length > 0 && (
              <> · buyer agent talked to {entries.length} distributor agent{entries.length === 1 ? "" : "s"}</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded-md px-2 py-1 text-sm font-medium text-stone-500 hover:bg-stone-100"
        >
          Close
        </button>
      </div>

      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
        {error ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">Couldn&apos;t load negotiations: {error}</p>
        ) : !entries ? (
          <p className="py-6 text-center text-sm text-stone-500">Loading negotiations…</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">No negotiations recorded for this order.</p>
        ) : (
          <div className={`grid gap-4 ${entries.length > 1 ? "md:grid-cols-2" : ""}`}>
            {entries.map((entry) => (
              <NegotiationColumn
                key={entry.negotiation.id}
                entry={entry}
                won={entry.negotiation.id === order.negotiationId}
              />
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}

function NegotiationColumn({ entry, won }: { entry: NegotiationEntry; won: boolean }) {
  const { negotiation, quote, product, distributor } = entry;
  const name = distributor?.name ?? product?.distributorName ?? negotiation.distributorId;
  const listPrice = product?.unitPrice;
  const belowList = (price: number) =>
    listPrice !== undefined && listPrice > 0 && price < listPrice ? `${pct(1 - price / listPrice)} below list` : null;

  const outcome =
    negotiation.status === "agreed" && negotiation.agreedUnitPrice !== undefined
      ? {
          style: won ? "bg-emerald-50 text-emerald-900" : "bg-stone-100 text-stone-700",
          text: `Agreed at ${money(negotiation.agreedUnitPrice)}/pack${
            belowList(negotiation.agreedUnitPrice) ? `, ${belowList(negotiation.agreedUnitPrice)}` : ""
          }.${won ? "" : " Another distributor had the better deal."}`,
        }
      : negotiation.status === "no_deal"
        ? { style: "bg-stone-100 text-stone-700", text: "No deal: the agents couldn't meet within their limits." }
        : { style: "bg-stone-100 text-stone-700", text: "Negotiation still open." };

  return (
    <section className={`flex flex-col rounded-lg border p-4 ${won ? "border-emerald-300" : "border-stone-200"}`}>
      <header className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-stone-900">{name}</h3>
          {won && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Selected</span>
          )}
          {distributor && !distributor.claimed && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">default policy</span>
          )}
        </div>
        <p className="text-xs text-stone-500">
          {product?.name ?? negotiation.productId} × {negotiation.quantity}
          {listPrice !== undefined && <> · list {money(listPrice)}/pack</>}
        </p>
      </header>

      <ol className="grid flex-1 content-start gap-2.5">
        {negotiation.messages.map((m, i) => {
          const buyer = m.from === "buyer";
          return (
            <li key={i} className={`flex ${buyer ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[90%] rounded-2xl px-3.5 py-2 text-sm ${
                  buyer ? "rounded-bl-sm bg-accent/10 text-stone-800" : "rounded-br-sm bg-stone-100 text-stone-800"
                }`}
              >
                <div className="mb-0.5 flex items-baseline justify-between gap-3 text-xs text-stone-500">
                  <span className="font-medium">
                    {buyer ? "Buyer agent" : `${name} agent`} · round {m.round}
                  </span>
                  <span>{dateTime(m.at)}</span>
                </div>
                <p className="leading-relaxed">{m.text}</p>
                <div className="mt-0.5 text-xs font-semibold tabular-nums text-stone-700">
                  {money(m.unitPrice)}/pack
                  {belowList(m.unitPrice) && <span className="font-normal text-stone-500"> · {belowList(m.unitPrice)}</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className={`mt-3 rounded-lg px-3.5 py-2.5 text-sm ${outcome.style}`}>
        {outcome.text}
        {negotiation.transcriptHash && (
          <div className="mt-1 text-xs opacity-80">
            Transcript hash{" "}
            <code className="font-mono" title={negotiation.transcriptHash}>
              {shortHash(negotiation.transcriptHash)}
            </code>
            {won && " (in the on-chain audit log)"}
          </div>
        )}
      </div>

      {quote && won && (
        <div className="mt-3 rounded-lg border border-stone-200 px-3.5 py-2.5 text-sm">
          <div className="mb-1.5 font-semibold text-stone-900">Signed quote</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-stone-700">
            <dt className="text-stone-500">Price</dt>
            <dd className="tabular-nums">
              {money(quote.unitPrice)}/pack × {quote.quantity}
            </dd>
            <dt className="text-stone-500">Total (with shipping)</dt>
            <dd className="font-semibold tabular-nums">{money(quote.totalPrice)} AUSD</dd>
            <dt className="text-stone-500">Expires</dt>
            <dd>{dateTime(quote.expiresAt)}</dd>
            <dt className="text-stone-500">Signature</dt>
            <dd>
              <code className="font-mono text-xs" title={quote.signature}>
                {shortHash(quote.signature)}
              </code>
            </dd>
          </dl>
          <p className="mt-1.5 text-xs text-stone-500">The x402 checkout charges exactly this signed total.</p>
        </div>
      )}
    </section>
  );
}
