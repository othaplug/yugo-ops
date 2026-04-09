import { redirect } from "next/navigation";

/** Coverage map removed; partner hub remains under /partner. */
export default function PartnerCoverageRedirectPage() {
  redirect("/partner/today");
}
