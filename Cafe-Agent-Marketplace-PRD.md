# Café Agent Marketplace — Product Requirements Document

Version 1.2 · October 11, 2026 · Three-hour functional MVP

## 1. Product and release goal

A café owner describes a purchase. An AI purchasing agent turns the request into structured requirements, requests quotes from three supplier services, and explains the best qualifying offer. The owner approves the exact order, completes a test/demo payment, and receives a saved receipt.

**Core flow:** describe purchase → receive three quotes → compare → approve → test payment → saved receipt.

Build this functioning flow before presentation polish. Requests, calculations, and order records must be real application behavior, not canned transcripts or a hardcoded winning supplier. Fictional suppliers are test data. Physical procurement and fulfillment are not claimed.

The product hypothesis is that automating specification matching and supplier comparison reduces purchasing effort. This MVP tests the workflow; it does not establish marketplace demand.

## 2. Scope locked for three hours

| Keep | Cut or defer |
| --- | --- |
| One café, fixed delivery destination, cups and matching lids | General packaging and other product categories |
| Three seeded suppliers with separate catalog/rule data | Supplier signup, editable dashboard, real supplier integrations |
| AI request extraction and short recommendation explanation | Separate supplier LLM conversations and multi-agent frameworks |
| Rule-based quotes, automatic volume discounts, eligibility checks | Haggling, counteroffers, bundles, split orders |
| One preselected product-page integration through Context.dev | Discovery, crawling, continuous monitoring |
| Exact owner approval, persistent orders, duplicate-payment protection | Autonomous spending and recurring orders |
| One selected payment mode | Multiple payment implementations, chains, mock-token deployment |
| Stock recheck and one active checkout at a time | Concurrent buyers and a full inventory reservation lifecycle |
| Simple receipt and status display | Rich event timeline, animations, presentation polish |

Assumptions: existing AI credentials and familiar application stack; no login, platform fees, real shipping, fiat conversion, or production tax calculation. Run as a local/private single-café prototype. A public commercial release requires authentication and further transaction/inventory controls.

## 3. Agent design: quotes, not haggling

**Buyer agent:** one LLM-backed component parses the request into a validated schema and explains the computed recommendation. It cannot change budget, deadline, specifications, or price. If parsing is incomplete, highlight missing fields in an editable form rather than building a conversational clarification system.

**Supplier agents/services:** three logical supplier endpoints or function instances receive the same structured request, read their own catalog and policy, and return a valid quote or rejection reasons. They are deterministic services in this version, not autonomous LLM negotiators. No separate deployments are necessary.

**Application code:** calculates discounts and totals, checks stock and compatibility, ranks offers, controls approval, and records payment state. The LLM never calculates authoritative prices or signs transfers.

An automatic volume discount is a useful offer. Free-form bargaining is outside scope. Apply eligible discounts immediately; do not withhold them to simulate negotiation. The buyer receives quotes, not private supplier pricing policies.

## 4. User journey

1. Owner enters: “I need 2,000 16-ounce cold cups and 2,000 matching lids by Friday, delivered for under $250.”
2. AI extracts quantities, capacity, product type, deadline, and budget; the fixed café profile supplies the destination. Show the resolved date and café timezone. Owner can correct the fields.
3. Owner requests quotes. Three supplier services calculate offers from their own fixtures, applying minimum order, pack size, stock, cup/lid pairing, delivery, and discount rules.
4. Code excludes invalid offers, then ranks qualifying offers by delivered total, earlier arrival, and stable supplier ID. “Under $250” is treated as strictly below $250; “up to $250” allows $250.
5. Owner sees all offers, exclusion reasons, itemized totals, discounts, and a short recommendation explanation. No qualifying offer means no checkout; let the owner edit the request.
6. Owner selects a qualifying quote and sees the exact order, recipient, total, and payment-mode label.
7. “Approve order and pay” triggers server-side quote/stock revalidation, persists the approved order, and initiates at most one effective payment.
8. A saved receipt displays supplier, items, amount, payment mode, and status. Refreshing it never creates a new payment. Fulfillment is labeled “Not connected.”

## 5. Test fixtures

All names, stock, prices, arrival promises, and tax below are fictional. The reference request is for 2,000 cups and 2,000 lids, due Friday in the café timezone.

| Supplier | Undiscounted total | Final total | Constraint | Expected result |
| --- | ---: | ---: | --- | --- |
| BudgetPack | $210 | $210 | Arrives Saturday | Excluded: late |
| QuickCup | $220 | $220 | Lid pairing ID differs from cup pairing ID | Excluded: incompatible |
| CaféDirect | $245 | $235 | Correct pair, sufficient stock, arrives Thursday | Recommended |

For CaféDirect: cups $140 + lids $70 − $10 quantity discount + $20 delivery + $15 fixture tax = $235. Configure the discount to activate at 2,000 cups and 2,000 lids and respect a $200 merchandise floor. Store unit prices, pack sizes, minimum quantities, and stock; calculate totals from these inputs rather than returning the table as a fixed response.

Display “$10 volume discount applied,” not negotiated savings. Delivery dates must be generated consistently with the selected reference date. Changing quantities, budget, deadline, or fixture stock must affect eligibility/calculation. The delivery budget includes fixture tax and shipping; any network fee is separately disclosed before approval.

## 6. Functional requirements

| ID | Requirement | Done when |
| --- | --- | --- |
| F1 | Parse and edit request | AI produces schema-valid fields; invalid or missing fields block quoting until corrected. |
| F2 | Get three quotes | Each service computes from its assigned catalog and returns an offer or explicit rejection reasons. |
| F3 | Validate and rank | Stock, pairing, quantity/pack rules, deadline, and budget are enforced in code; cheapest qualifying offer wins. |
| F4 | Show comparison | All suppliers have a visible outcome; qualifying quotes show charges and automatic discounts. |
| F5 | Bind approval | Approved snapshot includes SKUs, quantities, destination, quote version/expiry, total, recipient, and payment configuration. Changed terms require new approval. |
| F6 | Create one order/payment | Server rechecks price and stock; repeated submissions for the same checkout return the existing order/payment status. |
| F7 | Persist receipt | Orders and payment attempts survive refresh and server restart through a persistent local database. |
| F8 | Integrate Context.dev | One genuine page fetch supplies descriptive product evidence with URL and retrieval time; failure/cache status is clear. |
| F9 | Run chosen payment mode | The single selected adapter reports accurate pending/success/failure status and never labels simulated payment as an actual AUSD transfer. |

A basic order/payment event record is sufficient for troubleshooting. An elaborate audit timeline is not required.

## 7. Context.dev integration

Context.dev provides web data, including scraping; it is not the agent runtime [1]. Select one relevant public product URL during setup and fetch it server-side. Extract descriptive attributes such as product type, capacity, and material. Show the source URL and retrieval timestamp as a small details section.

Seeded supplier data remains authoritative for price, stock, delivery, transactional SKUs, and compatibility. External content cannot overwrite those fields. Source websites are not participating suppliers. Treat fetched text as untrusted data, never as instructions.

Use one allowlisted URL and no discovery/crawling. If unavailable, show “Product enrichment unavailable” or a genuinely cached snapshot labeled as cached. Continue the procurement flow with labeled fixture data. A fallback preserves application usability but does not count as a successful live integration.

## 8. Payment: choose one implementation

Agora documents AUSD token transfers [2]. A particular testnet, faucet, or sponsor setup has not been established for this project.

**Decision gate in the first 20 minutes:** verify whether a documented AUSD test environment, supported token address, funded test wallet, and usable transfer path are already available. If yes, implement that single test-payment adapter. If not, implement only a simulated AUSD-denominated ledger for this build. Do not spend the three hours deploying a mock token or supporting multiple modes.

| Selected implementation | Required label | Completion evidence |
| --- | --- | --- |
| Verified AUSD test transfer, if setup is ready | “AUSD test payment” | Genuine transaction reference plus verified transfer receipt |
| Otherwise, simulated ledger | “Simulated AUSD payment — no funds moved” | Persistent local payment record; no fabricated hash or explorer link |

Only one row is implemented. A simulated flow does not constitute an actual Agora integration and may not satisfy sponsor judging requirements. Document that limitation if selected. There is no real-money flow in scope.

For either implementation: record owner approval before initiating payment, bind amount and recipient to the approved order, use a stable checkout identifier and unique payment-attempt constraint, and reject duplicate submissions. Store money as integer cents; for token transfers use integer base units with verified decimals. Demo denomination assumes 1 AUSD per quoted USD; it is not a live exchange-rate statement.

If network mode is selected, verify chain, contract, recipient, amount, token transfer event, and confirmation policy. Keep signing outside the LLM. Persist an attempt before submission and the transaction reference as soon as available. If a crash or timeout leaves broadcast status uncertain, mark it unknown and require reconciliation; never automatically send again. Pending/unknown is not paid. Wallet rejection or confirmed failure is not success.

## 9. Minimal stock and order handling

Do not implement a reservation service. This prototype permits only one active checkout globally. Store that gate in the database so a process restart does not clear it. Before initiating payment, acquire the gate and recheck fixture stock and approved commercial terms. No other checkout or stock edit proceeds while payment is pending or unknown.

On confirmed success, atomically deduct stock once, mark the order paid, and release the gate. On definitive failure, mark the order failed and release the gate without deducting stock. Unknown status retains the gate until resolved. Repeated success processing is harmless because the order records whether stock was committed.

This intentionally serializes test purchases and is unsuitable for concurrent commercial buyers. It provides a small, correct checkout path without reservation expirations, allocation queues, or distributed inventory management.

## 10. UI, data, and architecture

Use a single page with three stages: request form, quote comparison, and approval/receipt. Show a fixture-data badge and the chosen payment label. Use simple progress text instead of a simulated agent chat.

Use the team's familiar frontend/backend stack, one server process, and a persistent local SQLite database. Avoid new hosting or infrastructure work before the flow passes. Server-only credentials stay outside client code and model prompts.

| Data | Minimum fields |
| --- | --- |
| Supplier/catalog fixture | Supplier ID, recipient, SKUs, attributes/pairing ID, pack/minimum rules, stock, unit prices, discount/delivery rules |
| Request/quote | Validated requirements, supplier, line items, charges, total, arrival, exclusions, version/expiry |
| Order | Checkout ID, approved quote snapshot, approval time, state, stock-committed flag |
| Payment attempt | Unique attempt ID, order, amount, recipient, chosen mode, status, transaction reference when applicable |
| Product evidence | Source URL, fetched time, attributes, live/cached state |

Minimum backend operations: parse request, get quotes, approve/pay, and get order status. Supplier services can be ordinary functions behind the quote operation. Model output is validated; all transaction decisions are rechecked server-side.

## 11. Three-hour implementation plan

| Time | Deliverable |
| --- | --- |
| 0:00–0:20 | Check AI/Context.dev credentials and AUSD test setup. Choose one payment mode. Seed suppliers and define request/quote schemas. |
| 0:20–1:05 | Implement deterministic quote calculation, eligibility, and ranking; add AI extraction with editable fields. |
| 1:05–1:50 | Build request/comparison/approval UI, persisted orders, receipt shell, and checkout idempotency. Make the full flow work locally with a development stub. |
| 1:50–2:30 | Connect the one Context.dev fetch and replace the development payment stub with the selected adapter; finish saved receipt/status behavior. |
| 2:30–3:00 | Verify happy path, changed inputs, payment failures, repeated submission, refresh/restart, and setup instructions. Fix defects before presentation work. |

The development stub is temporary scaffolding, not a second shipped payment mode. Use one buyer model; supplier services require no model calls. If time runs short, use a deterministic recommendation explanation and omit cosmetic polish. Never cut approval, quote validation, accurate payment labeling, or duplicate protection.

This schedule is an aggressive target assuming familiar tools and available credentials. Unavailable integrations must be reported accurately; do not claim they work to meet the deadline.

## 12. Release acceptance checklist

1. Reference fixture selects CaféDirect at $235 and explains why the other offers fail.
2. Changing budget, quantities, deadline, or stock changes the computed result. No qualifying offer disables checkout and gives reasons.
3. No payment occurs before owner approval; expired quotes or changed terms require a new quote and approval.
4. Double-clicking approval, repeating the request, or refreshing produces one effective payment and one stock deduction.
5. A definitive payment failure leaves stock unchanged. Pending/unknown payment stays visibly unresolved and blocks another checkout.
6. Refreshing/restarting preserves order and payment status; no restart triggers an automatic transfer.
7. Context.dev provenance is genuine and failure/cache status is visible. Seed data is clearly labeled.
8. The receipt accurately identifies simulated payment or verified AUSD test payment and never claims physical fulfillment.

Success means a usable, persisted end-to-end purchase flow with these checks passing. Aim for three quote results within 30 seconds under normal development conditions, excluding payment-network confirmation. This is a target, not a measured claim.

## 13. After the three-hour MVP

Only after the flow works: polish the walkthrough and visual design. Later product work includes supplier onboarding, actual inventory/order integrations, authentication, concurrent purchasing/reservations, and a verified commercial settlement setup. Keep supplier LLMs optional until a concrete task requires them.

Validate the business with café owners and suppliers: which restocking steps consume time, whether suppliers will authorize automated quotes/orders, and whether AUSD fits their payment needs. The initial release demonstrates functioning procurement software with test suppliers, not an operating commercial marketplace.

## 14. Integration references

Official documentation checked October 11, 2026. These sources support integration capabilities; all other behavior above is proposed product design.

1. Context.dev: [Product capabilities](https://www.context.dev/) and [agent quickstart](https://docs.context.dev/agent-quickstart).
2. Agora: [Contract overview](https://docs.agora.finance/contract-overview) and [developer introduction](https://docs.agora.finance/developer). Verify chain-specific and sponsor test configuration before implementing payment.
