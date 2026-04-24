# Empty states — Yugo+ admin (v1)

Three tiers. Pick the smallest one that works.

| Tier                 | Component                                    | When to use                                                            |
| -------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Missing field     | `components/primitives/EmptyField.tsx`       | A labeled value that is empty. Default: hide the row entirely.         |
| 2. Empty section     | `components/composites/EmptySection.tsx`     | A whole block (e.g. "Client sign-off") with no data yet.               |
| 3. Empty page/panel  | `components/composites/EmptyState.tsx`       | A page/panel that would otherwise render only chrome and no data.      |

Rule of thumb: **`—` and `N/A` never render**. If a value is missing,
collapse or hide the row; if the whole section is missing, collapse it to
one line with an action; if the whole page is empty, show a proper
`EmptyState` with a next step.

## EmptyField

```tsx
<EmptyField label="Building" value={move.building_name} />
<EmptyField
  label="Valuation"
  value={move.valuation}
  fallback="text"
  fallbackText="Not selected"
/>
```

- `fallback="hide"` (default): renders nothing when empty.
- `fallback="dash"`: renders `—` in tertiary color. Use only when the row
  grid MUST stay aligned (e.g. comparison tables).
- `fallback="text"`: renders `fallbackText` in tertiary color.

## EmptySection

```tsx
<EmptySection
  title="Client sign-off"
  description="Not collected yet"
  action={{ label: "Request sign-off", onClick: handleRequestSignoff }}
/>
```

One line. Title (t-heading), description (t-body secondary), optional action
button. Use inside a page to stand in for a full block with no data.

## EmptyState

```tsx
<EmptyState
  title="No quotes yet"
  description="Create your first quote to see it here."
  action={{ label: "Create quote", href: "/admin/quotes/new" }}
  secondaryAction={{ label: "View calendar", href: "/admin/calendar" }}
/>
```

Centered, 320px max width. Use for an entire empty page or empty tab body.

## Tokens used

All three components consume PR 1 tokens exclusively:
`--color-border`, `--color-surface`, `--color-surface-subtle`,
`--color-wine`, `--color-wine-hover`, `--color-wine-subtle`,
`--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`,
`--space-2/3/4/5/10`, `--radius-md`, and the `.t-heading` / `.t-body` /
`.t-label` utility classes.
