# AG Studio implementation

The report builder is `/app/studio`, inside the signed-in workspace (the old `/demo/studio` URL
redirects there). It demonstrates AG Studio as a product capability, not a decorative chart
dependency. The ledger declares explicit field formats so amounts render in USD and dates are
locale-independent for every viewer.

## What judges can exercise

- switch between view and edit mode;
- resize and reconfigure the authored report;
- cross-filter the source ledger from the activity chart;
- change visible AG Grid columns, sorting, and filters;
- add built-in widgets and the custom **FinSig net change bridge**;
- ask the built-in lead agent to explain the decline or construct an evidence view;
- follow the custom source-link cell renderer back to the corresponding FinSig record;
- reset the report after any edit or AI action.

The authored report is persisted per browser. The reset operation uses `api.setState`, clears Studio
history, and restores the immutable initial report.

## Grounding boundary

PayPal-style source records are held in cents. `domain/analytics.ts` creates a checked numeric
projection only after confirming each value fits JavaScript's safe integer range. Golden tests prove:

- September net = $4,600;
- October net = $3,400;
- gross, refund, and fee factors sum to exactly −$1,200.

The custom bridge receives those verified factors through application context. It does not accept a
model-generated amount. The AG Studio agent can inspect, configure, filter, and arrange the report;
it cannot change the underlying calculation.

## Agent Framework adapter

`src/features/studio/adapter.ts` implements `AgLlmAdapter`. The browser sends the protocol-neutral
conversation and declared tool schemas to `/api/demo/studio-ai`. The server translates AG Studio
messages and tool calls to Anthropic Messages API blocks, keeps the Anthropic key server-side, and
normalizes text/tool responses back to AG Studio events.

The proxy has a strict request schema, 500 KB body limit, per-instance hourly limit, provider
timeout, safe error messages, and never returns the provider key. A smoke test must verify both a
plain assistant response and an enforced tool call before release.

## License and deployment

Set `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` in Render before the build. The value is applied through
`AgStudioLicenseManager`; no private API credential is bundled. `ANTHROPIC_API_KEY` remains a
server-only Render secret.
