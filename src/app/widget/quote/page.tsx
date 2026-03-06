import QuoteWidgetClient from "@/app/quote-widget/QuoteWidgetClient";

export const metadata = {
  title: "Yugo+ | Get a Quote",
};

export default function WidgetQuotePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FAF7F2" }}>
      <QuoteWidgetClient />
    </div>
  );
}
