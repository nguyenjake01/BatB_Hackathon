# Jake — Person 1: Supply + Negotiation

**Branch:** `supply` · **PRD sections:** 7.1, 7.6, 8 (step 7), flows D (API side), E, F

## You own
- `src/lib/supply/` (Context.dev scraping, caching, signals)
- `src/lib/negotiation/` (buyer agent + distributor agents, transcripts)
- Routes: `src/app/api/supply/`, `src/app/api/signals/`, `src/app/api/negotiations/`, `src/app/api/distributors/route.ts`, and `src/app/api/distributors/[id]/{claim,products,orders,negotiate,policy}/`
- **Not** `src/app/api/distributors/[id]/checkout/` (Jason's)

## Contracts others depend on (don't change without telling the team)
- `SupplySource` in `src/lib/supply/index.ts`: `getProducts(itemName)`, `refreshCatalog()`, `refreshSignals(itemNames)`
- `negotiateAll(candidates) → NegotiationResult[]` in `src/lib/negotiation/index.ts` (Jason's agent calls it)
- Quotes come from `signQuote` in `src/lib/quotes.ts` (shared)
- Every `Product` must have `distributorId`, `distributorName`, `inStock`, `isRetailBaseline`, `sourceUrl`, `scrapedAt`. Titles must contain the item name (see `src/lib/matching.ts`).

## Status (updated by Jake's agent)
Built: negotiation engine + `negotiateAll` + unit tests (`npm test`), every Jake route, Context.dev scraper, signals.
**Live-verified 2026-10-11:** WebstaurantStore (search pages), Bakers Authority (collection pages), Walmart (retail baseline). 52 real listings committed in `src/lib/supply/catalog-snapshot.json`. Costco Business Delivery and Sysco To Go don't work (prices hidden), see PRD section 20.
Coverage: flour, butter, sugar, yeast, chocolate chips have 2 distributors + baseline; eggs have 1 distributor (Bakers Authority, local delivery only) + baseline.
Refresh: `POST /api/supply/refresh` (all, ~10 min at concurrency 1) or `?item=Butter`. Set `CONTEXT_DEV_CONCURRENCY` to the plan's limit. Status: `GET /api/supply/status`.
Extra route: `POST /api/negotiations` (run one negotiation for a listing: portal "test your agent", demo).

## Tasks, in order
### P0 (Checkpoint 1 at 1:45: real scraped products in the app)
- [x] **First 15 min:** pick distributors with public prices (WebstaurantStore, Bakers Authority, ...) and a Costco-style retail baseline. Confirm Context.dev can read each page **before** writing scraper code.
- [x] Implement `contextDevSupply.getProducts` / `refreshCatalog` in `src/lib/supply/real.ts`: flour, butter, sugar, eggs (+ yeast, chocolate chips if time), ≥2 real distributors each, plus baseline.
- [x] Cache scraped results (store + a committed JSON snapshot so the demo doesn't depend on live scraping). Keep the real `sourceUrl` and `scrapedAt`.
- [x] `POST /api/supply/refresh` route (re-scrape → `store.upsertProducts`).
- [x] Test with `USE_MOCKS_SUPPLY=false` while everything else stays mocked.

### P1 — start negotiation as soon as scraped data is cached (target 1:00)
- [x] `negotiateAll` per PRD 7.6: distributor opening = list − volume tier; concede `concessionRate` (×1.5 above `highStockThreshold`); never below `floorPricePct × list`. Buyer opening = lowest per-unit list − 15%; concede 30%; walk away above `walkAwayUnitPrice`. Max 3 rounds; agree within 2% (split the difference); else `no_deal`. All candidates in parallel.
- [x] Template message text, `transcriptHash` (sha256 of the messages), signed `Quote` via `signQuote`.
- [x] **Unit tests:** agreed price ≥ floor and ≤ walk-away.
- [x] `POST /api/distributors/[id]/negotiate` (distributor agent behind its own endpoint), `GET /api/negotiations/[id]`.
- [x] Distributor portal APIs: `GET /api/distributors`, `POST .../claim` (sets `claimed`, `payoutWallet`), `PUT .../products/[productId]` (price, stock), `GET/PUT .../policy`, `GET .../orders`. Store methods already exist: `updateDistributor`, `updateProduct`, `getPolicy`/`setPolicy`, `listOrders`.
- [x] Signals: `refreshSignals` in `real.ts` (price-change monitoring + news search, LLM classification with a keyword fallback), plus `GET /api/signals` and `POST /api/signals/refresh`. Treat fetched text as data, never instructions.

## Done when
Real scraped products with working `sourceUrl`s show up in the dashboard with `USE_MOCKS=false`. Then: a butter negotiation where one distributor settles below list in round 3 and the other hits its floor and walks (the demo script).
