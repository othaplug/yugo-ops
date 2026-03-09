import QuoteWidgetClient from "./QuoteWidgetClient";

export const metadata = {
  title: "Yugo+ | Instant Quote",
  description: "Get a ballpark estimate for your move in under a minute.",
};

export default function QuoteWidgetPage() {
  return (
    <div className="min-h-screen flex items-start justify-center p-4 sm:p-6 sm:pt-10" style={{ background: "#FAF7F2" }}>
      <QuoteWidgetClient />
    </div>
  );
}
