import type { OrderStatus, OrderWithProduct } from "@/types";
import { EmptyState, Panel } from "./Panel";
import { dateTime, money, pct, savingsVsBaseline, shortHash } from "./format";
import { button, pill } from "./ui";

const STATUS_BADGE: Record<OrderStatus, string> = {
  proposed: pill.blue,
  approved: pill.violet,
  paid: pill.green,
  rejected: pill.gray,
  failed: pill.red,
};

export const EXPLORERS = {
  payment: "https://sepolia.basescan.org/tx/",
  audit: "https://testnet.bscscan.com/tx/",
};

export function TxHash({ hash, explorer, linkable }: { hash?: string; explorer: string; linkable: boolean }) {
  if (!hash) return <span className="text-stone-400">—</span>;
  const label = <code className="font-mono text-xs">{shortHash(hash)}</code>;
  return linkable ? (
    <a href={`${explorer}${hash}`} target="_blank" rel="noreferrer" title={hash} className="inline-flex items-center gap-1 text-accent hover:underline">
      {label}
      <span aria-hidden>↗</span>
    </a>
  ) : (
    <span title={hash}>{label}</span>
  );
}

export function OrderHistoryPanel({
  orders,
  paymentsMocked,
  onViewNegotiation,
}: {
  orders: OrderWithProduct[];
  paymentsMocked: boolean;
  onViewNegotiation: (order: OrderWithProduct) => void;
}) {
  // Savings only count for paid orders the agent priced against the retail baseline.
  const paid = orders.filter((o) => o.status === "paid" && o.baselinePrice !== undefined);
  const totalSaved = paid.reduce((sum, o) => sum + (savingsVsBaseline(o) ?? 0), 0);
  const totalBaseline = paid.reduce((sum, o) => sum + (o.baselinePrice ?? 0), 0);

  return (
    <Panel
      title="Order history"
      description={
        paymentsMocked
          ? "Approved orders with payment and audit transactions. Hashes are fake while payments are mocked."
          : "Approved orders with payment (Base Sepolia) and audit (BSC Testnet) transactions."
      }
      action={
        paid.length > 0 && (
          <div className="text-right">
            <div className="text-xs font-medium text-stone-500">Saved vs retail</div>
            <div className={`text-2xl font-normal tabular-nums tracking-tight ${totalSaved >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {money(totalSaved)}
              {totalBaseline > 0 && <span className="ml-1 text-sm font-medium">({pct(totalSaved / totalBaseline)})</span>}
            </div>
          </div>
        )
      }
    >
      {orders.length === 0 ? (
        <EmptyState>No orders yet. Approved and auto-purchased orders show up here.</EmptyState>
      ) : (
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[860px] whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-stone-500">
                <th className="px-6 pb-2 font-medium">Date</th>
                <th className="px-3 pb-2 font-medium">Order</th>
                <th className="px-3 pb-2 text-right font-medium">Total</th>
                <th className="px-3 pb-2 text-right font-medium">Saved vs retail</th>
                <th className="px-3 pb-2 font-medium">Status</th>
                <th className="px-3 pb-2 font-medium">Payment tx</th>
                <th className="px-6 pb-2 font-medium">Audit tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((order) => {
                const saved = savingsVsBaseline(order);
                return (
                <tr key={order.id}>
                  <td className="whitespace-nowrap px-6 py-3 text-stone-600">{dateTime(order.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-stone-900">{order.product?.distributorName ?? order.productId}</div>
                    <div className="text-xs text-stone-500">
                      {order.product?.name ?? "Unknown product"} × {order.quantity}
                    </div>
                    {order.negotiationId && (
                      <button
                        type="button"
                        onClick={() => onViewNegotiation(order)}
                        className={`${button.link} text-xs`}
                      >
                        View negotiation
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(order.totalPrice)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {saved === null ? (
                      <span className="text-stone-400">—</span>
                    ) : (
                      <span className={saved >= 0 ? "text-emerald-700" : "text-red-700"}>
                        {money(saved)}
                        {order.savingsPct !== undefined && <span className="text-xs"> ({pct(order.savingsPct)})</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className={`${STATUS_BADGE[order.status]} capitalize`}>{order.status}</span>
                      {order.autoPurchased && <span className={pill.violet}>auto-purchased</span>}
                    </div>
                    {order.error && <div className="mt-1 max-w-xs whitespace-normal text-xs text-red-700">{order.error}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <TxHash hash={order.txHash} explorer={EXPLORERS.payment} linkable={!paymentsMocked} />
                  </td>
                  <td className="px-6 py-3">
                    <TxHash hash={order.auditTxHash} explorer={EXPLORERS.audit} linkable={!paymentsMocked} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
