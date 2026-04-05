import { Metadata } from "next";
import TrackingLookup from "./TrackingLookup";
import { getLegalBranding } from "@/lib/legal-branding";

export const metadata: Metadata = {
  title: "Track Your Move or Delivery",
  description: "Enter your tracking number to see real-time status, live GPS location, and delivery details.",
  robots: "noindex, nofollow",
};

export default async function TrackingPage() {
  const { email: companyContactEmail } = await getLegalBranding();
  return <TrackingLookup companyContactEmail={companyContactEmail} />;
}
