"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TermsPage() {
  const router = useRouter();

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
        <p className="text-[14px] text-[#666] leading-relaxed mb-6">
          <strong>Last updated:</strong> February 2025
        </p>
        <p className="text-[14px] text-[#666] leading-relaxed mb-6">
          These Terms of Use (&quot;Terms&quot;) govern your access to and use of the services, websites, and applications operated by Yugo (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), including the OPS+ platform. By using our services, you agree to be bound by these Terms.
        </p>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">1. Acceptance of Terms</h2>
          <p className="text-[14px] text-[#666] leading-relaxed">
            By creating an account, booking a move, or otherwise using our services, you acknowledge that you have read, understood, and agree to these Terms and our Privacy Policy. If you do not agree, you may not use our services. We reserve the right to modify these Terms at any time; continued use after changes constitutes acceptance.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">2. Service Description</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            Yugo provides moving and logistics services, including but not limited to:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Residential and commercial moving services</li>
            <li>Packing, loading, transport, and unloading</li>
            <li>Real-time tracking and status updates via the OPS+ platform</li>
            <li>Coordination between customers, crew members, and partners</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            Services are subject to availability and may vary by location. We do not guarantee specific crew members, vehicles, or timelines, though we strive to meet agreed schedules.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">3. User Responsibilities</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            You agree to:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Provide accurate, complete, and current information when booking or using our services</li>
            <li>Ensure access to pickup and delivery locations at the scheduled times</li>
            <li>Disclose hazardous materials, valuables, or items requiring special handling</li>
            <li>Comply with all applicable laws and regulations</li>
            <li>Not use our services for any illegal or unauthorized purpose</li>
            <li>Maintain the security of your account credentials</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            You are responsible for all activity under your account. Failure to meet these responsibilities may result in cancellation, additional fees, or termination of services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">4. Booking and Cancellation</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            <strong>Booking:</strong> A booking is confirmed when you receive confirmation from us. You must provide accurate move details; discrepancies may result in price adjustments or service delays.
          </p>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            <strong>Cancellation:</strong> Cancellation policies vary by service and timing. Generally:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Cancellations made well in advance may be eligible for a full or partial refund</li>
            <li>Last-minute cancellations may incur fees</li>
            <li>No-shows or failure to provide access may result in forfeiture of deposit or full charge</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            Specific cancellation terms will be communicated at the time of booking. Contact us to cancel or reschedule.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">5. Liability Limitations</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            To the maximum extent permitted by law:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Our liability for any claim arising from or related to our services is limited to the amount you paid for the specific service giving rise to the claim, or the applicable insurance coverage, whichever is less</li>
            <li>We are not liable for indirect, incidental, consequential, special, or punitive damages, including lost profits, data loss, or emotional distress</li>
            <li>We are not liable for delays or failures caused by circumstances beyond our reasonable control (e.g., weather, traffic, acts of government)</li>
            <li>We are not liable for items you pack yourself unless we have expressly agreed to assume responsibility</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            Some jurisdictions do not allow limitation of liability; in such cases, our liability is limited to the fullest extent permitted by law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">6. Insurance and Claims</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            We maintain appropriate insurance for our operations. In the event of loss or damage:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>You must notify us promptly (typically within 24–48 hours) and in writing</li>
            <li>You must provide documentation, photos, and proof of value as requested</li>
            <li>Claims are subject to our claims process and applicable insurance terms</li>
            <li>Valuables, cash, and certain items may require separate coverage or may be excluded</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            Additional valuation coverage may be available for purchase. Contact us for details.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">7. Payment Terms</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            Payment terms will be specified at the time of booking. Generally:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>A deposit may be required to confirm a booking</li>
            <li>Final payment is typically due upon completion of the move</li>
            <li>We accept major credit cards and other payment methods as indicated</li>
            <li>Late payments may incur interest and collection costs</li>
            <li>Prices are subject to change; quoted prices are valid for the period specified</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            You authorize us to charge your payment method for all amounts due. Disputes must be raised within a reasonable time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">8. Dispute Resolution</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            We encourage you to contact us first to resolve any disputes. If we cannot resolve a dispute informally:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>You agree to attempt resolution through mediation before pursuing litigation</li>
            <li>Any legal action shall be brought in the courts specified in the Governing Law section</li>
            <li>You waive any right to participate in class actions or class-wide arbitration</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">9. Intellectual Property</h2>
          <p className="text-[14px] text-[#666] leading-relaxed">
            The OPS+ platform, our websites, applications, logos, content, and other materials are owned by Yugo or our licensors and are protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written permission. You retain ownership of your content; by submitting it, you grant us a license to use it as necessary to provide our services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">10. Termination</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            We may suspend or terminate your access to our services at any time, with or without cause or notice, including for violation of these Terms. You may terminate your account by contacting us. Upon termination:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Your right to use our services ceases immediately</li>
            <li>Provisions that by their nature should survive (e.g., liability limitations, dispute resolution) will survive</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">11. Governing Law</h2>
          <p className="text-[14px] text-[#666] leading-relaxed">
            These Terms are governed by the laws of the jurisdiction in which Yugo operates, without regard to conflict of law principles. Any disputes shall be resolved in the courts of that jurisdiction.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">12. General</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            These Terms, together with our Privacy Policy and any other policies referenced herein, constitute the entire agreement between you and Yugo. If any provision is found unenforceable, the remaining provisions remain in effect. Our failure to enforce any right does not waive that right.
          </p>
          <p className="text-[14px] text-[#666] leading-relaxed">
            For questions, contact us at{" "}
            <a href="mailto:hello@yugo.com" className="text-[#C9A962] hover:underline">
              hello@yugo.com
            </a>
            .
          </p>
        </section>

        <button
          type="button"
          onClick={() => router.back()}
          className="inline-block mt-8 text-[14px] font-semibold text-[#C9A962] hover:underline cursor-pointer"
        >
          ← Back
        </button>
      </main>
    </div>
  );
}
