import type { OrderWithProduct } from "@/types";
import { EmptyState, Panel } from "./Panel";
import { money, qty } from "./format";

export function ProposedOrdersPanel({
  orders,
  hasRun,
  running,
  approvingId,
  onRun,
  onApprove,
}: {
  orders: OrderWithProduct[];
  hasRun: boolean;
  running: boolean;
  approvingId: string | null;
  onRun: () => void;
  onApprove: (id: string) => void;
}) {
  return (
    <Panel
      title="Proposed orders"
      description="The agent checks stock against your requirements and finds the best deals. Nothing is paid until you approve."
      action={
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
        >
          {running ? "Running agent…" : "Run agent"}
        </button>
      }
    >
      {orders.length === 0 ? (
        <EmptyState>
          {hasRun
            ? "Everything is stocked. No orders needed right now."
            : "No proposals yet. Run the agent to check inventory against your requirements."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {orders.map((order) => {
            const p = order.product;
            const approving = approvingId === order.id;
            return (
              <li key={order.id} className="flex flex-col rounded-lg border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{p?.distributor ?? "Unknown distributor"}</div>
                    <div className="text-sm text-stone-600">
                      {p ? `${p.name} × ${order.quantity}` : `${order.productId} × ${order.quantity}`}
                    </div>
                    {p && (
                      <div className="text-xs text-stone-500">
                        {qty(p.unitSize * order.quantity, p.unit)} · arrives in {p.leadTimeDays} day
                        {p.leadTimeDays === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums text-stone-900">{money(order.totalPrice)}</div>
                    <div className="text-xs text-stone-500">AUSD</div>
                  </div>
                </div>
                <p className="mt-3 flex-1 whitespace-pre-line rounded-md bg-stone-50 p-3 text-sm leading-relaxed text-stone-700">
                  {order.reasoning}
                </p>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onApprove(order.id)}
                    disabled={approvingId !== null}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {approving ? "Paying…" : `Approve & pay ${money(order.totalPrice)}`}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
