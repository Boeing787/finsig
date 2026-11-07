# 8 November vertical slice

The local data path is: PayPal first-party sandbox Reporting → PostgreSQL raw records → deterministic event classification → confirmed activity → cash and per-hour calculations. This is a development build, not a hosted demo.

## Observed sandbox check

On 7 November, the first import fetched three records and inserted three. The second import fetched the same three and inserted zero. The records were a `T0006` sale of USD 5.00 with fee USD -0.66, a `T1107` refund of USD -1.00 referencing the sale, and a `T1900` account correction of USD 5000.00. The correction remained in review and did not enter commercial revenue.

The cash calculation was USD 5.00 − USD 1.00 − USD 0.66 = USD 3.34. After explicitly assigning the sale to `Sandbox test`, another import proposed the same activity for the linked refund. Both records were confirmed. With 2.00 hours and USD 0.50 known direct costs, the activity contribution was USD 2.84, net receipts per hour USD 1.67, and contribution per hour USD 1.42. These hours and costs are test inputs, not observations from PayPal.

## Boundaries

- The PayPal app credentials belong to the first-party sandbox merchant. Partner Referrals and delegated access are not implemented.
- Amounts are stored as signed integer cents for USD. Other currencies currently fail the importer until their minor-unit rules are added. They are never silently converted or combined.
- The cash summary counts only successful (`S`) `T0006` positive receipts and `T1107` negative refunds. Other T-codes remain in review. The list of commercial event codes must expand before general use.
- Activity suggestions are deterministic from an exact `activity:<name>` transaction subject or a refund that references a confirmed sale. The AI classifier and its evidence workflow are future work.
- The CLI has no user authentication and the local PostgreSQL contains source records that may include personal data. Do not deploy or share its database as a judge-facing service.
- The next vertical slice needs hosted authentication, an application UI, a proper merchant-connection model, and a broader import window with overlap and scheduling.

Reference: [PayPal transaction event codes](https://developer.paypal.com/reports/reference/t-codes/).
