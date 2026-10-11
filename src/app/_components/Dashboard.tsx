"use client";

import { useCallback, useEffect, useState } from "react";
import type { AutonomySettings, InventoryItem, OrderWithProduct, Requirement } from "@/types";
import type { IntegrationModule } from "@/lib/config";
import { api, type SettingsResponse } from "./api";
import { AutonomyPanel } from "./AutonomyPanel";
import { NegotiationDialog } from "./NegotiationDialog";
import { money } from "./format";
import { InventoryPanel } from "./InventoryPanel";
import { OrderHistoryPanel } from "./OrderHistoryPanel";
import { ProposedOrdersPanel } from "./ProposedOrdersPanel";
import { RequirementsPanel } from "./RequirementsPanel";
import { SignalsPanel } from "./SignalsPanel";
import { SummaryStrip } from "./SummaryStrip";

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

/** Where each part of the app gets its data, in the owner's words. */
const MODULE_LABELS: Record<IntegrationModule, string> = {
  square: "Square inventory",
  supply: "Distributor prices",
  negotiation: "Negotiation",
  agent: "Agent",
  payments: "AUSD payments",
};

export function Dashboard({ mockModes }: { mockModes: Record<IntegrationModule, boolean> }) {
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  // Fetched separately so a missing settings route doesn't hide the rest of the dashboard.
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [negotiationOrder, setNegotiationOrder] = useState<OrderWithProduct | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await api.settings());
      setSettingsError(null);
    } catch (error) {
      setSettingsError((error as Error).message);
    }
  }, []);

  const apply = useCallback((data: DashboardData) => {
    // Keep what's on screen if a refresh fails, but stop showing "Loading" after the first load.
    setInventory((current) => data.inventory ?? current ?? []);
    if (data.requirements) setRequirements(data.requirements);
    if (data.orders) setOrders(data.orders);
    if (data.errors.length > 0) setBanner({ kind: "error", text: data.errors.join(" · ") });
  }, []);

  async function refresh() {
    // Settings include "spent this week", which changes when orders are paid.
    const [data] = await Promise.all([fetchDashboard(), loadSettings()]);
    apply(data);
  }

  useEffect(() => {
    let cancelled = false;
    fetchDashboard().then((data) => {
      if (!cancelled) apply(data);
    });
    api.settings().then(
      (data) => {
        if (!cancelled) setSettings(data);
      },
      (error: Error) => {
        if (!cancelled) setSettingsError(error.message);
      },
    );
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
    setBusyId({ id, action: "approve" });
    setBanner(null);
    try {
      const { order, warning } = await api.approve(id);
      setBanner(
        warning
          ? { kind: "warning", text: warning }
          : { kind: "success", text: `Paid ${order.product?.distributorName ?? "distributor"}. Purchase logged on-chain.` },
      );
    } catch (error) {
      setBanner({ kind: "error", text: `Approval failed: ${(error as Error).message}` });
    } finally {
      setBusyId(null);
      await refresh();
    }
  }

  async function reject(id: string) {
    setBusyId({ id, action: "reject" });
    setBanner(null);
    try {
      const { order } = await api.reject(id);
      setBanner({ kind: "success", text: `Rejected order from ${order.product?.distributorName ?? "distributor"}.` });
    } catch (error) {
      setBanner({ kind: "error", text: `Reject failed: ${(error as Error).message}` });
    } finally {
      setBusyId(null);
      await refresh();
    }
  }

  async function saveSettings(next: AutonomySettings): Promise<boolean> {
    try {
      setSettings(await api.saveSettings(next));
      setBanner({
        kind: "success",
        text: next.mode === "auto" ? `Auto-buy on: up to ${money(next.perOrderLimit)} per order.` : "Approval mode on: the agent will ask before paying.",
      });
      return true;
    } catch (error) {
      setBanner({ kind: "error", text: `Couldn't save settings: ${(error as Error).message}` });
      return false;
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
  const modules = Object.keys(mockModes) as IntegrationModule[];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">Owner dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">
          Your agent watches stock and distributor prices, negotiates the best deal, and pays in AUSD within the limits you set.
        </p>
        {/* Data provenance: judges and owners should see what is live and what is sample data. */}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
          {modules.map((m) => (
            <li key={m} className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${mockModes[m] ? "bg-stone-300" : "bg-emerald-500"}`} />
              {MODULE_LABELS[m]}: <span className={mockModes[m] ? "" : "font-medium text-emerald-700"}>{mockModes[m] ? "sample data" : "live"}</span>
            </li>
          ))}
        </ul>
      </header>

      {banner && (
        <div className={`mb-6 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${BANNER_STYLES[banner.kind]}`}>
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="font-medium opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <SummaryStrip inventory={inventory} requirements={requirements} orders={orders} settings={settings} />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="min-w-0 lg:col-span-3">
            <InventoryPanel inventory={inventory} requirements={requirements} live={!mockModes.square} />
          </div>
          <div className="grid min-w-0 content-start gap-6 lg:col-span-2">
            <AutonomyPanel data={settings} error={settingsError} onSave={saveSettings} />
            <RequirementsPanel requirements={requirements} inventory={inventory ?? []} onSave={saveRequirement} />
          </div>
        </div>
        <SignalsPanel onError={(text) => setBanner({ kind: "error", text })} />
        <ProposedOrdersPanel
          orders={proposed}
          hasRun={hasRun}
          running={running}
          busyId={busyId}
          onRun={runAgent}
          onApprove={approve}
          onReject={reject}
          onViewNegotiation={setNegotiationOrder}
        />
        <OrderHistoryPanel orders={history} paymentsMocked={mockModes.payments} onViewNegotiation={setNegotiationOrder} />
      </div>

      {negotiationOrder && (
        <NegotiationDialog key={negotiationOrder.id} order={negotiationOrder} onClose={() => setNegotiationOrder(null)} />
      )}
    </div>
  );
}
