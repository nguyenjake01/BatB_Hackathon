"use client";

import { useState, type FormEvent } from "react";
import type { AutonomySettings } from "@/types";
import type { SettingsResponse } from "./api";
import { Loading, NotConnected, Panel } from "./Panel";
import { money } from "./format";
import { button, input as inputClass, label as labelClass } from "./ui";

const MODES: { value: AutonomySettings["mode"]; label: string; hint: string }[] = [
  { value: "approval", label: "Ask me first", hint: "The agent proposes orders. Nothing is paid until you approve." },
  { value: "auto", label: "Auto-buy within limits", hint: "The agent pays orders at or under your limits on its own." },
];

export function AutonomyPanel({
  data,
  error,
  onSave,
}: {
  data: SettingsResponse | null;
  error: string | null;
  onSave: (settings: AutonomySettings) => Promise<boolean>;
}) {
  // Local edits; null means "show what the server has".
  const [draft, setDraft] = useState<{ mode: AutonomySettings["mode"]; perOrderLimit: string; weeklyBudget: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!data) {
    return (
      <Panel title="Autonomy" description="How much freedom the agent has to spend.">
        {error ? <NotConnected what="Autonomy settings" detail={error} /> : <Loading>Loading settings…</Loading>}
      </Panel>
    );
  }

  const { settings, spentThisWeek } = data;
  const form = draft ?? {
    mode: settings.mode,
    perOrderLimit: String(settings.perOrderLimit),
    weeklyBudget: String(settings.weeklyBudget),
  };
  const remaining = Math.max(0, settings.weeklyBudget - spentThisWeek);
  const usedPct = settings.weeklyBudget > 0 ? Math.min(1, spentThisWeek / settings.weeklyBudget) : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const saved = await onSave({
      mode: form.mode,
      perOrderLimit: Number(form.perOrderLimit),
      weeklyBudget: Number(form.weeklyBudget),
    });
    setSaving(false);
    if (saved) setDraft(null);
  }

  return (
    <Panel title="Autonomy" description="How much freedom the agent has to spend.">
      <form onSubmit={submit} className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-stone-700">Mode</legend>
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${
                form.mode === m.value ? "border-amber-400 bg-amber-50/70 ring-1 ring-amber-200" : "border-line hover:bg-stone-50"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={m.value}
                checked={form.mode === m.value}
                onChange={() => setDraft({ ...form, mode: m.value })}
                className="mt-0.5 accent-amber-600"
              />
              <span>
                <span className="block font-medium text-stone-900">{m.label}</span>
                <span className="text-stone-500">{m.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className={labelClass}>Per-order limit ($)</span>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={form.perOrderLimit}
              onChange={(e) => setDraft({ ...form, perOrderLimit: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            <span className={labelClass}>Weekly budget ($)</span>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={form.weeklyBudget}
              onChange={(e) => setDraft({ ...form, weeklyBudget: e.target.value })}
              className={inputClass}
            />
          </label>
        </div>

        <div className="text-sm">
          <div className="mb-1 flex justify-between text-stone-600">
            <span>Spent this week</span>
            <span className="tabular-nums">
              {money(spentThisWeek)} of {money(settings.weeklyBudget)} · {money(remaining)} left
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full ${usedPct >= 1 ? "bg-red-500" : "bg-amber-500"}`}
              style={{ width: `${usedPct * 100}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || draft === null}
            className={button.primary}
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {draft && (
            <button
              type="button"
              onClick={() => setDraft(null)}
              className={button.ghost}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </Panel>
  );
}
