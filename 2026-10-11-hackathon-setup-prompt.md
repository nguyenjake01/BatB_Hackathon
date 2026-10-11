# Hackathon Repo Setup: Instructions for Claude Code

Set up the starter repo for our hackathon project so my team of 3 can clone it and work in parallel. Do NOT build the real integrations. Build a working skeleton with mock data, clear folder ownership, and shared types, so each person can replace their mocks independently.

Do not modify, rename, or delete this instructions file.

## Project
An AI purchasing agent that sits between small businesses and distributors. A small business (our test case is a bakery) connects its inventory (Square), sets requirements, and an AI agent finds the best distributor deals (real distributor listings scraped from the web), proposes orders with plain-language reasoning, and pays with AUSD stablecoin via x402 once the owner approves. Every purchase is also logged on-chain as an audit trail.

Hackathon tracks: Context.dev (web scraping), Agora AUSD (agentic payments / x402, Base Sepolia), YZi Labs (requires a BSC Testnet deployment).

## Stack
- One Next.js (App Router) + TypeScript app, deployable to Vercel. Use npm.
- Tailwind for styling.
- API routes for backend logic. No separate servers.
- Simple in-memory store behind a single interface (`src/lib/store.ts`) so we can swap in a database later.
- `contracts/` folder for a small Solidity audit-log contract (Hardhat), deployed to BSC Testnet later.

## Shared types (`src/types/index.ts`). Everyone codes against these:
- `Product`: id, name, distributor, unitPrice, unitSize, unit, shippingCost, leadTimeDays, sourceUrl, scrapedAt
- `InventoryItem`: sku, name, quantityOnHand, unit, dailyUsage, shelfLifeDays
- `Requirement`: id, itemName, minStockLevel, maxBudget, qualityNotes
- `Order`: id, productId, quantity, totalPrice, reasoning, status ("proposed" | "approved" | "paid" | "failed"), txHash?, auditTxHash?, createdAt

## Folder ownership
Put each person's code in its own folder with a stub interface and a mock implementation that returns realistic bakery data (flour, butter, sugar, eggs, yeast, chocolate chips, with 2–3 distributors each, including a Costco-style baseline for price comparison):

- **Person 1, Supply** → `src/lib/supply/`: `getProducts(itemName)`, `refreshCatalog()`. Real version will use the Context.dev API.
- **Person 2, Agent + Payments** → `src/lib/agent/` and `src/lib/payments/`:
  - `runAgent(inventory, requirements, products) → Order[]`. The mock should do real logic, not hard-coded output: compute days until each item runs out, filter products by requirements, score by total landed cost (price + shipping) and lead time, respect shelf life when picking quantity, and generate a reasoning string.
  - `payOrder(order) → txHash` (mock returns a fake hash). The real version will use AUSD via x402 on Base Sepolia.
  - `src/app/api/distributor/checkout/route.ts`: a mock distributor checkout endpoint that will later sit behind x402 payment middleware.
  - `logPurchaseOnChain(order) → auditTxHash` (mock). The real version calls the BSC Testnet contract.
- **Person 3, Demand + UI** → `src/lib/square/` and `src/app/`:
  - `getInventory()` (mock now, Square sandbox Inventory API later).
  - Dashboard pages: inventory levels (highlight items running low), requirements form, agent's proposed orders with reasoning and an Approve button, and order history with tx hashes.

Every integration module should switch between mock and real with an env flag (`USE_MOCKS=true` by default). Add a `// TODO(Person N):` comment at every spot where a real integration goes.

## API routes
- `GET /api/inventory`, `GET/POST /api/requirements`, `GET /api/products`
- `POST /api/agent/run` → runs the agent, stores proposed orders
- `POST /api/orders/[id]/approve` → pays, logs on-chain, updates status
- `GET /api/orders`

The full flow must work end to end on mocks: load dashboard → run agent → see proposed orders with reasoning → approve → order shows as paid with a (fake) tx hash.

## Contracts
`contracts/` with a Hardhat project containing a minimal `PurchaseLog.sol` (event emitted per purchase: orderId, distributor, amount, timestamp, reasoning hash), a deploy script targeting BSC Testnet, and a basic test. Keep it separate from the Next.js app's dependencies.

## Repo hygiene
- `.env.example` with: `USE_MOCKS`, `CONTEXT_DEV_API_KEY`, `SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT=sandbox`, `LLM_API_KEY`, `AGENT_WALLET_PRIVATE_KEY` (testnet only), `AUSD_CONTRACT_ADDRESS`, `BASE_SEPOLIA_RPC_URL`, `BSC_TESTNET_RPC_URL`, `PURCHASE_LOG_CONTRACT_ADDRESS`. Never commit a real `.env`.
- `.gitignore` covering `.env*` (except `.env.example`), `node_modules`, build output, Hardhat artifacts.
- `README.md` with: one-paragraph project description, setup steps, folder ownership table, the shared types, the integration checkpoints (1. real data replaces mocks and agent proposes orders; 2. approve triggers a real AUSD payment; 3. feature freeze, record 2-minute demo, public repo), and a workflow note: one branch per person (`supply`, `agent`, `ui`), PRs into `main`, don't edit another person's folder or the shared types without telling the team.

Only install core dependencies (Next.js, Tailwind, Hardhat). Don't guess package names for x402, AUSD, Context.dev, or Square. Leave those for each owner to add.

## Before finishing
Run the typecheck, lint, `npm run build`, and the contract test, and fix any failures. Then start the dev server and confirm the end-to-end mock flow works. Initialize git and make one initial commit, but do not push. Finally, summarize the folder tree and anything I need to do before pushing.
