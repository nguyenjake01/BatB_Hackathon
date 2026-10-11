@AGENTS.md

# Team setup: read this first

Three people, each with their own coding agent, build this repo in parallel. **Before doing anything, figure out whose agent you are:**

| Current git branch | You work for | Role file (your task list) |
|---|---|---|
| `supply` | **Jake**, Person 1: Supply + Negotiation | `docs/roles/jake-supply-negotiation.md` |
| `agent` | **Jason**, Person 2: Agent + Payments | `docs/roles/jason-agent-payments.md` **and `docs/roles/jason-handoff.md` (read first: integration notes from Jake)** |
| `ui` | **Stanley**, Person 3: Demand + UI | `docs/roles/stanley-demand-ui.md` |

Run `git branch --show-current`. If you're on `main` or the branch isn't listed, ask the user who they are and check out their branch (`git checkout <branch>`; branches exist on origin).

Then read, in order:
1. Your role file: what you own, the contracts others depend on, and your tasks in priority order.
2. `docs/PRD.md`: the source of truth. Section 20 records how conflicting docs were resolved. `docs/archive/` and `2026-10-11-hackathon-setup-prompt.md` are superseded; don't build from them.

## Rules
- **Stay in your folders.** Shared files (`src/types/`, `src/lib/store.ts`, `src/lib/orders.ts`, `src/lib/quotes.ts`, `src/lib/config.ts`, `src/lib/{units,matching,http,ids}.ts`) need a heads-up to the team before you change them. Tell your user to announce the change. Add to shared files; don't rename or remove.
- P0 before P1. No P2 unless P0 and P1 work. Feature freeze at 3:00.
- Never hard-code prices, agent outputs, or tx hashes in non-mock code paths (judges check). Numbers come from code; the LLM only rephrases.
- Look up x402/AUSD (Agora Docs MCP), Context.dev, Square, and BNB Chain details in their docs. Don't guess package names or addresses.
- Test your own module with a per-module flag (`USE_MOCKS_SUPPLY=false`, `_NEGOTIATION`, `_AGENT`, `_PAYMENTS`, `_SQUARE`) while the rest stays mocked.
- Before pushing: `npm run typecheck && npm run lint && npm run build`. Don't break `main`.
- Workflow: commit small changes on your branch, `git pull origin main` often (merge, don't rebase shared history), and open PRs into `main`. Never commit `.env.local` or keys. Testnet wallets only.
