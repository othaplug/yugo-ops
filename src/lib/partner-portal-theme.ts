import { applyDocumentLightTheme } from "@/lib/document-theme-tokens";

/**
 * Partner portal is light-mode only. Resets document tokens (including inline
 * vars left from admin dark mode) and strips `dark` class.
 */
export function applyPartnerPortalLightTheme(): void {
  if (typeof document === "undefined") return;
  applyDocumentLightTheme();
  try {
    localStorage.setItem("partner-theme", "light");
  } catch {
    /* ignore quota / private mode */
  }
}
