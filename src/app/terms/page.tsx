import Link from "next/link";

export const metadata = {
  title: "Terms of Use | Yugo",
  description: "Yugo terms of use",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] font-sans">
      <header className="sticky top-0 z-50 bg-white border-b border-[#E7E5E4]">
        <div className="max-w-[720px] mx-auto px-4 py-4">
          <Link href="/" className="font-hero text-lg tracking-[2px] text-[#C9A962] hover:underline">
            Yugo
          </Link>
        </div>
      </header>
      <main className="max-w-[720px] mx-auto px-4 py-8">
        <h1 className="text-[24px] font-bold text-[#1A1A1A] mb-6">Terms of Use</h1>
        <p className="text-[14px] text-[#666] leading-relaxed mb-4">
          By using Yugo&apos;s services, you agree to these terms. Please read them carefully.
        </p>
        <p className="text-[14px] text-[#666] leading-relaxed">
          For questions, contact us at{" "}
          <a href="mailto:hello@yugo.com" className="text-[#C9A962] hover:underline">
            hello@yugo.com
          </a>
          .
        </p>
        <Link href="/" className="inline-block mt-8 text-[14px] font-semibold text-[#C9A962] hover:underline">
          ← Back
        </Link>
      </main>
    </div>
  );
}
