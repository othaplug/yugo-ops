import { redirect } from "next/navigation";

/** Pricing map removed; use Command Center and Jobs. */
export default function AdminPricingMapRedirectPage() {
  redirect("/admin");
}
