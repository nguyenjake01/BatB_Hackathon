import type { OrderStatus, OrderWithProduct } from "@/types";
import { EmptyState, Panel } from "./Panel";
import { dateTime, money, shortHash } from "./format";

const STATUS_BADGE: Record<OrderStatus, string> = {
  proposed: "bg-sky-100 text-sky-800",
  approved: "bg-indigo-100 text-indigo-800",
  paid: "bg-emerald-100 text-emerald-800",
  rejected: "bg-stone-100 text-stone-600",
  failed: "bg-red-100 text-red-800",
};

const EXPLORERS = {
  payment: "https://sepolia.basescan.org/tx/",
  audit: "https://testnet.bscscan.com/tx/",
};

function TxHash({ hash, explorer, linkable }: { hash?: string; explorer: string; linkable: boolean }) {
  if (!hash) return <span className="text-stone-400">—</span>;
  const label = <code className="font-mono text-xs">{shortHash(hash)}</code>;
  return linkable ? (
    <a href={`${explorer}${hash}`} target="_blank" rel="noreferrer" title={hash} className="text-amber-700 hover:underline">
      {label}
    </a>
  ) : (
    <span title={hash}>{label}</span>
  );
}

export function OrderHistoryPanel({ orders, paymentsMocked }: { orders: OrderWithProduct[]; paymentsMocked: boolean }) {
  return (
    <Panel
      title="Order history"
      description={
        paymentsMocked
          ? "Approved orders with payment and audit transactions. Hashes are fake while payments are mocked."
          : "Approved orders with payment (Base Sepolia) and audit (BSC Testnet) transactions."
      }
    >
      {orders.length === 0 ? (
        <EmptyState>No approved orders yet.</EmptyState>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Payment tx</th>
                <th className="px-5 py-2 font-medium">Audit tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="whitespace-nowrap px-5 py-2.5 text-stone-600">{dateTime(order.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-stone-900">{order.product?.distributorName ?? order.productId}</div>
                    <div className="text-xs text-stone-500">
                      {order.product?.name ?? "Unknown product"} × {order.quantity}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(order.totalPrice)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <TxHash hash={order.txHash} explorer={EXPLORERS.payment} linkable={!paymentsMocked} />
                  </td>
                  <td className="px-5 py-2.5">
                    <TxHash hash={order.auditTxHash} explorer={EXPLORERS.audit} linkable={!paymentsMocked} />
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
