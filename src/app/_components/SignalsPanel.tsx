"use client";

import { useEffect, useState } from "react";
import type { Signal } from "@/types";
import { api } from "./api";
import { EmptyState, Loading, NotConnected, Panel } from "./Panel";
import { dateTime } from "./format";
import { button, pill } from "./ui";

const DIRECTION: Record<Signal["direction"], { label: string; badge: string }> = {
  buy_early: { label: "Buy early", badge: pill.amber },
  wait: { label: "Wait", badge: pill.blue },
  neutral: { label: "Neutral", badge: pill.gray },
};

const KIND_LABEL: Record<Signal["kind"], string> = { price_change: "Price change", news: "News" };

/** Price changes and supply news the agent factors into timing and quantity. */
export function SignalsPanel({ onError }: { onError: (text: string) => void }) {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.signals().then(
      (s) => {
        if (!cancelled) setSignals(s);
      },
      (e: Error) => {
        if (!cancelled) setLoadError(e.message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      setSignals(await api.refreshSignals());
      setLoadError(null);
    } catch (error) {
      onError(`Signal refresh failed: ${(error as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  }

  const sorted = [...(signals ?? [])].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));

  return (
    <Panel
      title="Market signals"
      description="Price changes on distributor pages and supply news. The agent uses them to decide when to buy."
      action={
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className={button.secondary}
        >
          {refreshing ? "Checking…" : "Check for signals"}
        </button>
      }
    >
      {signals === null ? (
        loadError ? (
          <NotConnected what="Market signals" detail={loadError} />
        ) : (
          <Loading>Loading signals…</Loading>
        )
      ) : sorted.length === 0 ? (
        <EmptyState>No signals yet. Click “Check for signals” to scan prices and supply news.</EmptyState>
      ) : (
        <ul className="divide-y divide-stone-100">
          {sorted.map((s) => {
            const direction = DIRECTION[s.direction];
            return (
              <li key={s.id} className="flex items-start gap-3 py-3 text-sm">
                <span className={`${direction.badge} mt-0.5 w-[4.75rem] justify-center`}>{direction.label}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-stone-800">
                    <span className="font-medium">{s.itemName}:</span> {s.summary}
                  </p>
                  <p className="text-xs text-stone-500">
                    {KIND_LABEL[s.kind]} · {dateTime(s.detectedAt)} ·{" "}
                    <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
                      Source ↗
                    </a>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
