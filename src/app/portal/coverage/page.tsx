import { redirect } from "next/navigation";

/** Alias route — partner app lives under `/partner`. */
export default function PortalCoverageRedirectPage() {
  redirect("/partner/today");
}
