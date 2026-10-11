# Stanley — Person 3: Demand + UI

**Branch:** `ui` · **PRD sections:** 7.4, 16 (demo script), 17 (definition of done), flows A, C (UI side), D

## You own
- `src/lib/square/` (Square sandbox inventory)
- All pages and components: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/_components/`, and any new pages (e.g. `src/app/distributor/`)
- Vercel deployment, demo video, submission, the README top section

## Contracts others depend on (don't change without telling the team)
- `getInventory() → InventoryItem[]` in `src/lib/square/index.ts`
- Call the API through `src/app/_components/api.ts`. Shapes are in `src/types/index.ts`; `OrderWithProduct` includes `product` and `distributor`.
- If you need an API route that doesn't exist yet, ask its owner (Jake: supply/signals/distributors/negotiations; Jason: agent/orders/settings/checkout). Don't build it in their folder.

## Tasks, in order
### P0 (Checkpoint 1 at 1:45: real Square inventory in the dashboard)
- [ ] **First 15 min:** create the Square sandbox account, get `SQUARE_ACCESS_TOKEN`, and seed it with bakery items matching `src/lib/square/mock.ts` (flour, butter, sugar, eggs, yeast, chocolate chips).
- [ ] Implement `squareInventory.getInventory` in `src/lib/square/real.ts`. Square doesn't track `dailyUsage` or `shelfLifeDays`: derive usage from recent inventory changes and keep shelf life in our own config. Look these up in the Square docs; don't guess.
- [ ] Owner dashboard (some of this exists already):
  - [ ] Inventory table with days-until-stockout and low-stock highlighting
  - [ ] Requirements form (`qualityNotes` is optional now)
  - [ ] **Autonomy settings panel (new):** mode toggle, per-order limit, weekly budget, spent this week (`GET/PUT /api/settings`, Jason)
  - [ ] Proposed orders with reasoning, **Approve and Reject** buttons (`POST /api/orders/[id]/reject`)
  - [ ] Order history with explorer links: `txHash` → `https://sepolia.basescan.org/tx/`, `auditTxHash` → `https://testnet.bscscan.com/tx/`. Show "auto-purchased" and `error`. Status `rejected` exists now.
  - [ ] Savings vs retail baseline (total and per order: `savingsPct`, `baselinePrice`, `listTotal`)
- [ ] Deploy to Vercel early (by Checkpoint 2). The in-memory store doesn't survive across serverless instances; if that breaks the live demo, record the demo locally.

### P1
- [ ] Signals panel with source links (`GET /api/signals`, `POST /api/signals/refresh`)
- [ ] Distributor portal: role switcher (Owner / Distributor, no auth), claim a listing + payout wallet, edit price/stock, agent policy settings (floor %, concession rate, volume tiers; label "default policy"), incoming orders + AUSD received
- [ ] Negotiation transcript view per order: a chat between the buyer agent and the distributor agent, plus the final signed quote (`GET /api/negotiations/[id]`)

### Wrap-up (owner of the deadline)
- [ ] **3:00 feature freeze.** 3:00–3:40: final deploy, record the ≤2-minute video following PRD section 16, make the repo public, write the README top section. 3:40–3:55: submit (allow 15 minutes).

## Done when
PRD section 17 checklist is green, the video is uploaded, and the project is submitted.
