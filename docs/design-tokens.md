# Design Tokens — Yugo+ Admin (v1)

This document is the canonical reference for the admin design system tokens
introduced in PR 1. It is intentionally short: there are five type sizes, four
text color roles, one brand color, four surface roles, one set of semantic
status colors, and that's it.

> If you want a new token, discuss with the team first. **No new hex values,
> no new sizes, no new radii without a PR that updates this doc.**

## Files

- `src/styles/tokens.css` — CSS custom properties (colors, type scale atoms,
  spacing, radius, shadows, fonts). Light mode at `:root`, dark mode under
  `html[data-theme="dark"]`.
- `src/styles/typography.css` — the six typography utility classes
  (`.t-display`, `.t-heading`, `.t-body`, `.t-label`, `.t-annotation`,
  `.t-num`).
- `src/app/globals.css` — imports tokens and typography before
  `admin-tokens.css`.

## Why no `tailwind.config.ts`?

This project runs Tailwind v4 with CSS-native theme configuration (`@theme`
in CSS, not `theme.extend` in TS). To avoid colliding with the `@theme`
already registered for the admin-v2 shell (`src/styles/admin-tokens.css`),
PR 1 tokens are declared at plain `:root` rather than through `@theme`.
Consumers use:

- `.t-display` / `.t-heading` / `.t-body` / `.t-label` / `.t-annotation` /
  `.t-num` — typography utility classes for text treatments.
- `bg-[var(--color-wine)]`, `text-[var(--color-text-primary)]`,
  `border-[var(--color-border)]` — Tailwind arbitrary-value utilities for
  color and surface.

Later PRs may opt into `@theme` for a chosen subset if a named utility
(`bg-wine`, `text-primary`) becomes useful.

## Type scale (five sizes + one annotation + one numeric feature)

| Treatment    | Size / line-height | Weight | Tracking | Utility       | Intended use                                           |
| ------------ | ------------------ | ------ | -------- | ------------- | ------------------------------------------------------ |
| Display      | 28 / 36            | 600    | -0.01em  | `.t-display`  | Page titles only — "Quotes", "Sandra Warren", "Alpha"  |
| Heading      | 18 / 26            | 600    | 0        | `.t-heading`  | Section titles — "Profitability", "Client Inventory"   |
| Body         | 14 / 20            | 400    | 0        | `.t-body`     | Default reading text, table cells, field values        |
| Label        | 11 / 14            | 600    | 0.08em   | `.t-label`    | Column headers, section eyebrows, uppercase            |
| Annotation   | 12 / 16            | 500    | 0        | `.t-annotation` | Metadata, timestamps, actor lines                    |
| Numeric      | inherit            | –      | –        | `.t-num`      | Tabular figures for money, counts, aligned dates       |

Each treatment is composed from four atoms (`--font-size-*`,
`--line-height-*`, `--font-weight-*`, `--letter-spacing-*`) so a custom
component can assemble a variant without violating the scale.

## Font stacks

```css
--font-display: "Season Mix Display", "Instrument Serif", "Georgia", ...
--font-sans:    "Inter", -apple-system, ...
--font-mono-numeric: "Inter", ...  /* paired with tnum via .t-num */
```

`Season Mix Display` is listed first so it becomes the active display face
the moment it is loaded. Until then, `Instrument Serif` (already shipping)
is used.

## Colour roles

### Brand

| Token                  | Light     | Dark             | Use                                          |
| ---------------------- | --------- | ---------------- | -------------------------------------------- |
| `--color-wine`         | `#66143D` | `#66143D`        | Brand wordmark, primary CTAs, active tab underline, move status progress bar |
| `--color-wine-hover`   | `#4F0F2D` | `#4F0F2D`        | Hover state of the primary CTA only          |
| `--color-wine-subtle`  | `#FAF0F4` | `#2A0E1A`        | Active nav wash, selected row background — **never** a wine fill on an item |

### Surfaces

| Token                      | Light     | Dark      |
| -------------------------- | --------- | --------- |
| `--color-canvas`           | `#FAFAFA` | `#09090B` |
| `--color-surface`          | `#FFFFFF` | `#18181B` |
| `--color-surface-subtle`   | `#F7F7F7` | `#1F1F23` |
| `--color-surface-sunken`   | `#F1F1F2` | `#27272A` |

### Borders

| Token                    | Light     | Dark      |
| ------------------------ | --------- | --------- |
| `--color-border`         | `#EAEAEC` | `#27272A` |
| `--color-border-strong`  | `#D4D4D8` | `#3F3F46` |

### Text

| Token                    | Light     | Dark      | Role                                                 |
| ------------------------ | --------- | --------- | ---------------------------------------------------- |
| `--color-text-primary`   | `#0A0A0B` | `#FAFAFA` | Default copy, headings, money                        |
| `--color-text-secondary` | `#52525B` | `#A1A1AA` | Labels, chip text, supporting copy                   |
| `--color-text-tertiary`  | `#A1A1AA` | `#52525B` | Timestamps, placeholders, inactive nav, hint copy    |

### Semantic (chips only)

These appear only on status chips and change indicators. Never as decorative
background fills or borders.

| Token                  | Light     | Dark      |
| ---------------------- | --------- | --------- |
| `--color-success-fg`   | `#0F7A3F` | `#0F7A3F` |
| `--color-success-bg`   | `#DCFCE7` | `#0F2E1F` |
| `--color-warning-fg`   | `#92400E` | `#92400E` |
| `--color-warning-bg`   | `#FEF3C7` | `#3B2A0E` |
| `--color-danger-fg`    | `#B91C1C` | `#B91C1C` |
| `--color-danger-bg`    | `#FEE2E2` | `#3A1414` |
| `--color-info-fg`      | `#1E3A8A` | `#1E3A8A` |
| `--color-info-bg`      | `#DBEAFE` | `#1A2847` |
| `--color-neutral-fg`   | `#3F3F46` | `#3F3F46` |
| `--color-neutral-bg`   | `#F4F4F5` | `#27272A` |

### Money

| Token                     | Light     | Dark      |
| ------------------------- | --------- | --------- |
| `--color-money-positive`  | `#0F7A3F` | `#0F7A3F` |
| `--color-money-negative`  | `#B91C1C` | `#B91C1C` |

## Spacing (4 px base)

`--space-1` through `--space-16`: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px.

Cards use `--space-6` (24 px) desktop, `--space-4` (16 px) mobile. Section
stacks use `--space-5` (20 px) vertical gap. Form fields use `--space-4`
(16 px) vertical gap.

## Radius

`--radius-xs` (4) · `--radius-sm` (6) · `--radius-md` (8) · `--radius-lg` (12)
· `--radius-xl` (16) · `--radius-full` (9999).

Buttons: `--radius-md`. Cards: `--radius-lg`. Chips: `--radius-full`.

## Shadows

`--shadow-sm` (hairline lift on rows), `--shadow-md` (hover-lift cards,
dropdowns), `--shadow-lg` (modals, drawers).

## Enforcement rules

1. **Wine is for brand chrome and primary CTAs only.** Not for money, not
   for status, not decorative. Specifically allowed:
   - Sidebar brand wordmark block
   - Primary CTA background
   - Active tab underline (2 px)
   - Move status progress bar fill
   - Active nav item background (as `--color-wine-subtle` **wash**, not a
     wine fill)
2. **Money values use `--color-text-primary`, not wine.** Deltas use
   `--color-money-positive` / `--color-money-negative`.
3. **Labels use `--color-text-secondary`.** Section eyebrows and column
   headers are always secondary ink, never wine, never primary.
4. **Semantic colors only appear on chips and change indicators.** Never a
   decorative border, never a card fill.
5. **Type scale is fixed at five sizes.** If a design needs a sixth, it's a
   design question, not an implementation question. Discuss first.
6. **Do not introduce new hex literals.** Every color in a component must be
   expressed through a token: either a CSS custom property or a utility
   class backed by a token.

## Migration guide (for later PRs)

When refactoring a component onto the token system:

1. Replace raw hex (`"#66143D"`, `style={{ color: "#0A0A0B" }}`) with the
   matching token (`var(--color-wine)`, `var(--color-text-primary)`).
2. Replace raw `text-lg`, `text-sm`, inline `fontSize: 18`, etc. with one of
   the `.t-*` utility classes.
3. Replace `rgba(...)` tints with a token-based equivalent. If no token
   matches, that's a signal — discuss before introducing a new value.
4. For money, counts, and dates that render as digits, add `t-num` to the
   element.
5. When you finish migrating a file, remove it from
   `docs/hex-audit-baseline.md` to track progress toward zero.

## Relationship to existing token systems

The admin app currently ships three overlapping token systems:

- **`globals.css` legacy** — `--bg`, `--card`, `--tx`, `--gold`, `--yu-*`,
  drives `.admin-app` today. Remains untouched in PR 1.
- **`admin-tokens.css` (admin v2)** — `@theme { --color-canvas, --color-fg,
  --color-accent, ... }`, scoped to `[data-yugo-admin]`. Remains untouched
  in PR 1.
- **`tokens.css` (PR 1, this doc)** — new, additive, adopted incrementally
  by later PRs.

The three coexist. Tokens from PR 1 use distinct variable names so they do
not collide with v1 legacy or v2 shell. Where names do overlap (a few
surface shades like `--color-canvas`), PR 1 is imported **before**
`admin-tokens.css` in `globals.css` so admin-v2's values remain authoritative
at `:root`. Admin-v2 renders identically.
