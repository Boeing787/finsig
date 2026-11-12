# Demo video script (2:45)

One story in seven scenes: real PayPal evidence → AI classification → the income investigation in
AG Studio → the 30-day cash plan → the grounding boundary. Every amount below was checked on the
live site; if the screen shows anything else, stop and re-take from a fresh incognito window.

## Before recording

- **Fresh state.** Record in a new incognito window. Each one starts the demo from scratch, so a
  re-take is a new window. (In a normal window: Security → _Reset workspace choices_, and
  _Reset to investigation_ in the Studio editor.)
- **Browser language English (US).** AG Charts formats axis labels in the browser locale.
- **Window** 1440×900 or larger at 100 % zoom; hide bookmarks and extensions.
- **Cut every AI wait** in the edit: category suggestion (~5–10 s), answers (~10–15 s), the Studio
  agent (~40 s). Keep the moment the result appears.
- **Under 3:00**, uploaded to YouTube as **Public**.

## Script

| Time      | Screen and action                                                                                                                                                                                                                                                                            | Voice-over                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:15 | Landing page `finsig-demo.onrender.com`.                                                                                                                                                                                                                                                     | “Freelancers get paid through PayPal, but a transaction feed can’t tell them why income changed or what the next month looks like. FinSig answers both, and every amount it shows is calculated by code.”                                                                                                                                                                                                                                            |
| 0:15–0:38 | _Explore the live demo_ → let the sync screen run → **Transactions** → **Live sandbox** tab → open the **+$5.00** payment drawer.                                                                                                                                                            | “First, real PayPal data. Transaction Search reads our sandbox merchant: a payment, a refund and the PayPal fee, reconciled to the cent. The opening balance correction is held for review and never counted as income. The same pipeline normalises a fictional freelancer’s twelve-month history, which powers the analytics. The two are never mixed.”                                                                                            |
| 0:38–0:55 | **Dashboard** → _2 payments need a category_ → **Suggest with AI** on Atlas Works → hold on the quoted fields → **Confirm Consulting**.                                                                                                                                                      | “Claude suggests a category for an unlabelled payment and quotes the PayPal fields it used. Nothing changes until I confirm, and AI never touches an amount.”                                                                                                                                                                                                                                                                                        |
| 0:55–1:20 | **Income investigation**. Hold on the title. Click **Lumen Health** → the ledger narrows to one record → **Open record** → close the drawer.                                                                                                                                                 | “Why did October net income fall? This bridge is a custom AG Studio widget, and it adds up to the cent. The missing Lumen Health milestone is the biggest factor. Selecting it filters the evidence ledger to the exact PayPal record behind it.”                                                                                                                                                                                                    |
| 1:20–1:50 | **Customize analysis** → in _Ask FinSig_ click **Show the fee factor** → _(cut the wait)_ → scroll to **PayPal Fees by Client & Month** → **Reset to investigation** → **Back to investigation**.                                                                                            | “Customize analysis opens the AG Studio editor on the same investigation, in FinSig’s theme. Studio’s own agents run through our Claude adapter: I ask for the fee factor, and the page and widget agents add a chart built from the same records. Reset brings back the verified investigation.”                                                                                                                                                    |
| 1:50–2:30 | **AI Insights** → scroll to **Next 30 days**. Pinecone Labs (_Needs your OK_) → **Confirm**; the totals change. Open the **bell** → _Framewise annual plan renewal in 15 days_. Click **What should I expect over the next 30 days?** → _(cut the wait)_ → the answer with its metric chips. | “The AI manager’s thirty-day cash plan: invoices, payments pending in PayPal, subscriptions found in three or more monthly payments, and my own entries. A repeating client payment counts only after I confirm it, and one payment is never guessed into a renewal. A large upcoming expense raises an alert. Ask about the plan, and every claim cites metrics the code calculated. FinSig drops any claim, or comparison, the code can’t verify.” |
| 2:30–2:45 | Back to the investigation, then an end card: `finsig-demo.onrender.com` · `github.com/dmrvcodes/finsig`.                                                                                                                                                                                     | “Claude explains and proposes; code calculates and verifies. FinSig is read-only, and its live data today comes from our sandbox merchant. Next come statement import and server-side workspaces. FinSig: know what your work really earns.”                                                                                                                                                                                                         |

About 330 words of voice-over, which leaves room for the on-screen pauses.

## What the screen must show

| Scene             | Expected values                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live sandbox      | 3 records: +$5.00 payment (fee −$0.66, net +$4.34), −$1.00 refund, +$5,000.00 _In review_. Banner net $3.34.                                                                                      |
| Categories        | Atlas Works → _Consulting_ with Subject, Item and Counterparty quoted; the counter drops from 2 to 1.                                                                                             |
| Investigation     | September $8,828.21 → October $5,300.85, change −$3,527.36. Lumen Health −$2,500.00, Kestrel Analytics −$900.00, Refunds −$150.00, Atlas Works −$100.00, PayPal fees +$122.64. _Adds up exactly_. |
| Cash plan, before | Expected income $7,750.00 · fees −$272.44 · expenses −$292.00 · difference $7,185.56 · $3,850.00 waiting for confirmation.                                                                        |
| Cash plan, after  | Pinecone confirmed: income $8,400.00 · fees −$295.62 · difference $7,812.38 · $3,200.00 still waiting (overdue Lumen invoice).                                                                    |
| Bell              | Lumen Health invoice 7 days overdue · Framewise annual plan renewal in 15 days.                                                                                                                   |

## Do not say or show

- That FinSig connects any PayPal account. Live reads cover the sandbox merchant attached to the app;
  delegated onboarding is not available from Ukraine.
- That the sample analytics are live or real income.
- User interviews, accuracy, precision or recall figures: none were measured.
- SMS or e-mail alerts, or background monitoring: alerts are in-app.
- APIMatic, AWS hosting (the demo runs on Render) or anything not on screen.
