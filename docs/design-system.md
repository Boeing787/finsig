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

## Logo

The logo is a blue swoosh and a lowercase "finsig" wordmark, traced to vector paths from the
supplied artwork. The paths live in `apps/web/src/features/auth/brandPaths.ts`.

- `Logo` renders the full lockup and `BrandMark` renders the swoosh alone (icon rail, mobile top
  bar). Colours come from `--fs-logo-mark` (`#0E13F1`) and `--fs-logo-ink` (`#040C30`).
  `Logo light` is all white for the brand gradient panels. The logo blue belongs to the logo only;
  UI accents keep `--fs-brand`.
- Static files for README, Devpost and slides: `public/brand/finsig-logo.svg`,
  `finsig-logo-white.svg` and `finsig-mark.svg`.
- Browser icons use the Next file conventions:
  - `app/icon.svg`, which switches to `#8D98FF` in dark mode;
  - `app/favicon.ico` at 16, 32 and 48px;
  - `app/apple-icon.png`, the mark on white at 180px.

## Charts

`packages/ui/src/charts` contains dependency-free SVG charts measured to their container:
`BarChart` (selectable months with a floating value pill), `AreaChart` (monotone cubic line with
gradient fill and hover readout), `Gauge`, `Donut`, `Sparkline` and a horizontal `Waterfall` that
floats each step from the running total so the bridge reconciles visually. The transactions ledger
uses AG Grid Community on the same tokens (see below); the income investigation runs on AG Studio.

## Package boundary

`generic/` contains unopinionated controls: `Button`, `Badge`, `Input`, and `Select`.

`kit/` contains FinSig compositions: `Card`, `StatCard`, and `DataTable`. `charts/` contains the SVG charts. `DataTable` uses
TanStack Table for application workflows and supports sorting, global filtering, persisted column
visibility, persisted widths, resizing, a sticky first column, and row actions. It is not used as a
substitute for AG Studio; AG Studio owns the income investigation and its editor.

All exported components use `fs-` prefixed classes. `styles.css` defines the public token contract;
applications import it once through `@finsig/ui/styles.css`.

## AG Grid ledger

AG Grid has one job: the transactions ledger (`src/features/workspace/Transactions.tsx`). The
dashboard stays card- and chart-led, and AG Studio stays the income investigation, so neither
grows a second table.

- **Theme.** `gridTheme` passes the `--fs-*` CSS variables straight into `themeQuartz.withParams`,
  so the grid has no palette of its own. The data area is transparent over the frosted card,
  headers sit on `--fs-surface-tint`, and hover, selection, focus and the sort icon use
  `--fs-brand`. Popups keep `--fs-surface-raised`.
- **Density.** 56px rows with two-line cells, 40px uppercase headers and 20 rows per page. The
  grid uses auto height, so the page scrolls rather than the grid. Narrow grids drop columns in a
  fixed order (fee, gross, source, activity, then date and status) instead of scrolling sideways.
  At phone width the date moves under the counterparty.
- **Cells.**
  - Status is a dot and a label: green for completed, indigo for pending, amber for in review.
    Money direction lives only in the amounts.
  - Net is the bold display figure: green for income, red for refunds, ink for costs and
    transfers. Pending and held amounts are faint, because FinSig does not count them.
  - Source shows the record type, the PayPal event code, and whether the record is sample or
    live sandbox data.
- **Row to evidence.** A row, or its labelled chevron button, opens the record drawer. The row
  stays selected and on screen, including for deep links from notifications, AI citations or
  Studio. The drawer reconciles gross, fee and net, names the PayPal source, links a refund to
  its original payment, and lists the FinSig totals that count the record. Previous/Next (or ↑/↓,
  j/k) step through the current filtered and sorted view. CSV export writes exactly that view.

## AG Studio mapping

`src/features/studio/theme.ts` passes the same `--fs-*` tokens into `studioTheme.withParams`:
widgets, panels, grid headers and rows, focus, typography and radius match the application shell.
The wrapper and canvas are transparent, so the investigation sits on the app background. The
custom bridge widget uses the package CSS variables rather than a second palette. Chart palettes
stay literal colours because AG Charts draws on a canvas. See `docs/ag-studio.md`.

## Rules

1. Money is formatted at the presentation boundary; domain logic stays in integer cents.
2. AI surfaces use violet, but verified or safe states use green. Colour must not imply that model
   output is verified.
3. Every interactive element has a text label or accessible name and visible focus state.
4. Reduced-motion preference disables decorative transitions.
5. New controls start in `generic`; domain-specific compositions belong in `kit` or the owning
   feature.
