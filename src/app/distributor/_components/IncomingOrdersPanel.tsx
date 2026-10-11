"use client";

import { useEffect, useState } from "react";
import type { Distributor, OrderWithProduct } from "@/types";
import { api } from "@/app/_components/api";
import { EmptyState, Loading, NotConnected, Panel } from "@/app/_components/Panel";
import { EXPLORERS, TxHash } from "@/app/_components/OrderHistoryPanel";
import { dateTime, money } from "@/app/_components/format";

export function IncomingOrdersPanel({ distributor, paymentsMocked }: { distributor: Distributor; paymentsMocked: boolean }) {
  const [orders, setOrders] = useState<OrderWithProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.distributorOrders(distributor.id).then(
      (o) => {
        if (!cancelled) setOrders(o);
      },
      (e: Error) => {
        if (!cancelled) setError(e.message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [distributor.id]);

  const paid = (orders ?? []).filter((o) => o.status === "paid");
  const received = paid.reduce((sum, o) => sum + o.totalPrice, 0);

  return (
    <Panel
      title="Incoming orders"
      description={
        distributor.claimed
          ? "Orders the buyer agent placed with you, paid in AUSD on Base Sepolia."
          : "Orders placed with you. While unclaimed, payments go to the demo wallet."
      }
      action={
        orders && (
          <div className="text-right">
            <div className="text-xs font-medium text-stone-500">AUSD received</div>
            <div className="text-2xl font-normal tabular-nums tracking-tight text-emerald-700">{money(received)}</div>
            <div className="text-xs text-stone-500">
              {paid.length} paid order{paid.length === 1 ? "" : "s"}
            </div>
          </div>
        )
      }
    >
      {orders === null ? (
        error ? <NotConnected what="Incoming orders" detail={error} /> : <Loading>Loading orders…</Loading>
      ) : orders.length === 0 ? (
        <EmptyState>No orders yet.</EmptyState>
      ) : (
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-stone-500">
                <th className="px-6 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-6 py-2 font-medium">Payment tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap px-6 py-2.5 text-stone-600">{dateTime(o.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    {o.product?.name ?? o.productId} × {o.quantity}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(o.totalPrice)} AUSD</td>
                  <td className="px-3 py-2.5 capitalize">
                    {o.status}
                    {o.autoPurchased && <span className="ml-1 text-xs normal-case text-violet-700">(auto-purchased)</span>}
                  </td>
                  <td className="px-6 py-2.5">
                    <TxHash hash={o.txHash} explorer={EXPLORERS.payment} linkable={!paymentsMocked} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
