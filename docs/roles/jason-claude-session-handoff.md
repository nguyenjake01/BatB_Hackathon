# Handoff for the next Claude session (Jason, Person 2: Agent + Payments)

Written 2026-10-11, late in the hackathon. You are picking up from a previous Claude session that built Jason's part. The user is Jason. He is new to crypto, so explain wallet and network terms in plain words.

Read these first, in this order: `CLAUDE.md`, `docs/roles/jason-agent-payments.md`, `docs/roles/jason-handoff.md` (Jake's integration notes), then `docs/PRD.md` (source of truth; section 8 is the agent, section 20 the resolved conflicts).

## Where things stand

- **Repo:** `/Users/jasonyuan/Desktop/BatB_Hackathon-1`. Do not use `~/Desktop/BatB_Hackathon`; that is an old, empty clone.
- **Remote:** `https://github.com/nguyenjake01/BatB_Hackathon` (Jake's). Branches: `supply` (Jake), `agent` (Jason), `ui` (Stanley), PRs into `main`.
- **All of Jason's code is on `main`.** It got there through PR #2 (merged by Jake) and then Stanley's `ui` merge, which carried the follow-up fix.
- **Local `agent` branch equals `origin/main`** in content and is 7 commits ahead of `origin/agent`, unpushed. They are merge commits only. Pushing `agent` is safe but has not been asked for.
- **PR #4 is open and now redundant.** It was opened to fix a broken file on `main`; `main` has since received the same fix. It can be closed. The previous session was blocked by the permission system from merging a PR itself, so ask the user to click merge or close on GitHub.
- **`main` builds.** `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all passed on the current `main` content.
- **A dev server may still be running on port 3000** from the previous session. Check with `lsof -ti tcp:3000` before starting another.

## What was built

| Piece | File | State |
|---|---|---|
| x402 checkout | `src/app/api/distributors/[id]/checkout/route.ts` | Done. Proven with real payments. |
| Payment client | `src/lib/payments/real.ts` (`payOrder`) | Done. Proven with real payments. |
| Chain and token config | `src/lib/payments/chain.ts` | Reads AUSD decimals and signing domain from the chain. |
| x402 resource server | `src/lib/payments/x402.ts` | Uses the public facilitator `https://x402.org/facilitator`. |
| Audit log | `src/lib/payments/real.ts` (`logPurchaseOnChain`) | Written. Only ever run against a local chain. **Not run on BSC Testnet.** |
| Real agent | `src/lib/agent/real.ts` | Done. Tested on mock data and on Jake's real catalog snapshot. |
| Routes | `src/app/api/orders/[id]/reject/route.ts`, `src/app/api/settings/route.ts` | Done. Settings return both `spentLast7Days` and `spentThisWeek` (the UI reads the second). |
| Wallet helper | `scripts/agent-wallet.mjs` (`npm run wallet`) | Status, AUSD faucet, bridge. See below. |

Real payments made through the running app, on Base Sepolia:

- 159.98 AUSD at list price: `0x3736c2524b7acb93bdf74499386a6d5b9fd80ca15a9dff9ee43ff8028f8091e2`
- 164.72 AUSD at a negotiated price: `0xfb89a4180d7bb0965fe14910e114d38c2e743533be9d7505aea5b4498bd3bdd4`

Approving a paid order again returns 409, so nothing is paid twice.

## Open work, most important first

1. **Deploy `PurchaseLog` to BSC Testnet.** Blocked on tBNB: the agent wallet has 0. Every public faucet Jason tried refused because the address has no BNB on mainnet. The realistic sources are the YZi Labs sponsor table, a teammate, or BNB Chain's Telegram bot `@bnbchain_official_bot`. Once the wallet has tBNB:
   - `cd contracts && npm run deploy:bsc-testnet`
   - Put the printed address in `.env.local` as `PURCHASE_LOG_CONTRACT_ADDRESS` and share it with the team.
   - Approve an order and confirm `auditTxHash` is set and visible on `https://testnet.bscscan.com/tx/`.
   - Until then, orders are paid and carry the warning "Paid, but the on-chain audit log failed". That is expected.
2. **Items with no order give no explanation.** On the real catalog only butter and chocolate chips get orders. Flour, eggs, and yeast get none because no distributor beats the Walmart baseline, so every negotiation ends in `no_deal`. The agent only logs a `[agent] … no order was created` line on the server. Jake's handoff asks for the reason to be shown ("Walmart is cheaper this week; buy retail"). `AgentResult` has no field for skipped items, so this needs a small change across `src/lib/agent/index.ts`, `src/lib/orders.ts` (shared), the run route, and Stanley's UI. Raise it with the user before building; it touches shared files.
3. **Shared signing secret.** `.env.local` has a `NEGOTIATION_SIGNING_SECRET` the previous session generated. It must match Jake's and Stanley's, and Vercel's.
4. **Vercel env vars.** The deployment needs `AGENT_WALLET_PRIVATE_KEY`, `AUSD_CONTRACT_ADDRESS`, `DEMO_DISTRIBUTOR_WALLET`, `NEGOTIATION_SIGNING_SECRET`, `PURCHASE_LOG_CONTRACT_ADDRESS`, and the `USE_MOCKS*` flags. `payOrder` calls the app's own checkout over HTTP, using `APP_BASE_URL`, else `https://$VERCEL_URL`, else `http://localhost:3000`. Vercel deployment protection would block that call. This path is untested on Vercel.
5. **Optional, not built:** LLM rephrasing of the reasoning. The PRD marks it optional and the provider is undecided.

## Wallets and funds (testnet only)

- **Agent wallet:** `0x7cA0B87f475a5D935dB73e4849342076A0cb0b4E`. Its key is `AGENT_WALLET_PRIVATE_KEY` in `.env.local`. Never print it or paste it anywhere.
- **Demo distributor wallet:** `0xADeA996aFb9d4bCe55bdAd85B1eb9AB3F7Fe4d6D`. Unclaimed distributors are paid here. Its key is also in `.env.local`, unused by the app.
- **Balances at handoff:** Base Sepolia about 0.02 ETH and 9,675.30 AUSD. Ethereum Sepolia about 0.03 ETH and 10,000 AUSD, which the app cannot spend. BSC Testnet 0 tBNB.
- **AUSD on Base Sepolia:** `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC`, from Agora's contract deployments page.
- Jason also has a personal MetaMask account starting `0x1e6d9…`. It is not used by the project.

Wallet helper commands, run from the repo root:

- `npm run wallet` shows balances and what is still missing.
- `npm run wallet -- faucet` claims 10,000 test AUSD on Base Sepolia. `npm run wallet -- faucet sepolia` does it on Ethereum Sepolia.
- `npm run wallet -- bridge [amount]` moves test ETH from Ethereum Sepolia to Base Sepolia (default 0.02).

## Local environment

- Node 26 was installed with Homebrew during the previous session; the machine had no Node before.
- `.env.local` flags right now: `USE_MOCKS=true`, with `USE_MOCKS_SUPPLY=false`, `USE_MOCKS_AGENT=false`, `USE_MOCKS_PAYMENTS=false`. So supply uses Jake's committed catalog snapshot (no API key needed), the agent and payments are real, and Square and signals are mocked.
- `CONTEXT_DEV_API_KEY`, `SQUARE_ACCESS_TOKEN`, and `LLM_API_KEY` are empty on this machine. Live scraping, live signals, and real Square inventory have not been run here.
- The app's preview tool is bound to the old folder, so start the dev server with `npm run dev` in a background shell instead.

## Things that cost time, so you don't repeat them

- **AUSD's signing domain is not its token name.** `name()` returns "AUSD" but the EIP-712 domain is "Agora Dollar", version "1". The code reads it from `eip712Domain()`. Hard-coding "AUSD" makes every payment fail signature verification.
- **Misleading facilitator errors.** A revert with selector `0xe450d38c` means the paying wallet lacks AUSD. The x402 SDK can also report a "token name mismatch" in the same situation, because of the point above. The checkout translates the first case into a readable message.
- **The public facilitator only supports Base Sepolia on EVM testnets.** Ethereum Sepolia is not an option without running our own facilitator. The PRD names Base Sepolia throughout.
- **The agent wallet needs no ETH to pay.** The facilitator submits the transfer and pays gas. ETH was only needed to call the AUSD faucet.
- **"Sepolia" faucets pay out on Ethereum Sepolia, not Base Sepolia.** That is why the bridge command exists.
- **Quotes expire after 30 minutes.** Approving an old proposal fails with "quote expired"; run the agent again.
- **The in-memory store resets on restart.** Orders, settings, and paid history disappear when the dev server restarts.
- **GitHub's web conflict editor broke a file once.** It kept two `GET` handlers in `src/app/api/negotiations/route.ts`. If teammates resolve conflicts on GitHub again, check that file compiles.

## Decisions baked into the agent

These are judgment calls where the PRD was open. Change them only if the user or team asks.

- The retail baseline (Walmart on real data) is never bought. It is only the savings yardstick and the walk-away reference. Jake's handoff confirms this rule.
- Items without a requirement are skipped.
- The reorder rule (`onHand − usage × leadTime < minStock`) uses the lead time of the listing the agent would buy at list prices.
- Quantity is 14 days of usage, rounded up to whole packs, then capped by shelf life and budget.
- Out-of-stock listings are always skipped, claimed or not.
- Quality notes are matched by keyword. If no purchasable listing matches, the agent keeps all of them and warns in the reasoning.
- One negotiation per distributor, over that distributor's best listing. Without this, the real catalog produced four WebstaurantStore negotiations for butter.
- Auto mode follows the PRD rule exactly: within the per-order limit and the rolling weekly budget, counting orders auto-approved earlier in the same run.

## Team rules that still apply

- Shared files (`src/types/`, `src/lib/store.ts`, `src/lib/orders.ts`, `src/lib/quotes.ts`, `src/lib/config.ts`, and the small helpers) need a heads-up to the team before changes. Add to them; don't rename or remove.
- Stay out of `src/lib/supply/`, `src/lib/negotiation/`, `src/lib/square/`, and the UI unless the user says otherwise.
- Never hard-code prices, agent outputs, or transaction hashes in non-mock paths. Judges check.
- Before pushing: `npm run typecheck && npm run lint && npm run build`. Commit or push only when the user asks.
- The PRD sets a feature freeze at 3:00 on the hackathon clock. Ask the user where the clock is before starting anything new.
