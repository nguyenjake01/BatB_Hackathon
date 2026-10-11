// Real agent: the deterministic decision logic of docs/PRD.md section 8, plus an
// optional LLM pass that rephrases the reasoning (never changes numbers).

import { NotImplementedError } from "@/lib/config";
import type { PurchasingAgent } from "./index";

export const llmAgent: PurchasingAgent = {
  async runAgent(ctx) {
    // TODO(Person 2): Implement PRD section 8 exactly (runway, candidates, landed cost, reorder
    // rule, quantity caps, signals, negotiateAll from "@/lib/negotiation", pick, savings,
    // autonomy). Start from `ruleBasedAgent` in "./mock" and fix where it differs from the PRD.
    // If LLM_API_KEY is set, ask the LLM to rephrase the computed facts; otherwise use the template.
    throw new NotImplementedError(
      `Agent (${ctx.inventory.length} items, ${ctx.requirements.length} requirements, ${ctx.products.length} listings)`,
      "agent",
    );
  },
};
