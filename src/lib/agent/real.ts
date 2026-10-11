// Real agent backed by an LLM.

import { NotImplementedError } from "@/lib/config";
import type { PurchasingAgent } from "./index";

export const llmAgent: PurchasingAgent = {
  async runAgent(inventory, requirements, products) {
    // TODO(Person 2): Call the LLM (process.env.LLM_API_KEY) to choose orders and write the
    // reasoning. A good start: run `ruleBasedAgent` from "./mock" for the numbers, then send
    // its candidates plus the requirements' quality notes to the LLM to confirm the pick and
    // rewrite the explanation in plain language.
    throw new NotImplementedError(
      `LLM agent (${inventory.length} items, ${requirements.length} requirements, ${products.length} listings)`,
      "agent",
    );
  },
};
