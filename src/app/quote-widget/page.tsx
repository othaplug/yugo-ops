import QuoteWidgetClient from "./QuoteWidgetClient";

export const metadata = {
  title: "Yugo+ | Instant Quote",
  description: "Get a ballpark estimate for your move in 30 seconds.",
};

export default function QuoteWidgetPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FAF7F2" }}>
      <QuoteWidgetClient />
    </div>
  );
}
