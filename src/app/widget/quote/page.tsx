import { notFound } from "next/navigation";

// Switched off 2026-10-20 (Oché): the public quote widget is retired; the new build has no public pricing route.
export default function RetiredQuoteWidget() {
  notFound();
}
