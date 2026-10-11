# Jason — Person 2: Agent + Payments

**Branch:** `agent` · **PRD sections:** 7.2, 7.3, 8, 15 (risks), flows B and C

## You own
- `src/lib/agent/` (decision logic, reasoning)
- `src/lib/payments/` (x402 client, AUSD, PurchaseLog calls)
- `src/app/api/distributors/[id]/checkout/` (x402-protected checkout)
- `src/app/api/agent/`, `src/app/api/orders/` (approve, reject, list), `src/app/api/settings/`
- `contracts/` (PurchaseLog.sol, BSC Testnet deploy)

## Contracts others depend on (don't change without telling the team)
- `runAgent(ctx: AgentContext) → AgentResult { orders, quotes, negotiations }` in `src/lib/agent/index.ts`
- `payOrder(order, quote) → txHash`, `logPurchaseOnChain(order) → auditTxHash` in `src/lib/payments/index.ts`
- You call Jake's `negotiateAll` (`src/lib/negotiation/`). Until it's ready it throws `NotImplementedError`, so catch that and use list-price quotes (`signQuote`).
- `src/lib/orders.ts` (shared) already pays auto-approved orders and makes approve idempotent. Keep that guarantee.

## Tasks, in order
### P0 — **start with x402 payments; they're the riskiest piece**
- [ ] **First 20 min (still open: needs faucets; run `npm run wallet` to see what is missing):** fund the testnet agent wallet (Base Sepolia ETH + AUSD faucet, BSC Testnet BNB). Use the **Agora Docs MCP** for x402 + AUSD package names and contract addresses. Don't guess. If you're stuck for more than 20 minutes, go to the Agora table and tell the team.
- [x] Checkout `POST /api/distributors/[id]/checkout`: no payment → HTTP 402 with requirements (AUSD on Base Sepolia, `amount = quote.totalPrice`, `payTo` = claimed distributor's `payoutWallet`, else `DEMO_DISTRIBUTOR_WALLET`). Quote validation (`quoteProblem`) is already in place.
- [x] `payOrder` in `src/lib/payments/real.ts`: request → 402 → sign ERC-3009 authorization → retry with payment → return the settlement `txHash`.
- [ ] (`logPurchaseOnChain` is implemented; the deploy still needs tBNB) Deploy `PurchaseLog` to BSC Testnet (`cd contracts && npm run deploy:bsc-testnet`), put the address in `.env.local` and share it, then implement `logPurchaseOnChain` (reasoning hash = keccak256(reasoning + transcriptHash)).
- [x] Real agent (`src/lib/agent/real.ts`) implementing PRD section 8 **exactly**. Fix the mock's known gaps (listed at the top of `mock.ts`): reorder rule, pure landed-cost pick, 14-day window, `baselinePrice` / `savingsPct` / `listTotal`.
- [x] Autonomy: approval mode → `proposed`; auto mode → `approved` + `autoPurchased: true` if `totalPrice ≤ perOrderLimit` and `spentLast7Days + totalPrice ≤ weeklyBudget`, else `proposed` with the reason.
- [x] (template only; no LLM rephrase yet) Reasoning: why this item, why now, why this distributor, why this quantity, savings vs baseline. LLM rephrase is optional (only if `LLM_API_KEY` is set). Never let the LLM change numbers.
- [x] Routes: `POST /api/orders/[id]/reject` (`rejectOrder` exists in `src/lib/orders.ts`), `GET/PUT /api/settings` (return `{ settings, spentLast7Days }`; store methods exist).

### P1
- [x] Signal-aware timing/quantity (section 8 step 6), citing the signal summary + `sourceUrl`.
- [x] Plug in `negotiateAll` (section 8 step 7) and compute each candidate's `walkAwayUnitPrice` (see PRD section 20).
- [x] (checkout returns `payoutRouting`; the UI label is Stanley's) Payout routing label: "unclaimed" orders pay `DEMO_DISTRIBUTOR_WALLET`.

## Done when
Approving an order produces a real Base Sepolia AUSD tx and a real BSC Testnet audit event (Checkpoint 2 at 2:30). Auto mode respects both limits. **Protect x402 above everything else.**
