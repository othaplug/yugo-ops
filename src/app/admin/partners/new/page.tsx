import { redirect } from "next/navigation";

/** Legacy manual partner form retired; onboarding is `/admin/partners/onboard`. */
export const metadata = { title: "Partners" };

export default function LegacyNewPartnerRedirect() {
  redirect("/admin/partners/onboard");
}
