"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderWithProduct } from "@/types";
import { api, type NegotiationResponse } from "./api";
import { dateTime, money, pct, shortHash } from "./format";

/** Chat between the buyer agent and one distributor agent, plus the signed quote it produced. */
export function NegotiationDialog({ order, onClose }: { order: OrderWithProduct; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<NegotiationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    let cancelled = false;
    api.negotiation(order.negotiationId!).then(
      (d) => {
        if (!cancelled) setData(d);
      },
      (e: Error) => {
        if (!cancelled) setError(e.message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [order.negotiationId]);

  const product = order.product;
  const distributorName = order.distributor?.name ?? product?.distributorName ?? "Distributor";
  const listPrice = product?.unitPrice;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
      className="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-stone-900/40"
    >
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Negotiation with {distributorName}</h2>
          <p className="text-sm text-stone-500">
            {product ? `${product.name} × ${order.quantity}` : `${order.productId} × ${order.quantity}`}
            {listPrice !== undefined && <> · list {money(listPrice)}/pack</>}
            {order.distributor && !order.distributor.claimed && <> · unclaimed, default policy</>}
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

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        {error ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">Couldn&apos;t load the negotiation: {error}</p>
        ) : !data ? (
          <p className="py-6 text-center text-sm text-stone-500">Loading negotiation…</p>
        ) : (
          <>
            <ol className="grid gap-3">
              {data.negotiation.messages.map((m, i) => {
                const buyer = m.from === "buyer";
                return (
                  <li key={i} className={`flex ${buyer ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        buyer ? "rounded-bl-sm bg-amber-50 text-stone-800" : "rounded-br-sm bg-stone-100 text-stone-800"
                      }`}
                    >
                      <div className="mb-1 flex items-baseline justify-between gap-4 text-xs text-stone-500">
                        <span className="font-medium">
                          {buyer ? "Buyer agent" : `${distributorName} agent`} · round {m.round}
                        </span>
                        <span>{dateTime(m.at)}</span>
                      </div>
                      <p className="leading-relaxed">{m.text}</p>
                      <div className="mt-1 text-xs font-semibold tabular-nums text-stone-700">
                        {money(m.unitPrice)}/pack
                        {listPrice !== undefined && listPrice > 0 && m.unitPrice < listPrice && (
                          <span className="font-normal text-stone-500"> · {pct(1 - m.unitPrice / listPrice)} below list</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div
              className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                data.negotiation.status === "agreed" ? "bg-emerald-50 text-emerald-900" : "bg-stone-100 text-stone-700"
              }`}
            >
              {data.negotiation.status === "agreed" && data.negotiation.agreedUnitPrice !== undefined
                ? `Agreed at ${money(data.negotiation.agreedUnitPrice)}/pack${
                    listPrice !== undefined && data.negotiation.agreedUnitPrice < listPrice
                      ? `, ${pct(1 - data.negotiation.agreedUnitPrice / listPrice)} below list`
                      : ""
                  }.`
                : data.negotiation.status === "no_deal"
                  ? "No deal: the agents couldn't meet within their limits."
                  : "Negotiation still open."}
              {data.negotiation.transcriptHash && (
                <div className="mt-1 text-xs opacity-80">
                  Transcript hash <code className="font-mono" title={data.negotiation.transcriptHash}>{shortHash(data.negotiation.transcriptHash)}</code>{" "}
                  (included in the on-chain audit log)
                </div>
              )}
            </div>

            {data.quote && (
              <div className="mt-4 rounded-lg border border-stone-200 px-4 py-3 text-sm">
                <div className="mb-2 font-semibold text-stone-900">Signed quote</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-stone-700">
                  <dt className="text-stone-500">Price</dt>
                  <dd className="tabular-nums">
                    {money(data.quote.unitPrice)}/pack × {data.quote.quantity}
                  </dd>
                  <dt className="text-stone-500">Total (with shipping)</dt>
                  <dd className="font-semibold tabular-nums">{money(data.quote.totalPrice)} AUSD</dd>
                  <dt className="text-stone-500">Expires</dt>
                  <dd>{dateTime(data.quote.expiresAt)}</dd>
                  <dt className="text-stone-500">Signature</dt>
                  <dd>
                    <code className="font-mono text-xs" title={data.quote.signature}>{shortHash(data.quote.signature)}</code>
                  </dd>
                </dl>
                <p className="mt-2 text-xs text-stone-500">The x402 checkout charges exactly this signed total.</p>
              </div>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
