# Handoff for Jason (Person 2: Agent + Payments)

From Jake, 2026-10-11. Read this with your role file (`jason-agent-payments.md`). Everything here is already on `main` (or will be when the `supply` PR merges) unless it says "you".

## 0. Before anything else: push and merge
- **Nothing from `agent` is on GitHub yet.** Push your WIP to `agent` now, even if it's broken, so the team can see where payments stand. Checkpoint 2 (real AUSD x402 payment + BSC audit event) is at **2:30**.
- Then `git pull origin main` into `agent`. Likely conflicts:
  - `src/lib/orders.ts`: Jake added one line after `upsertProducts` in `runAgentAndPropose`: `await store.retainProducts(listings.map((p) => p.id));` (drops delisted products). Keep it.
  - `src/lib/store.ts`: new methods `retainProducts`, `listNegotiations`, `listQuotes`. Additive; keep both sides.

## 1. Stanley's dashboard already calls two routes you own, and they're missing
Exact shapes his UI expects (`src/app/_components/api.ts`):

| Route | Request | Response |
|---|---|---|
| `GET /api/settings` | none | `{ settings: AutonomySettings, spentThisWeek: number }` |
| `PUT /api/settings` | `Partial<AutonomySettings>` | `{ settings: AutonomySettings, spentThisWeek: number }` |
| `POST /api/orders/[id]/reject` | none | `{ order: OrderWithProduct }` |

Note: the field is **`spentThisWeek`** (your role file said `spentLast7Days`; the UI wins). Building blocks exist: `store.getSettings/updateSettings/spentLast7Days`, `rejectOrder` in `src/lib/orders.ts`, `withProducts`.

## 2. The retail baseline is never a purchase candidate (new rule, PRD section 20)
- `Product.isRetailBaseline: true` (now **Walmart**, not Costco) is for comparison only. We can't pay Walmart over x402, and the product's point is buying from distributors.
- Exclude baseline listings from candidates at PRD section 8 step 2. Use the cheapest matching baseline listing per item for `baselinePrice` / `savingsPct` and for the walk-away price.
- If no distributor beats the baseline's landed cost, propose nothing for that item and say so in the reasoning ("Walmart is cheaper this week; buy retail").
- **What happens today:** run on real data, the mock agent buys *every* item from Walmart. Two reasons: the baseline is a candidate, and the mock adds 2% per day of lead time (Walmart says 2 days, distributors 4). PRD section 8 says pick by landed cost among listings that arrive before stockout, with no lead-time weight.
- Real numbers (best distributor vs Walmart, per unit, before shipping): sugar +33%, yeast +29%, chocolate chips +21%, butter +8%, eggs +3%, flour −5%.

## 3. `negotiateAll` is ready (PRD section 8 step 7)
```ts
import { negotiateAll } from "@/lib/negotiation";

const results = await negotiateAll(candidates.map((c) => ({
  product: c.product,          // a distributor listing (never the baseline)
  quantity: c.packs,           // packs you want from this listing
  walkAwayUnitPrice: walkAway, // USD per pack, see below
})));
// results[i] = { negotiation, quote? }. quote is set (signed, 30-min TTL) when status === "agreed".
```
- **Walk-away per pack** (PRD section 20) is the lower of:
  - `(requirement.maxBudget - product.shippingCost) / packs` (budget cap)
  - `baselineLandedPerUnit * packSizeInItemUnits - product.shippingCost / packs` (break-even with Walmart)
- Drop candidates that come back `no_deal`, then pick by landed cost using `quote.unitPrice` instead of the list price.
- **Put every negotiation in `AgentResult.negotiations`**, including no-deals: the dashboard shows all of them side by side. Put the winner's quote in `AgentResult.quotes`, and set both `order.negotiationId` and `order.quoteId` from the winner. Leave the negotiation `id`s as `negotiateAll` returns them: `GET /api/negotiations?orderId=` uses their shared prefix to find the batch.
- Include `negotiation.transcriptHash` in the PurchaseLog reasoning hash (PRD 7.6).
- The buyer's opening offer is computed inside `negotiateAll` (lowest per-unit list price − 15%). You don't pass it.
- Expected butter demo on real data (3 cases, Walmart at $3.06/lb):
  - **WebstaurantStore** Grassland 36 lb, list $101.30: walk-away ≈ $103.50, so it settles in round 3 at about **$96.55**.
  - **Bakers Authority** European 36 lb, list $152.83: its floor is $137.55 and the walk-away is about $101.83, so the buyer **walks**.
  - This is the demo script's negotiation scene.

## 4. Real catalog facts the agent must handle
- Units seen: `lb`, `oz`, `dozen`, `each`. Use `convertUnits`; skip listings it can't convert (some chocolate chips are listed as "4000 count").
- Skip `inStock: false` (a few Bakers Authority listings).
- Walmart packs are retail-sized (16 oz butter, 12-count eggs, 5 lb flour), so quantities in packs get large. That's expected; savings compare per unit.
- `shippingCost` / `leadTimeDays` are per-distributor estimates when the page doesn't say (WebstaurantStore $19.99 / 4 days, Bakers Authority $24.99 / 4 days, Walmart $0 / 2 days).
- Eggs have one distributor (Bakers Authority, "local delivery only") plus the baseline.
- Products load from `src/lib/supply/catalog-snapshot.json`, real data scraped 2026-10-11. With `USE_MOCKS_SUPPLY=false` you get it without spending Context.dev credits.

## 5. Payments reminders
- Checkout receives the **full signed quote** in the body: `POST /api/distributors/[id]/checkout` with `{ quote }`. Validation (`quoteProblem`) is already there. Your part is the 402 / x402 flow.
- Quotes expire after 30 minutes. Approving an older proposal fails with "quote expired": re-run the agent, or re-quote at list price.
- `NEGOTIATION_SIGNING_SECRET` must be the same on every machine and on Vercel. Agree on one value with the team.
- Unclaimed distributors (all three right now) pay `DEMO_DISTRIBUTOR_WALLET`. Claimed ones pay their `payoutWallet` (Stanley's portal sets it).
