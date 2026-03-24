import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yugo Bin Rentals — Eco-Friendly Moving Bins Delivered to Your Door",
  description:
    "Rent eco-friendly plastic bins for your move. Delivered 7 days before, picked up 5 days after. No cardboard waste. Free delivery in Toronto.",
};

export default function BinsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
