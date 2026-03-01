"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CookiesPage() {
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
        <h1 className="text-[24px] font-bold text-[#1A1A1A] mb-6">Cookie Policy</h1>
        <p className="text-[14px] text-[#666] leading-relaxed mb-6">
          <strong>Last updated:</strong> February 2025
        </p>
        <p className="text-[14px] text-[#666] leading-relaxed mb-6">
          This Cookie Policy explains how Yugo (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) uses cookies and similar technologies when you use our websites, applications, and the OPS+ platform. This policy should be read together with our{" "}
          <Link href="/privacy" className="text-[#C9A962] hover:underline">
            Privacy Policy
          </Link>
          .
        </p>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">1. What Are Cookies?</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            Cookies are small text files that are stored on your device (computer, tablet, or mobile) when you visit a website. They are widely used to make websites work more efficiently, remember your preferences, and provide information to website owners.
          </p>
          <p className="text-[14px] text-[#666] leading-relaxed">
            We also use similar technologies such as local storage, session storage, and pixels (tracking pixels) that serve similar purposes. When we refer to &quot;cookies&quot; in this policy, we include these related technologies unless otherwise stated.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">2. Essential Cookies</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            Essential cookies are necessary for the website and platform to function. They enable core features such as:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>User authentication and session management</li>
            <li>Security (e.g., protecting against cross-site request forgery)</li>
            <li>Load balancing and performance</li>
            <li>Remembering your preferences (e.g., language, region)</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            These cookies cannot be disabled without affecting the functionality of our services. They typically do not store personally identifiable information beyond what is necessary for the session.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">3. Analytics Cookies</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            Analytics cookies help us understand how visitors interact with our websites and applications. They collect information such as:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Pages visited and time spent on each page</li>
            <li>How you arrived at our site (e.g., search engine, referral link)</li>
            <li>Device and browser type</li>
            <li>General geographic location (typically at country or region level)</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            This information is aggregated and anonymized where possible. We use it to improve our services, fix issues, and understand user behavior. You can typically opt out of analytics cookies through your browser settings or our cookie preferences (where available).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">4. Functional Cookies</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            Functional cookies enable enhanced functionality and personalization, such as:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Remembering your login state across sessions</li>
            <li>Storing preferences (e.g., dashboard layout, notification settings)</li>
            <li>Enabling features like live chat or support widgets</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            These cookies may be set by us or by third-party providers whose services we use. Disabling them may affect certain features but will not prevent basic use of our services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">5. How to Manage Cookies</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            You can control and manage cookies in several ways:
          </p>
          <h3 className="text-[16px] font-medium text-[#1A1A1A] mb-2 mt-4">Browser Settings</h3>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            Most browsers allow you to view, block, or delete cookies. You can usually find these options in your browser&apos;s settings under &quot;Privacy,&quot; &quot;Security,&quot; or similar. Note that blocking all cookies may prevent you from using certain features of our services.
          </p>
          <h3 className="text-[16px] font-medium text-[#1A1A1A] mb-2 mt-4">Opt-Out Tools</h3>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            For analytics and advertising cookies, you may use industry opt-out tools such as:
          </p>
          <ul className="list-disc pl-6 text-[14px] text-[#666] leading-relaxed mb-3 space-y-1">
            <li>Your browser&apos;s &quot;Do Not Track&quot; setting (where supported)</li>
            <li>Third-party opt-out tools for specific analytics or advertising providers</li>
          </ul>
          <p className="text-[14px] text-[#666] leading-relaxed">
            If we offer a cookie preference center on our website, you can use it to manage your preferences for non-essential cookies.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">6. Cookie Duration</h2>
          <p className="text-[14px] text-[#666] leading-relaxed">
            Cookies may be &quot;session&quot; cookies (deleted when you close your browser) or &quot;persistent&quot; cookies (stored for a set period or until you delete them). The duration varies by cookie type and purpose. Essential and functional cookies may persist for the duration of your session or longer to maintain your preferences.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">7. Updates</h2>
          <p className="text-[14px] text-[#666] leading-relaxed">
            We may update this Cookie Policy from time to time to reflect changes in our practices or applicable law. We will post the updated policy on our website and update the &quot;Last updated&quot; date. We encourage you to review this policy periodically.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-3">8. Contact Us</h2>
          <p className="text-[14px] text-[#666] leading-relaxed mb-3">
            If you have questions about our use of cookies or this Cookie Policy, please contact us:
          </p>
          <p className="text-[14px] text-[#666] leading-relaxed">
            Email:{" "}
            <a href="mailto:hello@yugo.com" className="text-[#C9A962] hover:underline">
              hello@yugo.com
            </a>
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
