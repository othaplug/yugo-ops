import Link from "next/link";
import type { Metadata } from "next";
import YugoLogo from "@/components/YugoLogo";
import { getCompanyDisplayName } from "@/lib/config";
import { getLegalBranding } from "@/lib/legal-branding";

const EFFECTIVE = "March 15, 2026";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getCompanyDisplayName();
  return {
    title: `Terms of Use, ${brand}`,
    description: `Terms governing your access to and use of the ${brand} platform.`,
  };
}

export default async function TermsOfUsePage() {
  const { companyLegal, brand, email } = await getLegalBranding();

  return (
    <main style={{ minHeight: "100vh", background: "#FDFCFA", fontFamily: "'DM Sans', sans-serif", color: "#1A1714" }}>
      <header style={{ borderBottom: "1px solid #E8E4DC", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#FDFCFA", zIndex: 10 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <YugoLogo size={20} variant="gold" onLightBackground />
        </Link>
        <nav style={{ display: "flex", gap: 20, fontSize: 12, color: "#4F4B47" }}>
          <Link href="/legal/privacy-policy" style={{ color: "#4F4B47", textDecoration: "none" }}>Privacy Policy</Link>
          <Link href="/legal/terms-of-use" style={{ color: "#1A1714", fontWeight: 600, textDecoration: "none" }}>Terms of Use</Link>
          <Link href="/legal/terms-and-conditions" style={{ color: "#4F4B47", textDecoration: "none" }}>Terms & Conditions</Link>
        </nav>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#2C3E2D", marginBottom: 8 }}>Legal</p>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 40, fontWeight: 500, color: "#1A1714", marginBottom: 12, lineHeight: 1.2 }}>Terms of Use</h1>
          <p style={{ fontSize: 14, color: "#4F4B47" }}>Effective date: {EFFECTIVE} · {companyLegal}</p>
        </div>

        <section style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "#3A3530" }}>
            These Terms of Use (&quot;Terms&quot;) govern your access to and use of the {brand} platform, including all websites, portals, mobile applications, and related services (collectively, the &quot;Platform&quot;) operated by {companyLegal} (&quot;{brand}&quot;). By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, do not access or use the Platform.
          </p>
        </section>

        <LegalSection title="1. Eligibility">
          <p>You must be at least 18 years old and capable of forming a legally binding contract to use the Platform. By using the Platform, you represent that you meet these requirements. If you are using the Platform on behalf of a business or organisation, you represent that you have authority to bind that entity to these Terms.</p>
        </LegalSection>

        <LegalSection title="2. Account Registration">
          <p>To access certain features, you must create an account. You agree to:</p>
          <ul>
            <li>Provide accurate, current, and complete information during registration.</li>
            <li>Maintain and promptly update your account information.</li>
            <li>Keep your credentials confidential and not share them with any third party.</li>
            <li>Notify us immediately of any unauthorised access to your account.</li>
            <li>Accept responsibility for all activity that occurs under your account.</li>
          </ul>
          <p>{brand} reserves the right to terminate or suspend accounts for violation of these Terms.</p>
        </LegalSection>

        <LegalSection title="3. Permitted Use">
          <p>You may use the Platform solely for lawful purposes in accordance with these Terms. You agree not to:</p>
          <ul>
            <li>Use the Platform in any way that violates applicable federal, provincial, or local law or regulation.</li>
            <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</li>
            <li>Attempt to gain unauthorised access to any portion of the Platform or any other systems or networks connected to the Platform.</li>
            <li>Reverse engineer, decompile, or disassemble any component of the Platform.</li>
            <li>Use automated means (bots, scrapers, crawlers) to access or interact with the Platform without our express written consent.</li>
            <li>Introduce any viruses, malware, or other harmful code.</li>
            <li>Use the Platform to harass, abuse, threaten, or intimidate any person.</li>
            <li>Resell or sublicense access to the Platform without {brand}&apos;s written consent.</li>
          </ul>
        </LegalSection>

        <LegalSection title="4. Platform Services">
          <p>{brand} provides a technology platform that facilitates moving and delivery coordination. Depending on your role:</p>
          <ul>
            <li><strong>Clients:</strong> You may book moves, track crew progress, receive notifications, review deliveries, and make payments through the Platform.</li>
            <li><strong>Partners:</strong> You may schedule and manage deliveries, access live tracking for your shipments, view proof-of-delivery records, and access your partner portal.</li>
            <li><strong>Crew members:</strong> You may receive job assignments, update job statuses, capture photos, process client sign-offs, submit expenses, and manage your activity through the crew portal.</li>
            <li><strong>Administrators:</strong> You may manage all platform operations, users, jobs, and settings through the admin console.</li>
          </ul>
        </LegalSection>

        <LegalSection title="5. Intellectual Property">
          <p>The Platform and its entire contents, features, and functionality, including but not limited to software, text, graphics, logos, icons, images, and data compilations, are the exclusive property of {brand} and its licensors and are protected by Canadian and international copyright, trademark, and other intellectual property laws.</p>
          <p style={{ marginTop: 8 }}>We grant you a limited, non-exclusive, non-transferable, revocable licence to access and use the Platform for its intended purpose. This licence does not include the right to:</p>
          <ul>
            <li>Sublicense or transfer the licence to any third party.</li>
            <li>Make derivative works based on Platform content.</li>
            <li>Download Platform software (except for caching by browsers as permitted).</li>
            <li>Use {brand}&apos;s trademarks or branding without written permission.</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. User Content">
          <p>You may submit content through the Platform, including photos, notes, reviews, and feedback (&quot;User Content&quot;). By submitting User Content, you grant {brand} a non-exclusive, royalty-free, worldwide licence to use, reproduce, and display that content solely in connection with operating and improving the Platform.</p>
          <p style={{ marginTop: 8 }}>You represent and warrant that:</p>
          <ul>
            <li>You own or have the necessary rights to submit the User Content.</li>
            <li>The User Content does not infringe any third-party rights.</li>
            <li>The User Content is accurate and not misleading.</li>
          </ul>
        </LegalSection>

        <LegalSection title="7. Third-Party Services">
          <p>The Platform may integrate with or link to third-party services (Mapbox, Square, email providers). These integrations are governed by the third parties&apos; own terms and privacy policies. {brand} is not responsible for the content, practices, or availability of third-party services.</p>
        </LegalSection>

        <LegalSection title="8. Disclaimers">
          <p>THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
          <p style={{ marginTop: 8 }}>{brand} does not warrant that the Platform will be uninterrupted, error-free, or free of viruses or other harmful components. We do not warrant the accuracy or completeness of any content on the Platform.</p>
        </LegalSection>

        <LegalSection title="9. Limitation of Liability">
          <p>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, {brand.toUpperCase()} AND ITS DIRECTORS, OFFICERS, EMPLOYEES, AFFILIATES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE PLATFORM.</p>
          <p style={{ marginTop: 8 }}>In no event shall {brand}&apos;s aggregate liability for any claims arising from your use of the Platform exceed the greater of (a) the amounts paid by you to {brand} in the 12 months preceding the claim, or (b) $100 CAD.</p>
        </LegalSection>

        <LegalSection title="10. Indemnification">
          <p>You agree to indemnify, defend, and hold harmless {brand} and its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, judgments, awards, losses, costs, and expenses (including reasonable legal fees) arising out of or relating to your violation of these Terms or your use of the Platform.</p>
        </LegalSection>

        <LegalSection title="11. Termination">
          <p>We may suspend or terminate your access to the Platform at any time, with or without cause, with or without notice. Upon termination, your right to use the Platform ceases immediately. Provisions of these Terms that by their nature should survive termination will survive, including intellectual property provisions, disclaimers, and limitations of liability.</p>
        </LegalSection>

        <LegalSection title="12. Governing Law">
          <p>These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict of law principles. Any disputes shall be resolved exclusively in the courts located in Toronto, Ontario, and you consent to personal jurisdiction in those courts.</p>
        </LegalSection>

        <LegalSection title="13. Changes to These Terms">
          <p>We may update these Terms at any time. We will notify you of material changes by email or prominent notice on the Platform. Continued use of the Platform after the effective date of changes constitutes acceptance of the updated Terms.</p>
        </LegalSection>

        <LegalSection title="14. Contact">
          <p>For questions about these Terms, contact us at <a href={`mailto:${email}`} style={{ color: "#2C3E2D" }}>{email}</a>.</p>
        </LegalSection>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #E8E4DC", display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Link href="/legal/privacy-policy" style={{ fontSize: 13, color: "#2C3E2D", textDecoration: "none" }}>Privacy Policy →</Link>
          <Link href="/legal/terms-and-conditions" style={{ fontSize: 13, color: "#2C3E2D", textDecoration: "none" }}>Terms & Conditions →</Link>
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
