import { Metadata } from "next";
import TrackingLookup from "./TrackingLookup";

export const metadata: Metadata = {
  title: "Track Your Move or Delivery — YUGO",
  description: "Enter your tracking number to see real-time status, live GPS location, and delivery details.",
  robots: "noindex, nofollow",
};

export default function TrackingPage() {
  return <TrackingLookup />;
}
