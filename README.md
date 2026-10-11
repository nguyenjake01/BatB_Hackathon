# Bakery Purchasing Agent

An AI purchasing agent that sits between small businesses and their distributors. A business (our test case is a bakery) connects its Square inventory and sets purchasing requirements. The agent then compares real distributor listings scraped from the web and proposes orders, explaining each choice in plain language. Once the owner approves, it pays in AUSD stablecoin via x402 and logs every purchase on-chain as an audit trail.

Hackathon tracks: **Context.dev** (web scraping), **Agora AUSD** (agentic payments with x402 on Base Sepolia), **YZi Labs** (BSC Testnet deployment).

> The repo is a working skeleton. Every integration runs on realistic mock data so all three of us can build in parallel and swap in the real thing independently.

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

`USE_MOCKS=true` (the default) uses mocks everywhere, and `USE_MOCKS=false` uses real integrations everywhere. To test only your own module, add a per-module override such as `USE_MOCKS_SUPPLY=false` (also `_AGENT`, `_PAYMENTS`, `_SQUARE`). Real implementations that aren't written yet throw a clear "not implemented" error, which the API returns as `501`.

Every spot where a real integration goes is marked `TODO(Person N)`:

```bash
git grep -n "TODO(Person"
```

## Folder ownership

| Owner | Folders | Mock today → real version |
| --- | --- | --- |
| **Person 1: Supply** | `src/lib/supply/` | Mock catalog → Context.dev scraping (`getProducts(itemName)`, `refreshCatalog()`) |
| **Person 2: Agent + Payments** | `src/lib/agent/`, `src/lib/payments/`, `src/app/api/distributor/checkout/`, `contracts/` | Rule-based agent → LLM-assisted agent; fake hashes → AUSD via x402 on Base Sepolia (`payOrder`) and `PurchaseLog` on BSC Testnet (`logPurchaseOnChain`) |
| **Person 3: Demand + UI** | `src/lib/square/`, `src/app/` (page, layout, `_components/`) | Mock inventory → Square sandbox Inventory API (`getInventory()`); dashboard UI |
| **Shared** (tell the team before editing) | `src/types/`, `src/lib/store.ts`, `src/lib/config.ts`, `src/lib/orders.ts`, `src/lib/{units,matching,http,ids}.ts`, `src/app/api/*` routes | Glue code. Keep the route handlers thin and put logic in `src/lib` |

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

Defined in `src/types/index.ts`. Everyone codes against these:

```ts
interface Product {
  id: string; name: string; distributor: string;
  unitPrice: number;      // USD per pack
  unitSize: number;       // amount of `unit` per pack, e.g. 50
  unit: string;           // "lb", "oz", "each", "dozen", ...
  shippingCost: number;   // flat USD per order
  leadTimeDays: number; sourceUrl: string; scrapedAt: string;
}

interface InventoryItem {
  sku: string; name: string; quantityOnHand: number;
  unit: string; dailyUsage: number; shelfLifeDays: number;
}

interface Requirement {
  id: string; itemName: string;
  minStockLevel: number;  // in the inventory item's unit
  maxBudget: number;      // USD per order, shipping included
  qualityNotes: string;
}

interface Order {
  id: string; productId: string;
  quantity: number;       // number of packs
  totalPrice: number; reasoning: string;
  status: "proposed" | "approved" | "paid" | "failed";
  txHash?: string; auditTxHash?: string; createdAt: string;
}
```

## API routes

| Route | Description |
| --- | --- |
| `GET /api/inventory` | Current inventory |
| `GET /api/requirements` | All requirements |
| `POST /api/requirements` | Create a requirement, or replace the one for the same item |
| `GET /api/products` | Cached catalog (`?item=Flour` for one item, `?refresh=true` to re-scrape) |
| `POST /api/agent/run` | Runs the agent and stores its proposals (replaces earlier unapproved ones) |
| `POST /api/orders/[id]/approve` | Pays, logs on-chain, and marks the order `paid` |
| `GET /api/orders` | All orders, newest first, each joined with its product |
| `POST /api/distributor/checkout` | Mock distributor checkout. It will later sit behind x402 payment middleware |

## How the mock agent decides

`src/lib/agent/mock.ts` uses real logic, not hard-coded output. For each inventory item it:

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

- One branch per person: `supply`, `agent`, `ui`. Open PRs into `main`.
- Don't edit another person's folder, or the shared types and files, without telling the team first.
- Run `npm run typecheck && npm run lint && npm run build` before opening a PR.
- Never commit `.env.local` or any real key. `AGENT_WALLET_PRIVATE_KEY` must be a testnet-only wallet.

## Notes

- **Next.js 16**: this version changed several APIs. `AGENTS.md` points coding assistants to the bundled docs in `node_modules/next/dist/docs/`. Cache Components is turned off on purpose (see `next.config.ts`).
- **In-memory store**: data resets when the server restarts and isn't shared between Vercel serverless instances. Swap `src/lib/store.ts` for a database before relying on a deployed demo.
- **Mock inventory is static**: approving an order doesn't change stock, so running the agent again proposes the same items.
