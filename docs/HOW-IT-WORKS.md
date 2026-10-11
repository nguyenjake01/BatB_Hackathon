# How the project works

A plain-language tour of the important parts, written for the three of us. It describes the code as it is on `main` on 2026-10-11. For scope and priorities, `docs/PRD.md` is still the source of truth.

## The one-paragraph version

A bakery's stock lives in Square. Distributor prices are scraped from real websites. When the owner clicks **Run agent**, a rule-based agent works out which items are about to run low, how much to buy, and from whom. It haggles with each distributor's agent over price, then proposes an order with a written explanation. When the owner approves (or automatically, if the order is within their limits), the app pays the distributor in AUSD, a dollar stablecoin, and writes a tamper-evident record of the purchase to a second blockchain.

No AI model makes any decision or calculates any number. Everything is ordinary code with fixed rules, so the same inputs always give the same order.

## The journey of one order

Follow one click of **Run agent** through the system. Each step names the file that does the work.

1. **Load the inputs** (`src/lib/orders.ts`, `runAgentAndPropose`)
   - Inventory from Square (`src/lib/square/`)
   - The owner's requirements and autonomy settings (`src/lib/store.ts`)
   - Distributor listings for each inventory item (`src/lib/supply/`)
   - Current market signals (`src/lib/store.ts`, filled by the signals refresh)
2. **Decide** (`src/lib/agent/real.ts`). For each item: is a reorder due, how many packs, which listings qualify.
3. **Negotiate** (`src/lib/negotiation/`). The agent asks each qualifying distributor's agent for a better price.
4. **Pick and explain** (`src/lib/agent/real.ts`). Cheapest deal that arrives in time, plus the reasoning text.
5. **Apply autonomy** (`src/lib/agent/real.ts`). The order becomes `proposed` (waits for the owner) or `approved` (auto-buy).
6. **Pay** (`src/lib/payments/real.ts` and the checkout route). AUSD moves from the agent's wallet to the distributor's wallet on Base Sepolia.
7. **Record** (`src/lib/payments/real.ts`, `contracts/`). A `PurchaseLogged` event is written on BSC Testnet.

An order's `status` moves through: `proposed` → `approved` → `paid`, or to `rejected`, or to `failed` if the payment did not go through. A failed order can be approved again.

## Part 1: Inventory from Square (Stanley)

**Files:** `src/lib/square/real.ts`, `src/lib/square/catalog.ts`

Square tells us how much of each item is on hand. It does not tell us how fast the bakery uses it, or how long it keeps. So:

- **Stock on hand** comes straight from Square's `IN_STOCK` counts.
- **Daily usage** is calculated. The code adds up everything marked sold or wasted in the last 14 days and divides by the number of days that history covers.
- **Unit and shelf life** come from our own table, `ITEM_CONFIG` in `catalog.ts` (for example butter: pounds, 60 days). Square has no shelf-life field.

Each item becomes an `InventoryItem`: name, quantity on hand, unit, daily usage, shelf life.

## Part 2: Distributor prices from the web (Jake)

**Files:** `src/lib/supply/catalog.ts`, `real.ts`, `contextdev.ts`, `catalog-snapshot.json`

- **Who we scrape:** WebstaurantStore and Bakers Authority (real distributors with public prices), and Walmart as the **retail baseline**, meaning "what the bakery pays today".
- **How:** for each of six staples, the code builds the distributor's search or category page URL and sends it to Context.dev. Context.dev loads the page in a real browser and returns structured data that matches a schema we give it: product name, price, pack size, unit, stock, and so on.
- **Cleaning:** listings that are substitutes (vegan butter, powdered eggs) or have unusable units are dropped. At most four listings are kept per distributor per item.
- **Caching:** the result is saved to `catalog-snapshot.json`, which is committed to the repo. The app reads from that cache, so the demo does not depend on a live scrape succeeding. A re-scrape only happens when someone calls `POST /api/supply/refresh`.
- **Shipping and lead time** are taken from the page when it states them. Otherwise they fall back to each distributor's published policy (for example WebstaurantStore: $19.99, 4 days).

Each listing becomes a `Product`. A product is a **pack** (a case, a bag), so `unitPrice` is the price of one pack and `unitSize` is how much is in it.

### Signals

**File:** `src/lib/supply/signals.ts`

A signal is a hint about timing, attached to one item, pointing one of two ways:

- **`buy_early`:** prices look set to rise, or a distributor just cut its price.
- **`wait`:** prices look set to fall, or a distributor just raised its price.

They come from two places:

- **Price changes:** when a re-scrape finds a listing's price moved 3% or more from the last scrape.
- **News:** a web search per ingredient for the last month. Headlines are scored by counting keywords ("shortage", "surge" versus "glut", "decline"). No AI model reads them, and the text is only ever displayed, never treated as instructions.

## Part 3: The purchasing agent (Jason)

**File:** `src/lib/agent/real.ts`. It follows PRD section 8.

For each inventory item that has a requirement:

1. **Runway.** Days left = stock on hand ÷ daily usage.
2. **Candidates.** Listings whose name matches the item, that are in stock, fit the budget, and match the owner's quality notes ("unsalted") by keyword. The Walmart baseline is never a candidate; it is only the yardstick.
3. **Is a reorder due?** Yes if the stock left when the delivery arrives would be below the owner's minimum: `onHand − dailyUsage × leadTimeDays < minStockLevel`.
4. **How much?** Enough for 14 days of usage, rounded up to whole packs. Then two caps:
   - **Shelf life:** never more than can be used before it expires.
   - **Budget:** the order total, shipping included, must not exceed the item's `maxBudget`.
5. **Signals.** `buy_early` lets the agent order even when step 3 says not yet, and raises the quantity up to the shelf-life cap. `wait` postpones the order, but only while there are more than three days of slack beyond the delivery time.
6. **Negotiate** with one listing per distributor (Part 4).
7. **Pick.** The lowest **landed cost** among deals that arrive before stock runs out. If nothing arrives in time, the fastest one, with a warning.
8. **Savings.** Compare the order total with what the same amount would cost at the retail baseline.

**Landed cost** is the number everything is ranked by: `(pack price × packs + shipping) ÷ total amount`. It is the true cost per pound (or per egg) once shipping is included, which makes packs of different sizes comparable.

### The reasoning text

Every order carries a paragraph explaining itself: why this item, why now, why this distributor, why this quantity, and the savings. It is assembled from templates filled with the numbers the code just calculated. Nothing in it is written by an AI model.

### Autonomy

The owner picks one of two modes in the dashboard:

- **Ask me first:** every order is `proposed` and waits for a click.
- **Auto-buy within limits:** an order is paid immediately if it is at or under the **per-order limit**, and the **weekly budget** would not be exceeded. The weekly figure counts what was paid in the last 7 days plus anything auto-bought earlier in the same run. Orders over either limit fall back to `proposed`, with the reason written into the reasoning.

When items compete for the weekly budget, the item closest to running out goes first.

## Part 4: Agent-to-agent negotiation (Jake)

**Files:** `src/lib/negotiation/engine.ts` (the maths), `index.ts` (the wiring)

Two agents haggle over the price of one pack. Both are simple rule-followers.

**The buyer's agent** (acting for the bakery):

- **Opens** 15% below the lowest list price it has seen for that item.
- **Has a walk-away price** it will never go above. Our agent sets it to the lower of two limits: what the item's budget allows, and the price at which this distributor would stop being cheaper than Walmart.
- **Each round,** moves 30% of the remaining gap toward the distributor.

**The distributor's agent** follows that distributor's **policy**:

- **Opens** at list price, minus a volume discount if the order is big enough.
- **Has a floor** it will never go below (default: 90% of list).
- **Each round,** moves a set fraction of the gap toward the buyer (default 30%; faster if it has a lot of stock).

**How it ends,** after at most three rounds:

- **Deal,** if the two prices get within 2% of each other (they split the difference), or if in round 3 the distributor's offer is at or under the buyer's walk-away price.
- **No deal** otherwise. The buyer moves on.

Unclaimed distributors use the default policy. A distributor who claims their listing in the portal can set their own floor, concession rate, and volume tiers.

### Quotes: how a negotiated price becomes payable

A deal produces a **signed quote**: product, quantity, price per pack, total, and an expiry 30 minutes out. "Signed" here means the server stamps it with a code computed from those fields and a secret (`NEGOTIATION_SIGNING_SECRET`). If anyone changes a number, the stamp no longer matches and checkout refuses it. This is why the secret must be identical on every machine and on Vercel.

When no negotiation happens, the agent makes a quote at list price the same way.

The whole conversation is saved as a transcript and shown in the dashboard's **View negotiation** dialog.

## Part 5: Paying with AUSD over x402 (Jason)

**Files:** `src/app/api/distributors/[id]/checkout/route.ts`, `src/lib/payments/real.ts`, `x402.ts`, `chain.ts`

### The words

- **AUSD** is a stablecoin from Agora: a token meant to always be worth one US dollar. We use the test version, which is free and worthless.
- **Base Sepolia** is a test blockchain. Think of it as a practice copy of a real network where nothing costs real money.
- **A wallet** is an account on a blockchain. It has a public **address** (safe to share, like an account number) and a **private key** (the password; whoever has it can spend the funds).
- **Gas** is the fee a blockchain charges to process a transaction.
- **x402** is a way to pay for something over ordinary web requests. It is named after HTTP status code 402, "Payment Required".

### The flow

Our app plays two roles here: the **agent** (the buyer) and the **distributor's checkout** (the seller). They talk to each other over HTTP exactly as they would if the distributor ran their own server.

1. The agent sends the signed quote to the distributor's checkout, with no payment.
2. The checkout checks the quote's stamp and expiry, then answers **402 Payment Required** with the terms: this much AUSD, on Base Sepolia, to this wallet.
3. The agent checks those terms match the quote exactly: right token, right network, right amount. If anything differs, it refuses to sign.
4. The agent **signs a permission slip** with its private key. It says: "the holder of this slip may move exactly this amount of AUSD from my wallet to that wallet, within the next two minutes." The technical name is an ERC-3009 authorization.
5. The agent repeats the request with the slip attached.
6. The checkout hands the slip to a **facilitator**, a public service that verifies it and submits the transfer to the blockchain. The facilitator pays the gas, which is why the agent's wallet needs AUSD but no ETH.
7. The checkout replies with the transaction hash. The order becomes `paid` and the hash links to the block explorer.

### Where the money goes

A distributor who has **claimed** their listing is paid at the wallet they entered in the portal. Everyone else is paid at `DEMO_DISTRIBUTOR_WALLET`, a wallet we control.

### Safety rules built in

- **No double payment.** An order is flipped to `approved` before paying, and only `proposed` or `failed` orders can be approved. A second click gets "already paid".
- **Each slip works once.** It carries a unique number the token refuses to accept twice.
- **Honest failures.** If the payment is refused, the order is `failed` with the reason. If the app cannot tell whether a payment went out, it says so and does not retry on its own.
- **No fake hashes.** Outside mock mode, a hash is only ever shown if the blockchain returned it.

## Part 6: The audit log on BSC Testnet (Jason)

**Files:** `contracts/contracts/PurchaseLog.sol`, `src/lib/payments/real.ts` (`logPurchaseOnChain`)

After a payment succeeds, the app writes one record to a small program (a "smart contract") living on a second test blockchain, BSC Testnet. The record is an event holding the order id, the distributor, the amount, a timestamp, and a **reasoning hash**.

A hash is a fingerprint of some text: the same text always gives the same fingerprint, and any change gives a different one. Ours is the fingerprint of the order's reasoning plus the negotiation transcript. The text itself stays in our app. The point is that nobody can later change the explanation or the transcript without the fingerprint on the blockchain exposing it.

Only the wallet that deployed the contract can write to it, and that is the agent's wallet.

**Status:** the contract is written and tested, but **not yet deployed to BSC Testnet**. Until it is, orders are paid and show a warning that the audit record was not written. A failed audit write never undoes a payment.

## Part 7: The dashboard and distributor portal (Stanley)

**Files:** `src/app/_components/`, `src/app/distributor/`

The **owner dashboard** is one page of panels, each backed by an API route:

| Panel | What it shows | Route |
|---|---|---|
| Inventory | Stock, daily use, days left, low-stock flags | `GET /api/inventory` |
| Autonomy | Mode, limits, spent this week | `GET/PUT /api/settings` |
| Requirements | Minimum stock, budget, quality notes per item | `GET/POST /api/requirements` |
| Market signals | Buy-early and wait hints with source links | `GET /api/signals`, `POST /api/signals/refresh` |
| Proposed orders | Reasoning, savings, Approve, Reject, View negotiation | `POST /api/agent/run`, `.../approve`, `.../reject` |
| Order history | Paid orders with payment and audit links | `GET /api/orders` |

The **distributor portal** (switch role at the top) lets a distributor claim their listing and set a payout wallet, edit price and stock, set their agent's negotiation policy, and see incoming orders.

There is no login. The role switcher stands in for it.

## Things that hold it all together

- **Shared types** (`src/types/index.ts`): the shapes everyone codes against, such as `Product`, `Order`, `Quote`.
- **The store** (`src/lib/store.ts`): where requirements, settings, orders, quotes, and negotiations live. It is **in memory**, so everything in it disappears when the server restarts, and on Vercel separate server instances do not share it.
- **Mock switches** (`src/lib/config.ts`): `USE_MOCKS=true` fakes every integration. A per-module flag such as `USE_MOCKS_PAYMENTS=false` turns one part real. The dashboard header shows which parts are live.

## A worked example: butter, on the real catalog

- **Stock:** 20 lb on hand, using 6 lb a day, so about 3.3 days left. The owner's minimum is 24 lb.
- **Due?** WebstaurantStore delivers in 4 days. Stock would be gone by then, which is below 24 lb, so yes.
- **Quantity:** 14 days × 6 lb = 84 lb. Cases hold 36 lb, so 3 cases (108 lb). That fits the 60-day shelf life and the $400 budget.
- **Baseline:** the same 108 lb at Walmart would cost $330.48 ($3.06 a pound).
- **Walk-away price:** list is $101.30 a case with $19.99 shipping. The budget would allow up to $126.67 a case, but beating Walmart needs $103.50 or less, so the walk-away is $103.50.
- **Negotiation with WebstaurantStore:** the buyer opens about 15% under list. After three rounds the distributor is at $96.55, which is under the walk-away, so the buyer accepts.
- **Negotiation with Bakers Authority:** its European butter lists at $152.83 and its floor is $137.55, far above what would beat Walmart. No deal.
- **The order:** 3 cases at $96.55 plus $19.99 shipping is **$309.64**, which is 6% cheaper than Walmart.
- **Autonomy:** $309.64 is over the default $150 per-order limit, so even in auto mode it waits for approval.

## Known gaps

- **The audit contract is not deployed** to BSC Testnet yet.
- **Items with no deal show nothing.** On the real catalog, no distributor beats Walmart on flour, eggs, or yeast, so the agent creates no order for them and the dashboard does not say why.
- **The store forgets everything on restart,** including paid history and settings.
- **Quotes expire after 30 minutes.** Approving an older proposal fails with "quote expired"; run the agent again.
- **Approving an order does not reduce Square stock,** so running the agent again proposes the same items.
- **No AI model is used anywhere yet.** `LLM_API_KEY` is reserved for optionally rephrasing reasoning and classifying news, and neither is built.
