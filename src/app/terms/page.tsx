import { redirect } from "next/navigation";
import { YUGO_TERMS_URL } from "@/lib/legal-links";

/**
 * The Terms & Conditions are published on the Yugo marketing site
 * (itsyugo.com/terms) — the single source of truth. This route previously
 * rendered an in-app, B2B-only copy ("Commercial Terms & Conditions"), which
 * did not match the full consumer+business terms on the site. Every surface now
 * links straight to the site, and any direct visit or old /terms link is
 * forwarded there too, so what a client reads always matches the published
 * terms.
 */
export default function TermsPage() {
  redirect(YUGO_TERMS_URL);
}
