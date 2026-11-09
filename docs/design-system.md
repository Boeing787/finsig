# FinSig design system

FinSig uses a product-specific system rather than styling AG Studio and the application separately.
The source of truth is `packages/ui`.

## Direction

The system combines the quiet editorial tone of the Synais finance reference with the density of
the supplied dashboard references:

- warm neutral canvas and white raised surfaces;
- olive as the primary action and focus colour;
- muted violet only for AI surfaces;
- red and green reserved for financial direction and status;
- Manrope for display typography, DM Sans for body and data;
- 10/14/20/28 px radius scale and low-contrast borders instead of heavy shadows;
- tabular numbers, restrained gradients, and large whitespace around financial signals.

## Package boundary

`generic/` contains unopinionated controls: `Button`, `Badge`, `Input`, and `Select`.

`kit/` contains FinSig compositions: `Card`, `StatCard`, and `DataTable`. `DataTable` uses
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
