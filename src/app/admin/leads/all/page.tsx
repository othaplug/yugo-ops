import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Canonical list URL is /admin/leads (this path kept for old bookmarks). */
export default function AllLeadsRedirect() {
  redirect("/admin/leads");
}
