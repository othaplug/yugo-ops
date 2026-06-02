import { Suspense } from "react";
import PreviewPresentationClient from "./PreviewPresentationClient";

/**
 * Internal preview page for the three quote presentation modes
 * (comparison / estate_featured / estate_only). Lets the coordinator
 * see how a quote will render to the client without actually
 * generating + sending one.
 *
 * URL: /admin/quotes/preview-presentation?mode=estate_only
 *
 * The page renders ResidentialLayout with mock Estate data so you can
 * compare the three modes side-by-side in the browser. Switching modes
 * is a one-click query-param change.
 *
 * No data persistence. No effect on real quotes. Internal admin tool.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Quote presentation preview" };

export default function PreviewPresentationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <PreviewPresentationClient />
    </Suspense>
  );
}
