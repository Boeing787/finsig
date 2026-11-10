# FinSig design system

FinSig uses a product-specific system rather than styling AG Studio and the application separately.
The source of truth is `packages/ui`.

## Direction

The system follows the supplied fintech dashboard references: a soft periwinkle canvas, frosted
glass cards and dense, chart-led widgets.

- cool lavender-blue canvas with radial light, frosted white cards (`backdrop-filter`);
- indigo gradient (`--fs-gradient-brand`) for the selected bar, the primary balance bubble and
  trend cards; near-black pill buttons for primary actions;
- violet only for AI surfaces (`--fs-gradient-ai`), so colour never implies model output is verified;
- green and red reserved for financial direction and status;
- Manrope for display figures, DM Sans for body and data, tabular numbers everywhere;
- 12/16/24/32 px radius scale, pill controls, soft layered shadows.

## Charts

`packages/ui/src/charts` contains dependency-free SVG charts measured to their container:
`BarChart` (selectable months with a floating value pill), `AreaChart` (monotone cubic line with
gradient fill and hover readout), `Gauge`, `Donut`, `Sparkline` and a horizontal `Waterfall` that
floats each step from the running total so the bridge reconciles visually. The transactions ledger
uses AG Grid Community with the same tokens; the report builder uses AG Studio.

## Package boundary

`generic/` contains unopinionated controls: `Button`, `Badge`, `Input`, and `Select`.

`kit/` contains FinSig compositions: `Card`, `StatCard`, and `DataTable`. `charts/` contains the SVG charts. `DataTable` uses
TanStack Table for application workflows and supports sorting, global filtering, persisted column
visibility, persisted widths, resizing, a sticky first column, and row actions. It is not used as a
substitute for AG Studio; AG Studio owns the interactive report-building surface.

All exported components use `fs-` prefixed classes. `styles.css` defines the public token contract;
applications import it once through `@finsig/ui/styles.css`.

## AG Studio mapping

`src/features/studio/theme.ts` maps the same tokens into `studioTheme.withParams`: canvas, widgets,
panels, grid headers and rows, charts, focus, typography and radius all match the application shell.
The custom bridge widget deliberately uses the package CSS variables rather than a second palette.

## Rules

1. Money is formatted at the presentation boundary; domain logic stays in integer cents.
2. AI surfaces use violet, but verified or safe states use green. Colour must not imply that model
   output is verified.
3. Every interactive element has a text label or accessible name and visible focus state.
4. Reduced-motion preference disables decorative transitions.
5. New controls start in `generic`; domain-specific compositions belong in `kit` or the owning
   feature.
