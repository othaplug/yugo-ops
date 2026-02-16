# Styling colors & tokens

All app styling colors are defined in **`src/app/globals.css`** as CSS variables under `:root`.

## Background & surfaces

| Variable | Hex / value | Usage |
|----------|-------------|--------|
| `--bg` | `#0F0F0F` | Main page background |
| `--bg2` | `#1A1A1A` | Secondary background |
| `--card` | `#1E1E1E` | Cards, panels, modals |

## Borders

| Variable | Hex / value |
|----------|-------------|
| `--brd` | `#2A2A2A` |

## Text

| Variable | Hex / value | Usage |
|----------|-------------|--------|
| `--tx` | `#E8E5E0` | Primary text |
| `--tx2` | `#999` | Secondary / muted text |
| `--tx3` | `#666` | Tertiary / labels |

## Accent (gold / primary)

| Variable | Hex / value |
|----------|-------------|
| `--gold` | `#C9A962` |
| `--gold2` | `#B89A52` |
| `--gdim` | `rgba(201,169,98,.08)` |

## Semantic colors

| Variable | Hex / value | Dim variant |
|----------|-------------|-------------|
| Green | `--grn` `#2D9F5A` | `--grdim` |
| Orange | `--org` `#D48A29` | `--ordim` |
| Blue | `--blue` `#4A7CE5` | `--bldim` |
| Purple | `--pur` `#C9A962` | `--prdim` |
| Red | `--red` `#D14343` | `--rdim` |

## Fonts

| Variable | Stack |
|----------|--------|
| `--font-heading` | 'Instrument Sans', 'DM Sans', system-ui, sans-serif |
| `--font-hero` | 'Instrument Serif', Georgia, serif |
| `--font-body` | 'DM Sans', system-ui, sans-serif |

## Usage in components

- Backgrounds: `bg-[var(--bg)]`, `bg-[var(--card)]`
- Text: `text-[var(--tx)]`, `text-[var(--tx2)]`, `text-[var(--gold)]`
- Borders: `border-[var(--brd)]`
- Buttons / CTAs: `bg-[var(--gold)] text-[#0D0D0D]` (gold button text is dark)
- Badges / status: `bg-[var(--grdim)] text-[var(--grn)]`, etc.
