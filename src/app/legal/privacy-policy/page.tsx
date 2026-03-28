import Link from "next/link";
import type { Metadata } from "next";
import YugoLogo from "@/components/YugoLogo";
import { getCompanyDisplayName } from "@/lib/config";
import { getLegalBranding } from "@/lib/legal-branding";

const EFFECTIVE = "March 15, 2026";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getCompanyDisplayName();
  return {
    title: `Privacy Policy, ${brand}`,
    description: `How ${brand} collects, uses, and protects your personal information.`,
  };
}

export default async function PrivacyPolicyPage() {
  const { companyLegal, brand, email, address } = await getLegalBranding();

  return (
    <main style={{ minHeight: "100vh", background: "#FDFCFA", fontFamily: "'DM Sans', sans-serif", color: "#1A1714" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #E8E4DC", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#FDFCFA", zIndex: 10 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <YugoLogo size={20} variant="gold" onLightBackground />
        </Link>
        <nav style={{ display: "flex", gap: 20, fontSize: 12, color: "#4F4B47" }}>
          <Link href="/legal/privacy-policy" style={{ color: "#1A1714", fontWeight: 600, textDecoration: "none" }}>Privacy Policy</Link>
          <Link href="/legal/terms-of-use" style={{ color: "#4F4B47", textDecoration: "none" }}>Terms of Use</Link>
          <Link href="/legal/terms-and-conditions" style={{ color: "#4F4B47", textDecoration: "none" }}>Terms & Conditions</Link>
        </nav>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "capitalize", color: "#C9A962", marginBottom: 8 }}>Legal</p>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 40, fontWeight: 500, color: "#1A1714", marginBottom: 12, lineHeight: 1.2 }}>Privacy Policy</h1>
          <p style={{ fontSize: 14, color: "#4F4B47" }}>Effective date: {EFFECTIVE} · {companyLegal}</p>
        </div>

        <section style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "#3A3530" }}>
            {companyLegal} (&quot;{brand},&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our moving and delivery platform, including our website, mobile applications, crew portal, partner portal, and all related services (collectively, the &quot;Platform&quot;).
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "#3A3530", marginTop: 12 }}>
            By accessing or using the Platform, you acknowledge that you have read and understood this Privacy Policy. If you do not agree with its terms, please do not access the Platform.
          </p>
        </section>

        <LegalSection title="1. Information We Collect">
          <p>We collect information you provide directly, information collected automatically, and information from third parties.</p>
          <SubHeading>1.1 Information You Provide</SubHeading>
          <ul>
            <li><strong>Account information:</strong> Name, email address, phone number, business name, billing address, and password when you create an account.</li>
            <li><strong>Job and booking data:</strong> Pick-up and drop-off addresses, item descriptions, inventory lists, special instructions, preferred times, and payment information.</li>
            <li><strong>Identity verification:</strong> Government-issued identification when required for certain services.</li>
            <li><strong>Communications:</strong> Messages, feedback, reviews, support requests, and any other content you send to us.</li>
            <li><strong>Sign-off data:</strong> Electronic signatures, satisfaction ratings, condition notes, and photos captured during service delivery.</li>
          </ul>
          <SubHeading>1.2 Information Collected Automatically</SubHeading>
          <ul>
            <li><strong>Location data:</strong> GPS coordinates from crew devices during active jobs to provide real-time tracking. Partner and client users may opt into location services to receive updates.</li>
            <li><strong>Device information:</strong> IP address, browser type, operating system, device identifiers, and mobile network information.</li>
            <li><strong>Usage data:</strong> Pages visited, features used, actions taken, time spent, and referral URLs.</li>
            <li><strong>Cookies and tracking technologies:</strong> Session cookies, persistent cookies, and local storage to maintain your session, remember preferences, and analyze usage.</li>
          </ul>
          <SubHeading>1.3 Information from Third Parties</SubHeading>
          <ul>
            <li><strong>Payment processors:</strong> Transaction confirmation and limited card information from our payment partners (Square).</li>
            <li><strong>Mapping services:</strong> Geocoded addresses and routing data via Mapbox.</li>
            <li><strong>Email service providers:</strong> Delivery and engagement statistics for communications we send.</li>
          </ul>
        </LegalSection>

        <LegalSection title="2. How We Use Your Information">
          <p>We use your information to:</p>
          <ul>
            <li>Provide, operate, and improve the Platform and our services.</li>
            <li>Process bookings, coordinate crew assignments, and fulfill deliveries and moves.</li>
            <li>Share real-time GPS tracking with authorised clients and partners.</li>
            <li>Send service confirmations, ETA notifications, invoices, and receipts.</li>
            <li>Process payments and manage billing.</li>
            <li>Respond to support requests and resolve disputes.</li>
            <li>Generate proof-of-delivery records and client sign-off documentation.</li>
            <li>Conduct safety monitoring, quality assurance, and performance analytics.</li>
            <li>Comply with legal obligations and protect against fraud.</li>
            <li>Send promotional communications where you have consented or where permitted by law.</li>
          </ul>
        </LegalSection>

        <LegalSection title="3. How We Share Your Information">
          <p>We do not sell your personal information. We may share your information with:</p>
          <ul>
            <li><strong>Service providers:</strong> Third-party vendors who perform services on our behalf (payment processing, SMS/email delivery, mapping, cloud hosting).</li>
            <li><strong>Clients and partners:</strong> Limited information (crew name, team name, real-time location) shared with the party who booked the service to facilitate tracking.</li>
            <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets, subject to standard confidentiality obligations.</li>
            <li><strong>Legal compliance:</strong> When required by applicable law, court order, or government request.</li>
            <li><strong>Safety:</strong> To protect the rights, property, or safety of {brand}, our users, or others.</li>
          </ul>
        </LegalSection>

        <LegalSection title="4. Location Data">
          <p>{brand} collects precise GPS location data from crew members&apos; devices during active job sessions. This data is used to:</p>
          <ul>
            <li>Provide clients and partners with live tracking of their move or delivery.</li>
            <li>Calculate ETAs and notify clients when crews are en route or have arrived.</li>
            <li>Generate location records for proof-of-delivery and dispute resolution.</li>
            <li>Monitor crew safety and operational performance.</li>
          </ul>
          <p>Crew location data is stored for 90 days after a job is completed and then deleted, except where required for active disputes or legal proceedings. Location tracking is only active during confirmed job sessions and cannot be enabled remotely without a crew member initiating a session.</p>
        </LegalSection>

        <LegalSection title="5. Data Retention">
          <p>We retain your information for as long as necessary to provide the Platform and fulfil the purposes described in this policy, unless a longer retention period is required or permitted by law.</p>
          <ul>
            <li><strong>Account data:</strong> Retained for the duration of your account plus 3 years after closure.</li>
            <li><strong>Job records, sign-offs, and invoices:</strong> Retained for 7 years for tax and legal compliance.</li>
            <li><strong>GPS location data:</strong> 90 days after job completion.</li>
            <li><strong>Photos:</strong> 2 years after job completion unless disputed.</li>
            <li><strong>Communications:</strong> 2 years.</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. Your Rights">
          <p>Depending on your jurisdiction, you may have the following rights:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal information.</li>
            <li><strong>Correction:</strong> Request correction of inaccurate information.</li>
            <li><strong>Deletion:</strong> Request deletion of your personal information, subject to legal retention obligations.</li>
            <li><strong>Portability:</strong> Receive a machine-readable export of your data.</li>
            <li><strong>Opt-out:</strong> Unsubscribe from marketing communications at any time.</li>
            <li><strong>Withdraw consent:</strong> Where we rely on consent, you may withdraw it at any time.</li>
          </ul>
          <p>To exercise any of these rights, contact us at <strong>{email}</strong>. We will respond within 30 days.</p>
        </LegalSection>

        <LegalSection title="7. Security">
          <p>We implement industry-standard technical and organisational measures to protect your information, including:</p>
          <ul>
            <li>TLS encryption for all data in transit.</li>
            <li>AES-256 encryption for sensitive data at rest.</li>
            <li>Role-based access controls limiting employee access to personal data.</li>
            <li>Regular security audits and penetration testing.</li>
            <li>Multi-factor authentication for administrative access.</li>
          </ul>
          <p>No method of transmission or storage is 100% secure. In the event of a data breach affecting your rights, we will notify you as required by applicable law.</p>
        </LegalSection>

        <LegalSection title="8. Cookies">
          <p>We use the following types of cookies:</p>
          <ul>
            <li><strong>Strictly necessary:</strong> Required for the Platform to function (authentication, session management).</li>
            <li><strong>Functional:</strong> Remember your preferences (language, theme).</li>
            <li><strong>Analytics:</strong> Aggregate usage statistics to improve the Platform.</li>
          </ul>
          <p>You can control cookies through your browser settings. Disabling strictly necessary cookies may impair Platform functionality.</p>
        </LegalSection>

        <LegalSection title="9. Children's Privacy">
          <p>The Platform is not directed to individuals under 18 years of age. We do not knowingly collect personal information from minors. If we become aware that we have inadvertently collected information from a minor, we will delete it promptly.</p>
        </LegalSection>

        <LegalSection title="10. International Transfers">
          <p>Yugo is based in {address}. Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place in accordance with applicable data protection laws.</p>
        </LegalSection>

        <LegalSection title="11. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email or by posting a prominent notice on the Platform. The &quot;Effective date&quot; at the top of this page indicates when the policy was last revised. Continued use of the Platform after changes take effect constitutes acceptance of the updated policy.</p>
        </LegalSection>

        <LegalSection title="12. Contact Us">
          <p>For questions or concerns about this Privacy Policy or to exercise your rights, contact us at:</p>
          <address style={{ fontStyle: "normal", marginTop: 8, lineHeight: 1.8 }}>
            <strong>{companyLegal}</strong><br />
            {address}<br />
            <a href={`mailto:${email}`} style={{ color: "#C9A962" }}>{email}</a>
          </address>
        </LegalSection>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #E8E4DC", display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Link href="/legal/terms-of-use" style={{ fontSize: 13, color: "#C9A962", textDecoration: "none" }}>Terms of Use →</Link>
          <Link href="/legal/terms-and-conditions" style={{ fontSize: 13, color: "#C9A962", textDecoration: "none" }}>Terms & Conditions →</Link>
        </div>
      </div>
    </main>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1714", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E4DC" }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.8, color: "#3A3530" }}>{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1A1714", marginTop: 16, marginBottom: 6 }}>{children}</h3>;
}
