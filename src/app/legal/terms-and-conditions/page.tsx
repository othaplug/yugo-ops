import Link from "next/link";
import type { Metadata } from "next";
import YugoLogo from "@/components/YugoLogo";
import { getCompanyDisplayName } from "@/lib/config";
import { getLegalBranding } from "@/lib/legal-branding";

const EFFECTIVE = "March 15, 2026";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getCompanyDisplayName();
  return {
    title: `Terms & Conditions, ${brand}`,
    description: `The terms and conditions governing moving and delivery services provided by ${brand}.`,
  };
}

export default async function TermsAndConditionsPage() {
  const { companyLegal, brand, email } = await getLegalBranding();

  return (
    <main style={{ minHeight: "100vh", background: "#FDFCFA", fontFamily: "var(--font-body)", color: "#1A1714" }}>
      <header style={{ borderBottom: "1px solid #E8E4DC", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#FDFCFA", zIndex: 10 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <YugoLogo size={20} variant="wine" onLightBackground />
        </Link>
        <nav style={{ display: "flex", gap: 20, fontSize: 12, color: "#4F4B47" }}>
          <Link href="/legal/privacy-policy" style={{ color: "#4F4B47", textDecoration: "none" }}>Privacy Policy</Link>
          <Link href="/legal/terms-of-use" style={{ color: "#4F4B47", textDecoration: "none" }}>Terms of Use</Link>
          <Link href="/legal/terms-and-conditions" style={{ color: "#1A1714", fontWeight: 600, textDecoration: "none" }}>Terms & Conditions</Link>
        </nav>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#2C3E2D", marginBottom: 8 }}>Legal</p>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 40, fontWeight: 500, color: "#1A1714", marginBottom: 12, lineHeight: 1.2 }}>Terms & Conditions</h1>
          <p style={{ fontSize: 14, color: "#4F4B47" }}>Effective date: {EFFECTIVE} · {brand}</p>
        </div>

        <section style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "#3A3530" }}>
            These Terms and Conditions (&quot;Agreement&quot;) govern the moving, delivery, and logistics services provided by {companyLegal} (&quot;{brand}&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) to you (&quot;Client&quot;, &quot;Partner&quot;, or &quot;Customer&quot;). By booking, scheduling, or accepting our services, whether through the Platform, phone, or email, you agree to this Agreement in its entirety.
          </p>
        </section>

        <LegalSection title="1. Services">
          <p>{brand} provides professional moving and delivery services including, but not limited to:</p>
          <ul>
            <li>Residential and commercial moving services.</li>
            <li>Furniture and item delivery on behalf of retail, design, and commercial partners.</li>
            <li>White-glove and specialised handling for art, antiques, electronics, and fragile items.</li>
            <li>Labour-only services for loading, unloading, and rearranging.</li>
            <li>Packaging and packing supplies.</li>
          </ul>
          <p>Services are subject to availability, crew capacity, and applicable regulations. {brand} reserves the right to decline any booking at its sole discretion.</p>
        </LegalSection>

        <LegalSection title="2. Booking and Confirmation">
          <p>A booking is not confirmed until you receive a written confirmation from {brand} via email or through the Platform. Verbal agreements do not constitute a binding commitment. {brand} reserves the right to adjust pricing or service scope before a booking is confirmed if material information was omitted or was inaccurate at the time of inquiry.</p>
        </LegalSection>

        <LegalSection title="3. Pricing and Payment">
          <SubHeading>3.1 Pricing</SubHeading>
          <p>Prices are quoted based on information provided by the Client at booking. Actual charges may vary based on:</p>
          <ul>
            <li>Actual volume, weight, or number of items moved.</li>
            <li>Actual time required to complete the job.</li>
            <li>Stairs, elevator wait times, long carries, or access difficulties not disclosed at booking.</li>
            <li>Additional items added on the day of the move or delivery.</li>
            <li>Special handling requirements identified on-site.</li>
          </ul>
          <SubHeading>3.2 Payment</SubHeading>
          <p>Payment is due upon completion of services unless otherwise agreed in writing. We accept major credit cards, debit, and other methods specified on the Platform. For partner accounts, payment terms are specified in your Partner Agreement.</p>
          <SubHeading>3.3 Tips</SubHeading>
          <p>Tips are optional and not included in quoted prices. They are entirely at your discretion and are distributed directly to the crew team.</p>
          <SubHeading>3.4 Late Payment</SubHeading>
          <p>Overdue balances may be subject to a late payment fee of 2% per month (24% per annum) compounded monthly.</p>
        </LegalSection>

        <LegalSection title="4. Cancellation and Rescheduling">
          <ul>
            <li><strong>More than 48 hours before scheduled service:</strong> Full refund or no cancellation fee.</li>
            <li><strong>24–48 hours before scheduled service:</strong> 25% cancellation fee of the quoted price.</li>
            <li><strong>Less than 24 hours before scheduled service:</strong> 50% cancellation fee of the quoted price.</li>
            <li><strong>Day-of cancellation or no-show:</strong> 100% of the minimum quoted fee.</li>
          </ul>
          <p>{brand} may cancel or reschedule at any time due to crew unavailability, weather, safety concerns, or other circumstances beyond our control. In such cases, you will receive a full refund or priority rescheduling.</p>
        </LegalSection>

        <LegalSection title="5. Client Responsibilities">
          <p>The Client is responsible for:</p>
          <ul>
            <li>Ensuring all items to be moved are disclosed accurately and completely at booking.</li>
            <li>Securing or removing all items of extreme value (cash, jewellery, irreplaceable documents) prior to the move.</li>
            <li>Ensuring clear, safe access to all pickup and delivery locations, including parking, elevator booking, and building access.</li>
            <li>Notifying {brand} of any access restrictions, stairs, long carries, or special conditions before booking.</li>
            <li>Being present or having an authorised representative present at both pickup and delivery to confirm items and sign off on completion.</li>
            <li>Ensuring items are in a packable, moveable condition. {brand} is not responsible for items that were not adequately prepared.</li>
            <li>Draining appliances (washing machines, refrigerators) prior to the move.</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. Prohibited Items">
          <p>{brand} will not transport the following items:</p>
          <ul>
            <li>Hazardous materials, flammable liquids, explosives, or toxic substances.</li>
            <li>Illegal items or controlled substances.</li>
            <li>Live animals or perishable food items.</li>
            <li>Weapons, ammunition, or firearms (unless arrangements are made in advance with appropriate documentation).</li>
            <li>Currency, bearer bonds, or negotiable instruments.</li>
          </ul>
          <p>Transporting prohibited items without disclosure voids all liability protection and may result in immediate termination of service and forfeiture of payment.</p>
        </LegalSection>

        <LegalSection title="7. Liability and Claims">
          <SubHeading>7.1 Our Liability</SubHeading>
          <p>{brand}&apos;s liability for loss or damage to items is limited to <strong>$0.60 per pound per article</strong> (Released Value Protection, standard industry rate) unless you purchase additional valuation coverage or declare a higher value in writing before the service commences.</p>
          <SubHeading>7.2 Valuation Coverage</SubHeading>
          <p>Clients may declare a higher value for their items by notifying {brand} in writing at least 24 hours before the job. A surcharge may apply. {brand} is not an insurer and does not offer insurance. We strongly recommend obtaining independent moving insurance for high-value items.</p>
          <SubHeading>7.3 Exclusions</SubHeading>
          <p>{brand} is not liable for:</p>
          <ul>
            <li>Items of inherent vice (pre-existing defects, mechanical failure, fragile items in original manufacturer packaging).</li>
            <li>Damage caused by incomplete or improper packing done by the Client.</li>
            <li>Items excluded from disclosure at booking.</li>
            <li>Acts of God, extreme weather, traffic accidents, or other force majeure events.</li>
            <li>Damage to items not listed on the inventory at time of pickup.</li>
            <li>Loss of income, revenue, business opportunity, or consequential losses of any kind.</li>
          </ul>
          <SubHeading>7.4 Claims Process</SubHeading>
          <p>All damage or loss claims must be:</p>
          <ul>
            <li>Noted on the Client Sign-Off form at the time of delivery, or</li>
            <li>Submitted in writing to <a href={`mailto:${email}`} style={{ color: "#2C3E2D" }}>{email}</a> within <strong>24 hours</strong> of delivery completion.</li>
          </ul>
          <p>Claims submitted after 24 hours will not be accepted. Providing false or exaggerated claims constitutes fraud.</p>
        </LegalSection>

        <LegalSection title="8. High-Value and Special Items">
          <p>Items with a replacement value exceeding $1,000 per article (including art, antiques, electronics, jewellery, pianos, safes) must be declared in writing at the time of booking. Special handling rates may apply. {brand} reserves the right to decline transport of any item it deems excessively fragile or risky without appropriate valuation coverage.</p>
        </LegalSection>

        <LegalSection title="9. Partner-Specific Terms">
          <SubHeading>9.1 Delivery Partners</SubHeading>
          <p>Partners using the Platform to schedule deliveries agree that:</p>
          <ul>
            <li>All consignee (recipient) information provided is accurate and the consignee has consented to receive the delivery.</li>
            <li>Partners are responsible for ensuring items are properly packaged for transport prior to pickup.</li>
            <li>Proof-of-delivery records generated through the Platform are legally binding records of delivery completion.</li>
            <li>Partners are responsible for communicating delivery schedules to their end customers.</li>
          </ul>
          <SubHeading>9.2 Billing</SubHeading>
          <p>Partner billing is governed by individual Partner Agreements. In the absence of a specific Partner Agreement, standard consumer rates apply.</p>
        </LegalSection>

        <LegalSection title="10. Crew Conduct">
          <p>{brand} crews are trained professionals. We will not tolerate:</p>
          <ul>
            <li>Harassment, abuse, or threats directed at crew members.</li>
            <li>Requests to transport prohibited items.</li>
            <li>Unsafe conditions at pickup or delivery locations.</li>
          </ul>
          <p>{brand} reserves the right to withdraw crew from any location where safety is compromised, with no refund obligation for any portion of the job not completed due to Client-caused safety issues.</p>
        </LegalSection>

        <LegalSection title="11. Force Majeure">
          <p>{brand} shall not be liable for any delay or failure to perform resulting from causes outside our reasonable control, including but not limited to: acts of God, natural disasters, pandemic, war, government action, strikes, labour disputes, power outages, extreme weather, or road closures. In such circumstances, we will make reasonable efforts to reschedule and will communicate promptly.</p>
        </LegalSection>

        <LegalSection title="12. Dispute Resolution">
          <p>In the event of a dispute, we request that you first contact our customer service team at <a href={`mailto:${email}`} style={{ color: "#2C3E2D" }}>{email}</a> to attempt informal resolution. If a dispute is not resolved within 30 days, either party may pursue formal resolution. Any unresolved disputes shall be subject to binding arbitration in Toronto, Ontario under the Arbitration Act (Ontario), except that either party may seek injunctive relief in a court of competent jurisdiction.</p>
        </LegalSection>

        <LegalSection title="13. Governing Law">
          <p>This Agreement is governed by the laws of the Province of Ontario and the applicable federal laws of Canada. The UN Convention on Contracts for the International Sale of Goods does not apply.</p>
        </LegalSection>

        <LegalSection title="14. Entire Agreement">
          <p>This Agreement, together with any booking confirmation, Partner Agreement, and our Privacy Policy and Terms of Use, constitutes the entire agreement between you and {brand} with respect to the subject matter herein and supersedes all prior agreements, representations, and warranties.</p>
        </LegalSection>

        <LegalSection title="15. Severability">
          <p>If any provision of this Agreement is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will continue in full force and effect.</p>
        </LegalSection>

        <LegalSection title="16. Contact">
          <p>For any questions regarding these Terms and Conditions, contact us at <a href={`mailto:${email}`} style={{ color: "#2C3E2D" }}>{email}</a>.</p>
        </LegalSection>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #E8E4DC", display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Link href="/legal/privacy-policy" style={{ fontSize: 13, color: "#2C3E2D", textDecoration: "none" }}>Privacy Policy →</Link>
          <Link href="/legal/terms-of-use" style={{ fontSize: 13, color: "#2C3E2D", textDecoration: "none" }}>Terms of Use →</Link>
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
