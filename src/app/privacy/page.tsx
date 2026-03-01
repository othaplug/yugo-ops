"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PrivacyPage() {
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
        <h1 className="text-[24px] font-bold text-[#1A1A1A] mb-6">Privacy Policy</h1>
        <p className="text-[14px] text-[#666] leading-relaxed mb-6">
          <strong>Last updated:</strong> February 2025
        </p>
        <p className="text-[14px] text-[#666] leading-relaxed mb-6">
          Yugo (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the OPS+ platform and related moving and logistics services. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services, websites, and applications.
        </p>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">1. Information We Collect</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            We collect information that you provide directly to us and information we obtain automatically when you use our services.
          </p>
          <h3 className="text-[16px] font-medium text-[#1A1A1A] mb-2 mt-4">Personal Information</h3>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Name, email address, phone number, and mailing address</li>
            <li>Account credentials and profile information</li>
            <li>Move details (origin, destination, dates, inventory)</li>
            <li>Payment and billing information</li>
            <li>Communications and correspondence with us</li>
          </ul>
          <h3 className="text-[16px] font-medium text-[#1A1A1A] mb-2 mt-4">Location Data</h3>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Real-time location when using our tracking features</li>
            <li>Pickup and delivery addresses</li>
            <li>GPS data for route optimization and ETA estimates</li>
          </ul>
          <h3 className="text-[16px] font-medium text-[#1A1A1A] mb-2 mt-4">Payment Information</h3>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Credit card numbers, billing addresses, and transaction history</li>
            <li>Payment information is processed by third-party payment processors; we do not store full card numbers</li>
          </ul>
          <h3 className="text-[16px] font-medium text-[#1A1A1A] mb-2 mt-4">Photos and Documentation</h3>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Photos of inventory, condition reports, and damage documentation</li>
            <li>Sign-off and proof-of-delivery images</li>
          </ul>
          <h3 className="text-[16px] font-medium text-[#1A1A1A] mb-2 mt-4">Automatically Collected Information</h3>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Device information, IP address, browser type, and operating system</li>
            <li>Usage data, pages visited, and features used</li>
            <li>Cookies and similar tracking technologies (see our Cookie Policy)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li><strong>Service delivery:</strong> To schedule, coordinate, and complete moves; assign crew members; and provide tracking and updates</li>
            <li><strong>Communication:</strong> To send confirmations, status updates, and respond to inquiries</li>
            <li><strong>Analytics and improvement:</strong> To analyze usage patterns, improve our platform, and develop new features</li>
            <li><strong>Security and fraud prevention:</strong> To protect against unauthorized access and fraudulent activity</li>
            <li><strong>Legal compliance:</strong> To comply with applicable laws and regulations</li>
            <li><strong>Marketing:</strong> To send promotional communications (with your consent where required)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">3. Data Sharing</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            We may share your information with:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li><strong>Crew members and partners:</strong> Move details, contact information, and location data necessary to perform the service</li>
            <li><strong>Payment processors:</strong> To process payments securely</li>
            <li><strong>Service providers:</strong> Cloud hosting, analytics, and support tools that assist our operations</li>
            <li><strong>Legal requirements:</strong> When required by law, court order, or government request</li>
            <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            We do not sell your personal information to third parties.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">4. Data Retention</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            We retain your information for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. Move records, payment history, and documentation are typically retained for at least seven years for legal and insurance purposes. You may request deletion of certain data subject to applicable retention requirements.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">5. Your Rights</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            Depending on your location, you may have the right to:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
            <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal exceptions</li>
            <li><strong>Portability:</strong> Request a copy of your data in a portable format</li>
            <li><strong>Opt-out:</strong> Opt out of marketing communications and certain data processing</li>
            <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            To exercise these rights, contact us at{" "}
            <a href="mailto:hello@yugo.com" className="text-[#C9A962] hover:underline">
              hello@yugo.com
            </a>
            . Residents of certain jurisdictions (e.g., California, EU) may have additional rights under applicable privacy laws.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">6. Cookies and Tracking</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            We use cookies and similar technologies to enhance your experience, analyze usage, and deliver relevant content. For detailed information, please see our{" "}
            <Link href="/cookies" className="text-[#C9A962] hover:underline">
              Cookie Policy
            </Link>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">7. Children&apos;s Privacy</h2>
          <p className="text-[14px] text-[#666] leading-relaxed">
            Our services are not directed to individuals under 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">8. Security</h2>
          <p className="text-[14px] text-[#666] leading-relaxed">
            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">9. International Transfers</h2>
          <p className="text-[14px] text-[#666] leading-relaxed">
            Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers where required by law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">10. Contact Us</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            For questions about this Privacy Policy or to exercise your rights, contact us:
          </p>
          <ul className="list-none text-[14px] text-[#666] leading-relaxed space-y-1">
            <li>Email:{" "}
              <a href="mailto:hello@yugo.com" className="text-[#C9A962] hover:underline">
                hello@yugo.com
              </a>
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">11. Updates to This Policy</h2>
          <p className="text-[14px] text-[#666] leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on our website and updating the &quot;Last updated&quot; date. Your continued use of our services after such changes constitutes acceptance of the updated policy.
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
