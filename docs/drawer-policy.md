# Drawer policy — Yugo+ admin (v1)

PR 6 introduces one policy for every overlay that uses
`@/components/ui/Modal` (`GlobalModal`). If you build a custom
`fixed inset-0` overlay outside of `GlobalModal`, you must meet these
requirements too.

## Rules

1. **One drawer at a time.** The admin shell never stacks overlays.
   Opening a second `GlobalModal` while another is open logs a dev-only
   warning; the top of the stack is the only one that receives ESC.
2. **ESC closes the topmost drawer.** `GlobalModal` binds a single
   capture-phase window listener and dispatches to the current top of
   the drawer stack. Individual modals no longer bind their own ESC
   listeners.
3. **Focus is trapped.** When a drawer opens, focus moves to the first
   focusable child. `Tab` / `Shift+Tab` wrap inside the drawer so
   keyboard users never land on the shell underneath.
4. **Backdrop click closes the drawer.** Clicking anywhere outside the
   content card calls `onClose`. Clicks inside the card are stopped
   via `stopPropagation` on the content wrapper.
5. **Body scroll is locked while the drawer is open.**
6. **No permanent drawer state in sessionStorage.** Drawers open and
   close as ephemeral UI; only pages decide whether to persist state.

## Stacking rules for exceptional cases

- **`ConfirmDialog` (z: 100000)** is allowed to open above a
  `GlobalModal` because it is a strict confirmation blocker. It has
  its own ESC listener and returns focus to the parent drawer on
  close.
- **Command palette** shares `z-[var(--z-modal)]` with `GlobalModal`.
  Do not open the command palette from inside a drawer; close the
  drawer first.

## Migration checklist

If you encounter an overlay that uses its own `fixed inset-0` layer:

- [ ] Replace with `GlobalModal` when possible.
- [ ] If the overlay must stay bespoke (e.g. the delivery map tracking
      panel), adopt the same five rules above manually: ESC, focus,
      backdrop close, body-scroll lock, stack awareness.
- [ ] Confirm the overlay does not open on top of an existing
      `GlobalModal` without explicit coordination.

See `/src/components/ui/Modal.tsx` for the reference implementation.
