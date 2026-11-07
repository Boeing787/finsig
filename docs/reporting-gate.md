# PayPal reporting gate

Date: 7 November 2026. Owner: project developer. Target: verify that FinSig can read its sandbox merchant account's historical transactions.

## 1. Scope of this gate

Enable Transaction Search in a Merchant sandbox REST app and run the first-party probe with that app's credentials. This verifies API shape, token scope, and reporting records for the account attached to the app.

The planned Partner Referrals experiment is out of scope for this hackathon. Ukraine is listed as send-only in PayPal's seller-onboarding availability table, and the Platform app flow does not offer Ukraine. FinSig's demo and Devpost copy must describe sandbox analytics for the merchant account, not a connection to an arbitrary PayPal account.

## 2. Operations and evidence

Create a personal buyer account and use the business account attached to the Merchant app. On that business account, create these transactions _outside FinSig_, and record their PayPal IDs privately:

| Case     | Sandbox operation                                | Verify in reporting                                             |
| -------- | ------------------------------------------------ | --------------------------------------------------------------- |
| Incoming | Buyer pays the merchant for a service            | Sign, currency, status, fee, event code, counterparty fields    |
| Outgoing | Merchant pays another sandbox account or invoice | Signed amount, fee, event code, counterparty fields             |
| Refund   | Merchant refunds part of the incoming capture    | Original and refund records, reference IDs, no duplicate income |

Allow up to three hours for new transactions to appear. A 200 response with zero items is not proof that the events do not exist. Record operation time, request time, `last_refreshed_datetime`, and the observed lag.

## 3. Run probe

Copy `.env.example` to `.env.local` and enter sandbox values locally. The file is ignored by Git. Never paste credentials into chat, GitHub, or a terminal command line. Node 22+ is required.

```bash
node --env-file=.env.local scripts/paypal-reporting-probe.mjs first-party
```

The probe outputs only ten abbreviated records and hashes transaction IDs. It does not store raw PayPal responses. For full field inspection, use a secure local scratch file outside the repository; remove payer email and names before adding examples to project docs.

Create a buyer-approval link for the incoming-payment case:

```bash
pnpm paypal:seed-order
```

Open the returned `approveUrl` in a browser, sign in with a sandbox **Personal** buyer, and approve the $5.00 payment. Then capture the approved order:

```bash
pnpm paypal:capture-order <order-id>
```

Create a $1.00 partial refund for a completed capture:

```bash
pnpm paypal:refund-capture <capture-id>
```

Repeat the first-party call after data propagation. Record a second response to establish stable pagination and deduplication keys.

For this sandbox dataset, compare two reads of the same fixed window and locate both known operations:

```bash
pnpm paypal:verify-reporting <capture-id> <refund-id>
```

The output contains hashes of transaction IDs and no buyer details. `repeatReadStable: true` means the composite key (transaction ID, event code, initiation time, currency and amount) is stable across two reads of the same refresh. The check returns `pending` until both operations appear. Transaction ID alone is not a globally unique reporting-record key.

## 4. Decision log

The 20:26 UTC probe returned both known operations after a reporting refresh at 18:29:59 UTC. The prior 19:47 UTC probe still returned only the older record, so the first observed availability was within 2 hours 24 minutes of capture. The refresh timestamp is not the same as the moment the records became queryable.

| Operation      | Event code | Status | Amount      | Fee          | Initiated (UTC) | Counterparty fields |
| -------------- | ---------- | ------ | ----------- | ------------ | --------------- | ------------------- |
| Capture        | `T0006`    | `S`    | `USD 5.00`  | `USD -0.66`  | 18:02:58        | Present             |
| Partial refund | `T1107`    | `S`    | `USD -1.00` | Not returned | 18:03:58        | Present             |

The refund is a separate negative record, so it must reduce revenue exactly once. The sandbox capture fee is an observed test value, not a production rate. Transaction IDs and buyer details are omitted from this document.

| Check                                          | Result     | Evidence                                                                                                                    | Decision                                                              |
| ---------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| First-party token includes reporting scope     | Yes, 7 Nov | Probe at 08:09 UTC returned `scopeGranted: true`                                                                            | Proceed to a known sandbox transaction                                |
| Sandbox capture and partial refund completed   | Yes, 7 Nov | $5.00 capture around 18:03 UTC and a $1.00 partial refund both returned `COMPLETED`                                         | Wait for both reporting records to propagate                          |
| First-party returns known operations           | Yes, 7 Nov | At 20:26 UTC the API returned the known capture and refund with amounts, fee, status and event codes                        | Reporting gate passed                                                 |
| Delegated merchant history                     | Blocked    | Platform onboarding does not offer Ukraine; Ukraine is send-only                                                            | Describe only first-party merchant analytics in the hackathon project |
| Repeated import can identify duplicate records | Yes, 7 Nov | Two fixed-window reads of all three records on the same refresh returned the same composite keys (`repeatReadStable: true`) | Use the composite key for idempotent import                           |

**Decision: Go for first-party sandbox merchant analytics.** Transaction Search returned the known payment and refund with the expected signed amounts, status and event codes. The capture fee was available; the refund record had no fee field. Delegated merchant onboarding and live availability remain separate product gates.

Sources: [Transaction Search](https://developer.paypal.com/api/transaction-search/v1/search-get), [third-party API calls](https://developer.paypal.com/api/make-api-requests), [seller onboarding](https://developer.paypal.com/platforms/seller-onboarding/before-payment), [PayPal sandbox and AG Grid workshop](https://developer.paypal.com/community/blog/PayPal_AG_Grid_Part_1/).
