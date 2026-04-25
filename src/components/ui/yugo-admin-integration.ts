/**
 * Yugo+ admin layout and `@/components/ui/*` building blocks
 *
 * Any route under `src/app/admin/**` is wrapped by `src/app/admin/layout.tsx`
 * with `AdminShellV3Wrapper` → `AdminShell` from `src/design-system/admin/layout`.
 * That shell sets `[data-yugo-admin-v3]` (and theme) on the app chrome, so
 * `var(--yu3-*)` tokens and v3 table/typography rules apply to children.
 *
 * **Import pattern (client or server that renders a client child):**
 *
 * ```tsx
 * import { LeadsTable } from "@/components/ui/leads-data-table"
 * import LoaderOne from "@/components/ui/loader-one"
 * import PillMorphTabs from "@/components/ui/pill-morph-tabs"
 * import { InteractiveLogsTable } from "@/components/ui/interactive-logs-table-shadcnui"
 * import { ContactsTable } from "@/components/ui/contacts-table-with-modal"
 * import { Tabs as VercelTabs } from "@/components/ui/vercel-tabs"
 * // table primitives: `@/components/ui/animated-table-rows`
 * ```
 *
 * Keep feature pages in `src/app/admin/.../page.tsx` (or segment layouts) so
 * they stay inside the normal admin shell. No extra provider is required.
 *
 * **Portals / dialogs:** If a component portals to `document.body`, use a
 * frame that sets `data-yugo-admin-v3` (see `ModalDialogFrame`, `ConfirmDialog`)
 * or the dialog content will not resolve `--yu3-*` the same way.
 */
export {}
