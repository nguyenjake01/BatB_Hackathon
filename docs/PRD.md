# Product Requirements Document: [Product Name]

> **Canonical PRD.** This file supersedes `docs/archive/Cafe-Agent-Marketplace-PRD.md` and `2026-10-11-hackathon-setup-prompt.md`. Conflicts between them are resolved in section 20. Per-person task lists: `docs/roles/`.

> **For agents working on this repo:** Read this whole document before writing code. It is the source of truth for scope, data shapes, and priorities. If this document and the code disagree, follow this document and flag the mismatch. **Time remaining at writing: ~4 hours.** Build P0 first, then P1. Do not start P2 unless P0 and P1 are done and working.

---

## 1. TL;DR

An AI purchasing agent that connects small businesses with national distributors. The business connects its inventory (Square), sets purchasing requirements, and chooses how much freedom the agent has. The agent watches stock levels, live distributor prices, and supply news, then finds the best deal and either proposes the order or buys it automatically within limits. Payment happens in AUSD stablecoin over the x402 protocol, and every purchase is recorded in an on-chain audit log. Distributors get their own agents, which negotiate price with the buyer's agent within limits each distributor sets, plus a simple portal to claim listings, configure their agent, and receive payments.

Demo customer: a small bakery (modeled on Katered Kneads) using a Square sandbox account.

## 2. Problem

- Small businesses buy supplies from Costco, Walmart, and similar retailers because they don't know about or can't easily reach the specialized national distributors that offer better prices.
- Those distributors, in turn, miss out on small-business customers.
- Owners also lack the time to track prices and supply news, so they reorder late and pay whatever the price is that day.

## 3. Goals and non-goals

**Goals**
- Reduce what a small business pays for supplies, measured against a retail baseline (Costco-style prices).
- Make purchasing hands-off but trustworthy: every decision is explained, limited by owner settings, and auditable on-chain.
- Show real, non-hard-coded functionality end to end: live scraped prices, real agent logic, real testnet payments, real on-chain logs.

**Non-goals (do not build)**
- Prediction markets or betting odds of any kind.
- Real money, mainnet deployments, or real customer payments. Testnets only.
- Real authentication. Use a simple role switcher (Owner / Distributor) for the demo.
- Shipping, logistics, or delivery tracking.
- Multi-tenant support. One demo business is enough.

## 4. Users

| User | Needs |
|---|---|
| **Business owner** (bakery) | See inventory health, set requirements and autonomy, review or approve orders, see savings and history |
| **Distributor** | Claim a scraped listing, set price and stock, set a payout wallet, see incoming orders and payments |
| **Buyer agent** (system actor, acts for the business) | Read inventory, requirements, products, and signals; decide what, when, and how much; negotiate with distributor agents; pay within limits |
| **Distributor agent** (system actor, acts for each distributor) | Respond to requests for quote; counteroffer within the distributor's floor price, volume tiers, and stock; issue signed quotes |

## 5. Hackathon tracks and how we satisfy them

General track: **Most Technically Impressive.** Judges score technical impressiveness, creativity, and functionality, and they check for hard-coded functionality.

| Track | What satisfies it |
|---|---|
| **Context.dev** | Live scraping of distributor catalogs and prices; website monitoring for price changes; news search for supply disruptions per ingredient |
| **Agora AUSD (x402)** | Agent pays distributor checkout endpoints via x402 with AUSD on Base Sepolia, using ERC-3009 gasless transfers |
| **YZi Labs** | `PurchaseLog` contract deployed on BSC Testnet giving a tamper-evident audit trail of every agent purchase, plus owner-delegated spending limits ("agent wallet with permissions and audit trail") and hashed agent-to-agent negotiation transcripts ("trusted agent infra") |

Submission needs: public GitHub repo, demo video on YouTube (**2 minutes max**), live deployment link (recommended). The submission platform needs **15 minutes**.

## 6. Core user flows

**Flow A: Owner setup (P0)**
1. Owner opens dashboard; inventory loads from Square sandbox.
2. Owner sets requirements per item (min stock, max budget, quality notes).
3. Owner sets autonomy: **Approval required** or **Auto-buy within limits** (per-order limit + weekly budget).

**Flow B: Agent run (P0)**
1. Owner clicks "Run agent" (or it runs on a timer, P2).
2. Agent evaluates each item, decides quantity and timing, negotiates with candidate distributors' agents (P1; without negotiation it uses list prices), picks the best deal, and writes reasoning.
3. In approval mode, orders appear as **proposed**. In auto mode, orders within limits are **paid** immediately; orders over limits fall back to **proposed**.

**Flow C: Approve and pay (P0)**
1. Owner clicks Approve on a proposed order.
2. Backend pays the distributor through x402 in AUSD, then logs the purchase on BSC Testnet.
3. Order shows **paid** with both transaction hashes linking to block explorers.

**Flow D: Distributor portal (P1)**
1. Distributor switches role, finds their scraped listing, and claims it.
2. Distributor edits price and stock, sets a payout wallet address, and configures their agent's negotiation policy.
3. Distributor sees incoming orders and AUSD received.

**Flow E: Signals (P1)**
1. Context.dev monitors claimed and scraped product pages for price changes and searches news per ingredient.
2. Each signal is classified as `buy_early`, `wait`, or `neutral` and shown on the dashboard with its source link.
3. The agent factors signals into timing and quantity, and cites them in reasoning.

**Flow F: Agent-to-agent negotiation (P1)**
1. The buyer agent sends a request for quote to each candidate distributor's agent.
2. The agents exchange offers for up to 3 rounds, each within its own limits.
3. Deals become signed quotes. The buyer agent picks the best one, and the full transcript appears in the UI as a chat between the agents.

## 7. Functional requirements

Priorities: **P0** = must ship for the demo. **P1** = ship if P0 works. **P2** = only with spare time. **Within P1, build in this order: negotiation, distributor portal, signals.**

### 7.1 Supply (Person 1)
- **P0** First 15 minutes: choose distributors that show prices publicly (e.g., WebstaurantStore, Bakers Authority). Many B2B distributors (Sysco, US Foods) hide prices behind a login, so there is nothing to scrape. Confirm Context.dev can read each site before writing scraper code.
- **P0** Scrape real listings for at least 4 bakery staples (flour, butter, sugar, eggs; add yeast and chocolate chips if time) from at least 2 real distributors each, plus a retail baseline (Costco-style) for comparison. Normalize to `Product`.
- **P0** Cache scraped results in the store so the demo doesn't depend on live scraping succeeding on camera. Keep `scrapedAt` and `sourceUrl` on every record.
- **P1** Price-change monitoring on product pages → `Signal` of kind `price_change`.
- **P1** News search per ingredient (e.g., "butter shortage", "flour prices") → `Signal` of kind `news`, classified by the LLM, with a heuristic fallback.
- **P1** Claim API for the distributor portal: claim a listing, update price, stock, and payout wallet.

### 7.2 Agent (Person 2)
- **P0** Deterministic decision logic (section 8). Numbers come from code, never invented by the LLM.
- **P0** Autonomy enforcement: approval mode, and auto-buy mode with per-order limit and rolling 7-day budget.
- **P0** Reasoning string per order: why this item, why now, why this distributor, why this quantity, savings vs baseline. The LLM may rephrase computed facts into friendlier text but must not change numbers. If no LLM key is set, use a template.
- **P1** Signal-aware timing and quantity (section 8, step 6).

### 7.3 Payments and audit (Person 2)
- **P0** Distributor checkout endpoint `POST /api/distributors/[id]/checkout` protected by x402. Unpaid requests get HTTP `402` with payment requirements (AUSD on Base Sepolia, amount, `payTo` = distributor payout wallet). The amount equals the order's quote (the negotiated price, or list price if negotiation didn't run). The endpoint rejects requests whose quote is missing, expired, or has an invalid signature.
- **P0** Agent payment client: request checkout, receive 402, sign the ERC-3009 authorization from the agent wallet, retry with payment, record `txHash`. Use the **Agora Docs MCP** for current x402 and AUSD details; do not guess package names or contract addresses.
- **P0** `PurchaseLog.sol` on BSC Testnet: emits an event per purchase (orderId, distributor, amount, timestamp, reasoning hash). Backend calls it after payment and stores `auditTxHash`.
- **P1** Payout routing: claimed listings pay the distributor's wallet; unclaimed listings pay `DEMO_DISTRIBUTOR_WALLET` and are labeled "unclaimed" in the UI.

### 7.4 Demand side and UI (Person 3)
- **P0** Square sandbox Inventory API integration, with the sandbox seeded to mirror a bakery's items and usage.
- **P0** Owner dashboard:
  - Inventory table with days-until-stockout and low-stock highlighting
  - Requirements form
  - Autonomy settings (mode, per-order limit, weekly budget, spent this week)
  - Proposed orders with reasoning and Approve / Reject buttons
  - Order history with explorer links for `txHash` (Base Sepolia) and `auditTxHash` (BSC Testnet)
  - Savings vs retail baseline (total and per order)
- **P1** Signals panel with source links.
- **P1** Distributor portal UI (role switcher, claim listing, edit price/stock/wallet, agent policy settings, incoming orders and negotiation transcripts).
- **P1** Negotiation transcript view on each order (chat between buyer agent and distributor agent, with the final signed quote).
- **P0** Deployment to Vercel, demo recording, submission.

### 7.5 P2 ideas (do not start early)
- Scheduled agent runs.
- LLM-driven negotiation strategies beyond the deterministic concession math.
- Multiple demo businesses.

### 7.6 Negotiation (Person 1)
Both agents run in our backend for the demo, but the distributor agent sits behind its own endpoint (`POST /api/distributors/[id]/negotiate`) so a distributor could host their own agent later.

- **P1 Distributor agent.** Responds to requests for quote using its `DistributorPolicy`:
  - Opening offer: list price minus any volume tier discount for the requested quantity.
  - Each round, concede `concessionRate` of the gap toward the buyer's last offer. Concede more (×1.5) when stock is above `highStockThreshold`.
  - Never go below `floorPricePct × list price`.
- **P1 Buyer agent.**
  - Opening offer: the lowest list price among candidates, minus a target discount (default 15%).
  - Walk-away price: the lower of the requirement's `maxBudget` (per unit) and the retail baseline's landed unit cost. If it can't beat Costco, it walks.
  - Each round, concede a fixed fraction (default 30%) of the gap toward the distributor's last offer.
- **P1 Protocol.** Max 3 rounds. Agree when the gap is within 2% (split the difference). Otherwise the result is `no_deal` and the buyer moves on to other distributors. Negotiate with all candidates in parallel.
- **P1 Quotes.** An agreed deal becomes a `Quote` signed with HMAC using `NEGOTIATION_SIGNING_SECRET`, expiring after 30 minutes. The x402 checkout charges exactly the quote amount.
- **P1 Transcript.** Store every message. Message text comes from templates; the LLM may rephrase it but must not change numbers. Hash the transcript and include it in the `PurchaseLog` reasoning hash.
- **P1 Default policies.** Unclaimed distributors use a default policy (floor 90% of list, concession rate 30%, 5% off above a volume threshold), labeled "default policy" in the UI. Claimed distributors set their own in the portal.
- **P1 Tests.** Unit-test that agreed prices never go below the distributor's floor or above the buyer's walk-away price.

## 8. Agent decision logic

For each `InventoryItem` with a matching `Requirement`:

1. **Runway.** `daysLeft = quantityOnHand / dailyUsage`.
2. **Candidates.** Products matching the item name, within `maxBudget`, and consistent with `qualityNotes`. Exclude out-of-stock claimed listings.
3. **Landed cost.** For each candidate: `landedUnitCost = (unitPrice * qty + shippingCost) / (qty * unitSize)`.
4. **Need to reorder?** Reorder if projected stock on arrival is below the minimum: `quantityOnHand - dailyUsage * leadTimeDays < minStockLevel`.
5. **Quantity.** Cover a target window (default 14 days), then cap it:
   - **Shelf-life cap:** never buy more than can be used before expiring: `qty * unitSize ≤ dailyUsage * shelfLifeDays - quantityOnHand`.
   - **Budget cap:** `totalPrice ≤ maxBudget`.
   - Round to whole units.
6. **Signals (P1).**
   - `buy_early`: allow a reorder even if step 4 says not yet, and raise quantity up to the shelf-life cap.
   - `wait`: defer if `daysLeft > leadTimeDays + 3` (safety buffer); otherwise buy normally.
   - Cite the signal's summary and `sourceUrl` in the reasoning.
7. **Negotiate (P1).** Run negotiation (section 7.6) with every candidate in parallel. Replace list prices with agreed prices, and drop candidates that ended in `no_deal`.
8. **Pick.** Lowest landed cost among candidates whose lead time arrives before stockout. If none arrive in time, pick the fastest and say so in the reasoning.
9. **Savings.** Compare to the retail baseline product for the same item (`savingsPct`), and to the list price (negotiated discount).
10. **Autonomy.**
   - Approval mode → status `proposed`.
   - Auto mode → if `totalPrice ≤ perOrderLimit` and `spentLast7Days + totalPrice ≤ weeklyBudget`, pay immediately; otherwise `proposed`, with the reason ("over weekly budget").

## 9. Data model (`src/types/index.ts`)

```ts
type Product = {
  id: string; name: string; distributorId: string; distributorName: string;
  unitPrice: number; unitSize: number; unit: string; shippingCost: number;
  leadTimeDays: number; inStock: boolean; isRetailBaseline: boolean;
  sourceUrl: string; scrapedAt: string;
};

type Distributor = {
  id: string; name: string; website: string;
  claimed: boolean; payoutWallet?: string;   // Base Sepolia address
};

type InventoryItem = {
  sku: string; name: string; quantityOnHand: number; unit: string;
  dailyUsage: number; shelfLifeDays: number;
};

type Requirement = {
  id: string; itemName: string; minStockLevel: number;
  maxBudget: number; qualityNotes?: string;
};

type AutonomySettings = {
  mode: "approval" | "auto";
  perOrderLimit: number;   // USD
  weeklyBudget: number;    // USD, rolling 7 days
};

type Signal = {
  id: string; itemName: string; kind: "price_change" | "news";
  direction: "buy_early" | "wait" | "neutral";
  summary: string; sourceUrl: string; detectedAt: string;
};

type DistributorPolicy = {
  distributorId: string; isDefault: boolean;
  floorPricePct: number;      // minimum price as a fraction of list, e.g. 0.9
  concessionRate: number;     // fraction of the gap conceded per round
  volumeTiers: { minQty: number; discountPct: number }[];
  highStockThreshold: number; autoAccept: boolean;
};

type NegotiationMessage = {
  round: number; from: "buyer" | "distributor";
  unitPrice: number; text: string; at: string;
};

type Negotiation = {
  id: string; productId: string; distributorId: string; quantity: number;
  messages: NegotiationMessage[];
  status: "open" | "agreed" | "no_deal";
  agreedUnitPrice?: number; transcriptHash?: string;
};

type Quote = {
  id: string; negotiationId?: string; productId: string; distributorId: string;
  quantity: number; unitPrice: number; totalPrice: number;
  expiresAt: string; signature: string;   // HMAC, NEGOTIATION_SIGNING_SECRET
};

type Order = {
  id: string; productId: string; distributorId: string; quantity: number;
  totalPrice: number; listTotal?: number; baselinePrice?: number; savingsPct?: number;
  reasoning: string; signalIds: string[]; negotiationId?: string; quoteId?: string;
  status: "proposed" | "approved" | "paid" | "rejected" | "failed";
  autoPurchased: boolean; txHash?: string; auditTxHash?: string;
  error?: string; createdAt: string;
};
```

Changing these types affects everyone. Announce changes to the team before merging.

## 10. API

| Method | Route | Purpose | Priority |
|---|---|---|---|
| GET | `/api/inventory` | Inventory from Square (or mock) | P0 |
| GET/POST | `/api/requirements` | Read and update requirements | P0 |
| GET/PUT | `/api/settings` | Autonomy settings | P0 |
| GET | `/api/products` | Normalized product listings | P0 |
| POST | `/api/supply/refresh` | Re-scrape catalogs | P0 |
| POST | `/api/agent/run` | Run agent; returns created orders | P0 |
| POST | `/api/orders/[id]/approve` | Pay via x402 + log on-chain | P0 |
| POST | `/api/orders/[id]/reject` | Reject a proposed order | P0 |
| GET | `/api/orders` | Order history | P0 |
| POST | `/api/distributors/[id]/checkout` | x402-protected checkout | P0 |
| GET | `/api/signals` | Current signals | P1 |
| POST | `/api/signals/refresh` | Run monitoring + news search | P1 |
| POST | `/api/distributors/[id]/claim` | Claim listing, set wallet | P1 |
| PUT | `/api/distributors/[id]/products/[productId]` | Update price/stock | P1 |
| GET | `/api/distributors/[id]/orders` | Distributor's incoming orders | P1 |
| POST | `/api/distributors/[id]/negotiate` | Distributor agent: takes a request for quote or counteroffer, returns its offer | P1 |
| GET/PUT | `/api/distributors/[id]/policy` | Distributor agent settings | P1 |
| GET | `/api/negotiations/[id]` | Negotiation transcript | P1 |

## 11. Architecture

- Single **Next.js (App Router) + TypeScript** app on Vercel, Tailwind for UI, API routes for the backend.
- In-memory store behind `src/lib/store.ts`, seeded on startup from cached scrape data. (Vercel serverless instances don't share memory, so if state gets lost between requests in production, switch the store to a hosted KV or SQLite service behind the same interface.)
- `contracts/`: separate Hardhat project for `PurchaseLog.sol`, deployed to BSC Testnet.
- Every integration module supports `USE_MOCKS=true` for local development. **Mocks are scaffolding only. The demo must run with `USE_MOCKS=false`.**

```
src/
  app/                 # Owner dashboard, distributor portal, API routes   (Person 3, API routes by owner)
  lib/supply/          # Context.dev scraping, monitoring, news            (Person 1)
  lib/negotiation/     # Buyer + distributor negotiation agents, quotes    (Person 1)
  lib/agent/           # Decision logic, reasoning                         (Person 2)
  lib/payments/        # x402 client, AUSD, PurchaseLog calls              (Person 2)
  lib/square/          # Square sandbox inventory                          (Person 3)
  lib/store.ts         # Shared store interface
  types/index.ts       # Shared types (announce changes)
contracts/             # Hardhat project, PurchaseLog.sol                  (Person 2)
```

## 12. Environment variables

`USE_MOCKS`, `CONTEXT_DEV_API_KEY`, `SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT=sandbox`, `LLM_API_KEY`, `AGENT_WALLET_PRIVATE_KEY` (testnet only), `AUSD_CONTRACT_ADDRESS`, `BASE_SEPOLIA_RPC_URL`, `BSC_TESTNET_RPC_URL`, `PURCHASE_LOG_CONTRACT_ADDRESS`, `DEMO_DISTRIBUTOR_WALLET`, `NEGOTIATION_SIGNING_SECRET`.

Never commit `.env`. Never log private keys. Testnet wallets only.

## 13. Ownership

| Person | Owns |
|---|---|
| **Person 1 (Jake): Supply + Negotiation** | `lib/supply/`, `lib/negotiation/`, scraping, caching, distributor agents and negotiation, signals, distributor claim/update/policy APIs |
| **Person 2 (Jason): Agent + Payments** | `lib/agent/`, `lib/payments/`, checkout endpoint, `contracts/` |
| **Person 3 (Stanley): Demand + UI** | `lib/square/`, all pages (owner dashboard, distributor portal), deployment, demo video, submission |

Branches: `supply`, `agent`, `ui`. PRs into `main`. Don't edit another person's folder without telling them.

## 14. Timeline (4 hours)

| Time | Milestone |
|---|---|
| 0:00–0:15 | Repo pushed, everyone cloned, env vars shared, wallets funded (Base Sepolia gas + AUSD faucet, BSC Testnet BNB), Square sandbox access, distributors with public prices chosen. Everyone does their own setup in parallel. |
| 0:15–1:45 | Parallel P0 build. **Person 2 starts on the x402 payment flow first**, before agent logic, because it is the riskiest piece. |
| **1:45** | **Checkpoint 1:** real scraped products + real Square inventory; agent proposes orders on the dashboard |
| 1:45–2:30 | **Checkpoint 2:** Approve triggers a real AUSD x402 payment and a BSC audit log; both hashes in history. Deploy to Vercel. |
| 2:30–3:00 | P1 in order: negotiation, distributor portal (agent settings), signals. Person 1 starts negotiation as soon as scraped data is cached, ideally by 1:00, so it's ready to plug in here. |
| **3:00** | **Feature freeze.** Only bug fixes after this. |
| 3:00–3:40 | Final deploy, record and upload demo video, make repo public, write README top section |
| 3:40–3:55 | Submit (allow 15 min) |

## 15. Feasibility, risks, and cut order

**Assessment:** The P0 core is achievable in 4 hours with agents if work starts immediately. The full PRD including P1 probably won't all fit. Agents write code fast; the time goes to external setup, integration, and debugging.

**Expected outcome**
- **Very likely:** dashboard, Square inventory, scraped products, agent logic with reasoning, approval and auto modes, BSC audit contract (~20 min).
- **Likely but risky:** real AUSD x402 payment working end to end.
- **Likely if Person 1 starts it early:** agent-to-agent negotiation with default distributor policies.
- **Only if things go smoothly:** signals and the full distributor portal.

**Risks, highest first**

| Risk | Mitigation |
|---|---|
| **x402 + AUSD payments** are new and poorly documented; failures come from signature formats, wrong contract addresses, facilitator errors | Person 2 starts here first. Use the Agora Docs MCP. Ask the Agora team table early if stuck for more than 20 minutes. |
| **Distributor prices hidden behind logins** | Pick public-price distributors in the first 15 minutes; verify Context.dev can read them before building. Cache results. |
| **Setup chores** (faucets, API keys, Square sandbox, seeding) can take 30+ minutes | Everyone does their own setup in parallel at 0:00. |
| **Merge conflicts** from three agents editing shared types and routes | Follow folder ownership; announce type changes; expect one integration hiccup at checkpoint 1. |
| **Vercel in-memory state** lost between serverless requests | Swap to a hosted KV store behind `store.ts`, or record the demo locally. A live deployment is recommended, not required. |
| **Negotiation eats time or produces odd prices** | Keep the concession math deterministic, cap at 3 rounds, unit-test the floor and walk-away bounds. If it isn't working by 2:45, ship list prices. |

**Cut order if behind at Checkpoint 1 (1:45)**
1. Signals
2. Distributor portal UI (distributor agents keep running on default policies)
3. YZi BSC audit contract
4. Negotiation (fall back to list prices)

**Protect the x402 payment above everything else.** It is what makes the project a contender for both the AUSD track and Most Technically Impressive.

**Hold the 3:00 feature freeze no matter what.** Running out of time for the video and submission is the most common way teams lose.

## 16. Demo script (2 minutes max)

1. **Problem (15s):** bakery owner pays Costco prices because better distributors are hard to reach and there's no time to track prices.
2. **Setup (15s):** Square inventory loads; butter is 3 days from stockout. Set requirements and choose auto-buy under $150/order.
3. **Agent run (20s):** agent decides what to buy and when; show reasoning for butter: quantity capped by shelf life, a news signal about rising prices so it buys early.
4. **Negotiation (25s):** show the butter negotiation as a chat between the buyer agent and two distributor agents. One settles in round 3 below list price; the other hits its floor and walks away. The signed quote becomes the payment amount.
5. **Payment (25s):** approve one order (and show one auto-purchased order); show the AUSD payment on Base Sepolia and the audit event on BSC Testnet in block explorers.
6. **Distributor side (15s):** distributor adjusts its agent's floor price and sees the incoming AUSD payment.
7. **Close (5s):** savings vs Costco and vs list price, and what's next.

## 17. Definition of done (P0)

- [ ] Dashboard loads real Square sandbox inventory with `USE_MOCKS=false`.
- [ ] Products come from real scraped pages, each with a working `sourceUrl`.
- [ ] Agent produces orders whose numbers match section 8, with reasoning and savings.
- [ ] Approval mode and auto mode both work, and auto mode respects both limits.
- [ ] Approving an order produces a real Base Sepolia AUSD transaction and a real BSC Testnet audit event, both linked in the UI.
- [ ] Deployed on Vercel; repo public; demo video under 2 minutes; submitted.

## 18. Rules for agents

- Check priorities before starting work. P0 before P1.
- Never hard-code agent outputs, prices, or transaction hashes in non-mock code paths. Judges check.
- Keep every LLM call optional and keep numbers deterministic.
- Look up x402, AUSD, Context.dev, Square, and BNB Chain details in their docs or MCP servers instead of guessing.
- Run typecheck and build before pushing. Don't break `main`.
- Keep commits small and messages clear. Update this PRD if scope changes.

## 19. Open questions

- Product name (placeholder: [Product Name]).
- Which LLM provider to use for reasoning and news classification (`LLM_API_KEY` is provider-agnostic for now).
- Which real distributors to scrape. Pick ones whose pages Context.dev can read reliably.

## 20. Decisions and conflict resolutions (added during repo prep)

Three planning documents existed. This section records how they were reconciled. **This PRD wins every conflict.**

**Café Agent Marketplace PRD (`docs/archive/`) — not adopted as the product.** It describes a different product (café cups/lids, three fictional suppliers, quotes without haggling, simulated payment, SQLite). We keep this PRD's bakery + Square + scraping + negotiation + x402 + BSC scope. Café PRD ideas we **do** adopt because they don't conflict:
- **Approve is idempotent.** Double-click or retry must never pay twice. `approveOrder` only accepts `proposed`/`failed` orders and flips to `approved` before paying (Person 2 keeps this guarantee in the real payment client).
- **Honest labeling.** Never show a fake tx hash or explorer link in a non-mock path. If a payment's broadcast status is unknown (timeout/crash), mark the order `failed` with `error` explaining it and do not auto-retry.
- **The LLM never calculates prices or signs transfers.** (Same as section 18.)
- **Fetched web text is untrusted data**, never instructions to the agent (Person 1, signals + scraping).
- **Payment decision gate (Person 2, first 20 min):** if AUSD x402 on Base Sepolia can't be made to work by Checkpoint 2, tell the team immediately; we keep mocks for the video only as a last resort and label it honestly.

**Original setup prompt (`2026-10-11-hackathon-setup-prompt.md`) vs this PRD.** The code was scaffolded from the setup prompt and has been migrated to this PRD's contract:

| Topic | Setup prompt / old code | Resolution (now in code) |
|---|---|---|
| `Product` | `distributor: string` | `distributorId`, `distributorName`, `inStock`, `isRetailBaseline` (section 9). Plus optional `stockQuantity` — needed because `highStockThreshold` needs a number and `inStock` is a boolean. |
| `Requirement.qualityNotes` | required | optional |
| `Requirement.maxBudget` | per order | **USD per order, shipping included** (section 8 step 5). The per-unit walk-away in 7.6 is derived: `min((maxBudget - shippingCost) / qty, price at which landed cost per item unit equals the baseline's)`, computed by the agent and passed to `negotiateAll`. |
| `Order` | 8 fields, no `rejected` | Full section 9 shape. `OrderWithProduct` also joins `distributor`. |
| Checkout route | `POST /api/distributor/checkout` (body: productId, quantity) | `POST /api/distributors/[id]/checkout` (body: `{ quote }`). The full signed quote travels in the body so verification works across serverless instances. |
| Quotes | n/a | Shared `src/lib/quotes.ts`: `signQuote` / `quoteProblem` (HMAC, 30-min TTL). Agent creates list-price quotes when negotiation doesn't run. |
| Agent | "LLM chooses orders" | Deterministic section 8 logic; LLM may only rephrase. `runAgent(ctx) → { orders, quotes, negotiations }`. Auto-approved orders come back `approved` + `autoPurchased: true` and `src/lib/orders.ts` pays them. |
| Mock agent rules | 7-day reorder horizon, +2%/day lead-time weight, target = min + 14 days | Section 8 wins. Person 2 fixes these in the real agent (listed at top of `src/lib/agent/mock.ts`). |
| Catalog refresh | `GET /api/products?refresh=true` | `POST /api/supply/refresh` (old query param may stay as an alias). |
| Route ownership | all routes shared | Routes belong to the owner of the feature (section 13); `src/lib/orders.ts`, `store.ts`, `quotes.ts`, `types/` stay shared. |
| Env vars | 10 vars | Added `DEMO_DISTRIBUTOR_WALLET`, `NEGOTIATION_SIGNING_SECRET`. |
| Negotiation opening offer | "lowest list price among candidates" | Packs differ in size, so compare **per item unit**, then convert back to each candidate's pack price. |
