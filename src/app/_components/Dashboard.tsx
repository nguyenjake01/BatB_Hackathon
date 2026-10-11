"use client";

import { useCallback, useEffect, useState } from "react";
import type { InventoryItem, OrderWithProduct, Requirement } from "@/types";
import type { IntegrationModule } from "@/lib/config";
import { api } from "./api";
import { InventoryPanel } from "./InventoryPanel";
import { OrderHistoryPanel } from "./OrderHistoryPanel";
import { ProposedOrdersPanel } from "./ProposedOrdersPanel";
import { RequirementsPanel } from "./RequirementsPanel";

type Banner = { kind: "error" | "warning" | "success"; text: string };

interface DashboardData {
  inventory: InventoryItem[] | null;
  requirements: Requirement[] | null;
  orders: OrderWithProduct[] | null;
  errors: string[];
}

async function fetchDashboard(): Promise<DashboardData> {
  const [inventory, requirements, orders] = await Promise.allSettled([api.inventory(), api.requirements(), api.orders()]);
  const value = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);
  const errors = [inventory, requirements, orders]
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
  return { inventory: value(inventory), requirements: value(requirements), orders: value(orders), errors };
}

const BANNER_STYLES: Record<Banner["kind"], string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function Dashboard({ mockModes }: { mockModes: Record<IntegrationModule, boolean> }) {
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const apply = useCallback((data: DashboardData) => {
    // Keep what's on screen if a refresh fails, but stop showing "Loading" after the first load.
    setInventory((current) => data.inventory ?? current ?? []);
    if (data.requirements) setRequirements(data.requirements);
    if (data.orders) setOrders(data.orders);
    if (data.errors.length > 0) setBanner({ kind: "error", text: data.errors.join(" · ") });
  }, []);

  async function refresh() {
    apply(await fetchDashboard());
  }

  useEffect(() => {
    let cancelled = false;
    fetchDashboard().then((data) => {
      if (!cancelled) apply(data);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  async function runAgent() {
    setRunning(true);
    setBanner(null);
    try {
      const proposed = await api.runAgent();
      setHasRun(true);
      setBanner({
        kind: "success",
        text: proposed.length > 0 ? `Agent proposed ${proposed.length} order${proposed.length === 1 ? "" : "s"}.` : "Agent found nothing to order.",
      });
      await refresh();
    } catch (error) {
      setBanner({ kind: "error", text: `Agent run failed: ${(error as Error).message}` });
    } finally {
      setRunning(false);
    }
  }

  async function approve(id: string) {
    setApprovingId(id);
    setBanner(null);
    try {
      const { order, warning } = await api.approve(id);
      setBanner(
        warning
          ? { kind: "warning", text: warning }
          : { kind: "success", text: `Paid ${order.product?.distributor ?? "distributor"}. Purchase logged on-chain.` },
      );
    } catch (error) {
      setBanner({ kind: "error", text: `Approval failed: ${(error as Error).message}` });
    } finally {
      setApprovingId(null);
      await refresh();
    }
  }

  async function saveRequirement(input: Omit<Requirement, "id">): Promise<boolean> {
    try {
      await api.saveRequirement(input);
      setBanner({ kind: "success", text: `Saved requirement for ${input.itemName}.` });
      await refresh();
      return true;
    } catch (error) {
      setBanner({ kind: "error", text: `Couldn't save requirement: ${(error as Error).message}` });
      return false;
    }
  }

  const proposed = orders.filter((o) => o.status === "proposed");
  const history = orders.filter((o) => o.status !== "proposed");
  const realModules = (Object.keys(mockModes) as IntegrationModule[]).filter((m) => !mockModes[m]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Bakery Purchasing Agent</h1>
          <p className="text-sm text-stone-500">
            Finds the best distributor deals, proposes orders, and pays in AUSD once you approve.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            realModules.length === 0 ? "bg-stone-200 text-stone-700" : "bg-violet-100 text-violet-800"
          }`}
        >
          {realModules.length === 0 ? "Mock mode" : `Live: ${realModules.join(", ")}`}
        </span>
      </header>

      {banner && (
        <div className={`mb-6 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${BANNER_STYLES[banner.kind]}`}>
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="font-medium opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <InventoryPanel inventory={inventory} requirements={requirements} />
          </div>
          <div className="lg:col-span-2">
            <RequirementsPanel requirements={requirements} inventory={inventory ?? []} onSave={saveRequirement} />
          </div>
        </div>
        <ProposedOrdersPanel
          orders={proposed}
          hasRun={hasRun}
          running={running}
          approvingId={approvingId}
          onRun={runAgent}
          onApprove={approve}
        />
        <OrderHistoryPanel orders={history} paymentsMocked={mockModes.payments} />
      </div>
    </div>
  );
}
