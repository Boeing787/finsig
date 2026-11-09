# FinSig hosted vertical slice

FinSig is a judge-facing financial analytics demo for independent professionals. The public app is deployed at <https://finsig-demo.onrender.com/demo> and uses synthetic workspace data. It does not expose the local PayPal sandbox database.

## Judge path

1. **Overview:** inspect September to October change, the deterministic cash bridge and source-grounded AI explanation.
2. **Activities:** ask AI to suggest a category for the unassigned consulting receipt, inspect the evidence and confirm the assignment. The linked refund inherits the confirmed activity. Hours and known direct costs change contribution per hour.
3. **Manager:** inspect the deterministic 30-day scenario and cash trend alert.
4. **Sources:** inspect normalized synthetic records, including the `T1900` correction excluded from revenue. Reset clears the browser-local demo state.

## AI and deterministic boundaries

- Classification returns a record ID, activity ID, cited evidence fields and a follow-up question. The server validates the output against the fixed demo records and categories; the person confirms the assignment.
- Explanation returns claims linked to metric IDs and source record IDs. Server validation rejects unknown metrics, unrelated records and unverified amounts before claims are shown.
- The AI API accepts only two fixed tasks (`classify` and `explain`); it does not accept arbitrary prompts. The Anthropic key remains server-side.
- Deterministic code calculates the cash bridge, refunds, fees, contribution per hour and 30-day scenario. AI does not edit calculations or persist user choices.
- Demo changes are stored in browser local storage. The server API only returns fixed synthetic data and validated AI responses.

## PayPal sandbox verification

The separate local CLI imports first-party PayPal Transaction Search data into PostgreSQL. On 7 November, two imports produced three fetched rows each, with three inserted on the first and zero on the second. The USD 5.00 sale, USD 1.00 refund and USD 0.66 fee yielded USD 3.34 cash. The USD 5,000.00 account correction remained in review. See [reporting-gate.md](reporting-gate.md) for sanitized event evidence.

This is a first-party sandbox connection. Partner Referrals and delegated merchant access are not implemented; the current account-access limitation from Ukraine remains. The public demo uses synthetic data and does not read personal PayPal records.

## Limits

- The public workspace is a shared synthetic demonstration. Choices live in each browser's local storage, not in separate server-side user accounts.
- The importer currently calculates USD receipts for `T0006` and refunds for `T1107`; unknown event families remain in review. Non-USD records are not converted or combined.
- The 10-cycle production smoke check in [nov9-evidence.md](nov9-evidence.md) exercises HTTP routes and API schemas. It is not a substitute for a human interaction test of browser local storage, and this document does not claim that interaction test was automated.

References: [PayPal transaction event codes](https://developer.paypal.com/reports/reference/t-codes/).
