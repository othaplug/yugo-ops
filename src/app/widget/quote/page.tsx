import QuoteWidgetClient from "@/app/quote-widget/QuoteWidgetClient";

export const metadata = {
  title: "Yugo+ | Get a Quote",
};

export default function WidgetQuotePage() {
  return (
    <div className="min-h-screen flex items-start justify-center p-4 sm:p-6 sm:pt-10" style={{ background: "#FAF7F2" }}>
      <QuoteWidgetClient />
    </div>
  );
}
