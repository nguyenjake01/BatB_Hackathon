"use client";

import { useState } from "react";
import type { OrderWithProduct } from "@/types";
import { EmptyState, Panel } from "./Panel";
import { money, pct, qty, savingsVsBaseline } from "./format";
import { button, pill } from "./ui";

/** Reasoning lines shown before "Show all". */
const REASONING_PREVIEW_LINES = 3;

export function ProposedOrdersPanel({
  orders,
  hasRun,
  running,
  busyId,
  onRun,
  onApprove,
  onReject,
  onViewNegotiation,
}: {
  orders: OrderWithProduct[];
  hasRun: boolean;
  running: boolean;
  /** Order currently being approved or rejected; disables all actions while set. */
  busyId: { id: string; action: "approve" | "reject" } | null;
  onRun: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onViewNegotiation: (order: OrderWithProduct) => void;
}) {
  return (
    <Panel
      title="Proposed orders"
      description="The agent checks stock against your rules and finds the best deal. Nothing is paid until you approve."
      action={
        <button type="button" onClick={onRun} disabled={running} className={button.agent}>
          {running && <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {running ? "Agent is working…" : "Run agent"}
        </button>
      }
    >
      {orders.length === 0 ? (
        <EmptyState>
          {hasRun
            ? "Everything is stocked. No orders needed right now."
            : "No proposals yet. Run the agent to check inventory against your rules."}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              busy={busyId?.id === order.id ? busyId.action : null}
              disabled={busyId !== null}
              onApprove={() => onApprove(order.id)}
              onReject={() => onReject(order.id)}
              onViewNegotiation={() => onViewNegotiation(order)}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function OrderCard({
  order,
  busy,
  disabled,
  onApprove,
  onReject,
  onViewNegotiation,
}: {
  order: OrderWithProduct;
  busy: "approve" | "reject" | null;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
  onViewNegotiation: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const p = order.product;
  const saved = savingsVsBaseline(order);
  const lines = order.reasoning.split("\n").map((l) => l.trim()).filter(Boolean);
  const shown = expanded ? lines : lines.slice(0, REASONING_PREVIEW_LINES);

  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-line bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-900">{p?.distributorName ?? "Unknown distributor"}</span>
            {saved !== null && saved > 0 && (
              <span className={pill.green}>
                Saves {money(saved)}
                {order.savingsPct !== undefined && ` (${pct(order.savingsPct)})`}
              </span>
            )}
            {saved !== null && saved < 0 && <span className={pill.red}>{money(-saved)} more than retail</span>}
          </div>
          <div className="mt-0.5 truncate text-sm text-stone-600">
            {p ? p.name : order.productId} <span className="text-stone-400">×</span> {order.quantity}
          </div>
          {p && (
            <div className="text-xs text-stone-500">
              {qty(p.unitSize * order.quantity, p.unit)} · arrives in {p.leadTimeDays} day{p.leadTimeDays === 1 ? "" : "s"}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-semibold tabular-nums tracking-tight text-stone-900">{money(order.totalPrice)}</div>
          <div className="text-xs font-medium text-stone-400">AUSD</div>
          {order.listTotal !== undefined && order.listTotal > order.totalPrice && (
            <div className="text-xs tabular-nums text-stone-400 line-through">{money(order.listTotal)}</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex-1 rounded-lg bg-stone-50 p-3">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">Why the agent chose this</div>
        <ul className="grid gap-1 text-sm leading-relaxed text-stone-700">
          {shown.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-amber-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        {lines.length > REASONING_PREVIEW_LINES && (
          <button type="button" onClick={() => setExpanded(!expanded)} className={`${button.link} mt-1.5 text-xs`}>
            {expanded ? "Show less" : `Show all ${lines.length} reasons`}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {order.negotiationId && (
          <button type="button" onClick={onViewNegotiation} className={`${button.link} mr-auto`}>
            View negotiation
          </button>
        )}
        <button type="button" onClick={onReject} disabled={disabled} className={button.ghost}>
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
        <button type="button" onClick={onApprove} disabled={disabled} className={button.pay}>
          {busy === "approve" ? "Paying…" : `Approve & pay ${money(order.totalPrice)}`}
        </button>
      </div>
    </li>
  );
}
