# AG Studio implementation

**Income investigation** (`/app/studio`; the old `/demo/studio` URL redirects there) answers one
question a freelancer actually has: _why did my net income change this month?_ AG Studio is the
engine behind the page, not a BI builder shown to the user.

## What the user sees

1. **The question.** For example, "Why did October net income fall by $3,527.36?". It follows the
   month picked in the top bar. The amounts come from FinSig's domain code.
2. **Verified bridge**, a custom AG Studio widget. It's a waterfall from last month's net to this
   month's: one floating bar per factor, then the verified net change and "Adds up exactly". The
   factors are client payment changes, refunds, and PayPal fees last.
3. **Evidence ledger**, a built-in AG Studio grid widget. By default it shows the PayPal records
   whose amounts changed (6 for October). Selecting a factor narrows it to that factor's records,
   and each row's _Open record_ link opens the record's source drawer in Transactions.
4. **Ask FinSig to investigate.** This calls the grounded `/api/demo/ai` endpoint. Claude may only
   cite verified metrics and their records, and code renders every number. Each claim links to the
   factor it cites, and the first cited factor is selected automatically.

The Filters panel, cross-filter chips, edit mode and agent panel stay hidden until **Customize
analysis**.

## How it is built

- The two widgets live in one AG Studio report (`report.ts`). Its authored layout is stacked, which
  suits the editor. In view mode a responsive breakpoint places them side by side on canvases 900px
  and wider.
- **Factor → evidence** uses AG Studio's `drillThrough` filter on `record_id`. The page and the
  bridge widget share a small evidence store, because Studio reads `context` only once. The
  drill-through is not saved with the report, so a customized report stays valid for every month.
- The grid widget has `triggerCrossFilter: false`, so clicking a row cannot filter the rest of the
  report down to that one row.
- `panels.view.right: []` removes the Filters panel from view mode. In edit mode the agent panel
  ("Ask FinSig") opens and Compose, Data and Filters start collapsed. Studio builds edit panels
  lazily, so the page re-applies their saved state when the editor opens.
- The theme (`theme.ts`) maps the FinSig `--fs-*` tokens, like the Transactions grid. The wrapper,
  canvas and shadows are transparent, so the investigation sits on the app background.

## What judges can exercise

- select bridge factors and watch the evidence ledger follow;
- ask FinSig to investigate, then click a claim's factor chip;
- **Customize analysis**: the full AG Studio editor with the custom bridge in the widget menu,
  the investigation's drill-through visible (and switchable) in Filters, and the lead agent;
- ask the agent to _compare clients by month_ or _pivot the evidence_. It delegates to Studio's page
  and widget agents and adds the widget inside the same investigation;
- _Reset to investigation_ restores the authored report.

Customizations persist per browser (`finsig:studio:investigation:v1`).

## Grounding boundary

PayPal-style source records are held in cents. `domain/analytics.ts` creates a checked numeric
projection after confirming each value fits JavaScript's safe integer range. Tests prove:

- September 2026 net = $8,828.21 and October 2026 net = $5,300.85;
- the bridge factors sum to exactly −$3,527.36;
- each factor equals the change in its own records' amounts (or fees, for the fee factor), so the
  evidence ledger adds up to the bridge.

The bridge widget receives those verified factors through application context and accepts no
model-generated amount. The agent can inspect, configure, filter and arrange the report; it cannot
change the calculation.

## Agent Framework adapter

`src/features/studio/adapter.ts` implements `AgLlmAdapter`. The browser sends the protocol-neutral
conversation and declared tool schemas to `/api/demo/studio-ai`. The server translates AG Studio
messages and tool calls to Anthropic Messages API blocks, keeps the Anthropic key server-side, and
normalizes text and tool responses back to AG Studio events.

The proxy has:

- a strict request schema and a 500 KB body limit;
- a per-instance hourly limit and a provider timeout;
- safe error messages, and it never returns the provider key.

## Known limitation

AG Charts formats axis ticks in the viewer's browser locale; a Russian browser shows "2,5 тыс.".
This affects only charts added in Customize analysis; the default investigation has no AG chart.

## License and deployment

Set `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` in Render before the build. It is applied through
`AgStudioLicenseManager`, and no private API credential is bundled. `ANTHROPIC_API_KEY` stays a
server-only Render secret.
