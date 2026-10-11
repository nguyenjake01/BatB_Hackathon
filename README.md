# Bakery Purchasing Agent

An AI purchasing agent that sits between small businesses and their distributors. A business (our test case is a bakery) connects its Square inventory and sets purchasing requirements. The agent then compares real distributor listings scraped from the web and proposes orders, explaining each choice in plain language. Once the owner approves, it pays in AUSD stablecoin via x402 and logs every purchase on-chain as an audit trail.

Hackathon tracks: **Context.dev** (web scraping), **Agora AUSD** (agentic payments with x402 on Base Sepolia), **YZi Labs** (BSC Testnet deployment).

> The repo is a working skeleton. Every integration runs on realistic mock data so all three of us can build in parallel and swap in the real thing independently.

## Start here (team)

| Who | Role | Branch | Task list |
| --- | --- | --- | --- |
| **Jake** | Person 1: Supply + Negotiation (Context.dev scraping, signals, distributor agents, negotiation, distributor APIs) | `supply` | [docs/roles/jake-supply-negotiation.md](docs/roles/jake-supply-negotiation.md) |
| **Jason** | Person 2: Agent + Payments (decision logic, x402 AUSD payments, checkout, PurchaseLog on BSC) | `agent` | [docs/roles/jason-agent-payments.md](docs/roles/jason-agent-payments.md) + **[handoff from Jake](docs/roles/jason-handoff.md)** |
| **Stanley** | Person 3: Demand + UI (Square sandbox, dashboard, distributor portal, deploy, video, submission) | `ui` | [docs/roles/stanley-demand-ui.md](docs/roles/stanley-demand-ui.md) |

```bash
git clone https://github.com/nguyenjake01/BatB_Hackathon.git
cd BatB_Hackathon
git checkout <your-branch>
npm install
cp .env.example .env.local
```

Then tell your coding agent: "Read CLAUDE.md and start on my role." [CLAUDE.md](CLAUDE.md) maps your branch to your role. **[docs/PRD.md](docs/PRD.md) is the source of truth.** Its section 20 explains how it was reconciled with the Café PRD (archived) and the original setup prompt.

## Setup

Requires Node.js 22+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000, click **Run agent**, read the proposed orders, and click **Approve & pay**. The order moves to Order history as `paid` with a (fake) payment hash and audit hash.

Contracts (a separate Hardhat project with its own dependencies):

```bash
cd contracts
npm install
npm test
```

### Scripts

| Where | Command | What it does |
| --- | --- | --- |
| root | `npm run dev` | Next.js dev server |
| root | `npm run typecheck` | Generates route types, then `tsc --noEmit` |
| root | `npm run lint` | ESLint |
| root | `npm run build` | Production build (what Vercel runs) |
| contracts | `npm test` | Compiles and runs the PurchaseLog tests |
| contracts | `npm run deploy:local` | Deploys to an in-process Hardhat network (smoke test) |
| contracts | `npm run deploy:bsc-testnet` | Deploys to BSC Testnet (needs `BSC_TESTNET_RPC_URL` and `AGENT_WALLET_PRIVATE_KEY` in `.env.local`, plus test BNB) |

### Mocks vs. real integrations

`USE_MOCKS=true` (the default) uses mocks everywhere, and `USE_MOCKS=false` uses real integrations everywhere. To test only your own module, add a per-module override such as `USE_MOCKS_SUPPLY=false` (also `_NEGOTIATION`, `_AGENT`, `_PAYMENTS`, `_SQUARE`). Real implementations that aren't written yet throw a clear "not implemented" error, which the API returns as `501`.

Every spot where a real integration goes is marked `TODO(Person N)`:

```bash
git grep -n "TODO(Person"
```

## Folder ownership

| Owner | Folders | Mock today → real version |
| --- | --- | --- |
| **Jake (P1): Supply + Negotiation** | `src/lib/supply/`, `src/lib/negotiation/`, `src/app/api/{supply,signals,negotiations}/`, `src/app/api/distributors/` (except `checkout`) | Mock catalog → Context.dev scraping; mock signals → monitoring + news; negotiation stub → deterministic agent-to-agent negotiation |
| **Jason (P2): Agent + Payments** | `src/lib/agent/`, `src/lib/payments/`, `src/app/api/distributors/[id]/checkout/`, `src/app/api/{agent,orders,settings}/`, `contracts/` | Rule-based mock → PRD section 8 agent; fake hashes → AUSD via x402 on Base Sepolia and `PurchaseLog` on BSC Testnet |
| **Stanley (P3): Demand + UI** | `src/lib/square/`, `src/app/` pages, `_components/`, new pages | Mock inventory → Square sandbox; dashboard + distributor portal |
| **Shared** (tell the team before editing) | `src/types/`, `src/lib/store.ts`, `src/lib/orders.ts`, `src/lib/quotes.ts`, `src/lib/config.ts`, `src/lib/{units,matching,http,ids}.ts` | Glue code. Keep route handlers thin and put logic in `src/lib` |

Each integration folder has the same shape:

- `index.ts`: the interface everyone calls, plus the mock/real switch
- `mock.ts`: the mock implementation (works today)
- `real.ts`: the real implementation (stubbed with `TODO(Person N)`)

```
src/
  types/index.ts            shared types
  lib/
    config.ts               USE_MOCKS flags
    store.ts                in-memory store behind a Store interface
    orders.ts               run-agent and approve workflows
    units.ts, matching.ts   unit conversion, item ↔ listing name matching
    supply/                 Person 1
    agent/                  Person 2
    payments/               Person 2
    square/                 Person 3
  app/
    page.tsx, _components/  Person 3 (dashboard)
    api/                    route handlers (see below)
contracts/                  Hardhat project: PurchaseLog.sol, test, deploy script
```

## Shared types

Defined in `src/types/index.ts` and specified in PRD section 9: `Product`, `Distributor`, `InventoryItem`, `Requirement`, `AutonomySettings`, `Signal`, `DistributorPolicy`, `NegotiationMessage`, `Negotiation`, `Quote`, `Order`. Quotes are signed and verified with `src/lib/quotes.ts`.

## API routes

Full table in PRD section 10. Status today:

| Route | Owner | Status |
| --- | --- | --- |
| `GET /api/inventory`, `GET/POST /api/requirements`, `GET /api/products` | shared | works (mocks) |
| `POST /api/agent/run`, `GET /api/orders`, `POST /api/orders/[id]/approve` | Jason | works (mock and real agent; real payments need a funded wallet, see below) |
| `POST /api/distributors/[id]/checkout` | Jason | x402: answers 402 with AUSD requirements, then verifies and settles through the facilitator |
| `POST /api/orders/[id]/reject`, `GET/PUT /api/settings` | Jason | works. Settings return `{ settings, spentLast7Days }`; `PUT` takes any of `mode`, `perOrderLimit`, `weeklyBudget` |
| `POST /api/supply/refresh`, `GET /api/signals`, `POST /api/signals/refresh` | Jake | to build |
| `GET /api/distributors`, `POST .../claim`, `PUT .../products/[productId]`, `GET .../orders`, `POST .../negotiate`, `GET/PUT .../policy`, `GET /api/negotiations/[id]` | Jake | to build (store methods exist) |

## Real payments (x402 + audit log)

With `USE_MOCKS_PAYMENTS=false`, approving an order makes the agent call the distributor checkout, get a 402, sign an ERC-3009 authorization for exactly the quoted amount of AUSD, and retry. The facilitator (`https://x402.org/facilitator` by default) submits the transfer on Base Sepolia and pays the gas. The purchase is then logged to `PurchaseLog` on BSC Testnet.

```bash
npm run wallet
```

This prints the agent wallet's address and balances and lists what is still missing. The wallet needs test AUSD on Base Sepolia (`npm run wallet -- faucet`, which itself needs a little Base Sepolia ETH for gas) and tBNB on BSC Testnet to deploy `PurchaseLog` and log purchases. AUSD's token metadata (decimals and its EIP-712 signing domain, which is "Agora Dollar", not the ERC-20 name "AUSD") is read from the chain.

## How the mock agent decides

`src/lib/agent/mock.ts` uses real logic, not hard-coded output. It differs from PRD section 8 in a few places that Jason fixes in the real agent. For each inventory item it:

1. Computes days until stock runs out and until it drops below the minimum. Items that stay above the minimum for 7+ days are skipped.
2. Matches listings to the item by name and converts their units (e.g. dozen → each).
3. Sizes the order to cover 14 days above the minimum, then caps it by shelf life and budget.
4. Keeps the listings that best match the quality notes and prefers those arriving before stock runs out.
5. Ranks by landed cost per unit (price + shipping), adding 2% per day of lead time.
6. Writes the reasoning, including the comparison with the Costco baseline.

## Integration checkpoints

1. **Real data replaces mocks, and the agent proposes orders**: Context.dev listings and Square inventory feed the agent.
2. **Approve triggers a real AUSD payment**: x402 on Base Sepolia, with the purchase logged to `PurchaseLog` on BSC Testnet.
3. **Feature freeze**: record the 2-minute demo and make the repo public.

## Workflow

- One branch per person: `supply` (Jake), `agent` (Jason), `ui` (Stanley). Pull `main` often and open PRs into `main`.
- Don't edit another person's folder, or the shared types and files, without telling the team first.
- Run `npm run typecheck && npm run lint && npm run build` before opening a PR.
- Never commit `.env.local` or any real key. `AGENT_WALLET_PRIVATE_KEY` must be a testnet-only wallet.

## Notes

- **Next.js 16**: this version changed several APIs. `AGENTS.md` points coding assistants to the bundled docs in `node_modules/next/dist/docs/`. Cache Components is turned off on purpose (see `next.config.ts`).
- **In-memory store**: data resets when the server restarts and isn't shared between Vercel serverless instances. Swap `src/lib/store.ts` for a database before relying on a deployed demo.
- **Mock inventory is static**: approving an order doesn't change stock, so running the agent again proposes the same items.
