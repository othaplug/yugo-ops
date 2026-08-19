/**
 * Canonical B2B coverage program ("Yugo Asset Protection") + commercial terms.
 *
 * ONE source of truth so the client quote page, the client email, and the
 * /terms page can never drift. Every dollar figure and every terms line is a
 * constant here — edit here, and all three surfaces update.
 *
 * Numbers reflect Yugo's real coverage as of this build: $5M commercial general
 * liability, $50k cargo / declared-value ceiling. Confirm exact limits with the
 * broker and the Ontario bill-of-lading Conditions of Carriage before treating
 * this as final legal/insurance copy — the STRUCTURE is fixed; the figures are
 * config.
 *
 * Rules honored: pounds only (never kg), no em dashes in customer copy, no
 * emojis, no "PO" concept. Quotes valid 14 days. Net-30 is partner-only; every
 * one-off pays in full at booking.
 */

export const B2B_QUOTE_VALID_DAYS = 14;

/** Commercial general liability carried by Yugo (company-level policy). */
export const B2B_CGL_LIMIT_LABEL = "$5M";
/** Cargo / declared-value ceiling on the goods (per shipment). */
export const B2B_CARGO_CEILING = 50000;
/** Full-replacement value included free on every B2B job (per shipment). */
export const B2B_INCLUDED_COVERAGE = 10000;

export interface CoverageTier {
  key: "standard" | "enhanced" | "signature";
  name: string;
  tagline: string;
  limitLabel: string;
  deductibleLabel: string;
  priceLabel: string;
  included: boolean;
  points: string[];
}

/** Yugo Asset Protection tiers, in display order. */
export const B2B_COVERAGE_TIERS: CoverageTier[] = [
  {
    key: "standard",
    name: "Standard Protection",
    tagline: "Included on every Yugo delivery",
    limitLabel: "Full replacement value to $10,000",
    deductibleLabel: "$0 deductible",
    priceLabel: "Included",
    included: true,
    points: [
      "All-risk protection, wall to wall, from the moment we lift your piece to the moment it is placed and positioned",
      "Full replacement value to $10,000 per shipment. Repaired, replaced, or paid at current value. Not $0.60 a pound",
      "Backed by our $5M commercial general liability",
    ],
  },
  {
    key: "enhanced",
    name: "Enhanced Protection",
    tagline: "For higher-value pieces",
    limitLabel: "Declared value to $50,000",
    deductibleLabel: "$0 deductible",
    priceLabel: "Declared value",
    included: false,
    points: [
      "All-risk full replacement to your declared value, up to $50,000 per shipment",
      "Zero deductible. Every dollar you declare is a dollar covered",
      "Ideal for statement furniture, lighting, and commissioned pieces",
    ],
  },
  {
    key: "signature",
    name: "Signature Protection",
    tagline: "Fine art and bespoke, above $50,000",
    limitLabel: "Scheduled per item",
    deductibleLabel: "$0 deductible",
    priceLabel: "Quoted per item",
    included: false,
    points: [
      "Nail to nail. Continuous cover through packing, transit, and installation",
      "Each piece scheduled individually with dedicated coverage arranged",
      "For gallery works, antiques, and one-of-a-kind commissions",
    ],
  },
];

/** The single confident COI line that unlocks Class-A buildings. */
export const B2B_COI_LINE =
  "Certificate of Insurance provided on request, same or next business day, with your building, management company, and ownership named as additional insured and waiver of subrogation included. Approved for Class-A and trophy properties across the GTA.";

/** One-sentence moat statement for the coverage section header. */
export const B2B_COVERAGE_HEADLINE =
  "A courier tells you what they are not liable for. Yugo tells you what is covered: full replacement value, wall to wall, zero deductible, and a certificate of insurance in your property manager's inbox before we arrive.";

/**
 * Short-form terms rendered directly on the quote. Plain-language, premium
 * tone. The full Terms live at /terms and govern.
 */
export const B2B_TERMS_SHORT: { title: string; body: string }[] = [
  {
    title: "Validity and acceptance",
    body: "This quote is valid for 14 days. Approving it forms a binding agreement under Yugo's Commercial Terms & Conditions.",
  },
  {
    title: "Pricing and payment",
    body: "Prices are in Canadian dollars and exclude HST, shown separately on your invoice. Net-30 terms are available to approved Yugo partner accounts only. All other bookings are payable in full at confirmation.",
  },
  {
    title: "Coverage and declared value",
    body: "Every delivery includes full replacement protection to $10,000. Tell us the declared value of higher-value pieces before pickup so we can protect them accordingly. Our liability for any piece is tied to its declared value and the coverage arranged for it, and excludes indirect or consequential loss.",
  },
  {
    title: "At delivery",
    body: "Yugo carries your goods from the moment we receive them until delivery is complete and your on-site representative has inspected and accepted them. Please have an authorized person present to note any damage on the delivery record at handoff. Concealed damage must be reported within five business days.",
  },
  {
    title: "Access and changes",
    body: "Safe access, parking, elevator reservation, and accurate item and doorway dimensions are the client's responsibility. Changes or cancellations require 48 hours' notice; later changes, failed deliveries, and extended waiting time may incur fees.",
  },
  {
    title: "Governing law",
    body: "These terms are governed by the laws of Ontario, Canada. End-client details are held in confidence. The full Terms & Conditions govern.",
  },
];

/**
 * Full Terms & Conditions sections for the /terms page. Business-grade, Ontario.
 * A solid working draft; the liability, lien, and insurance clauses should be
 * finalized by an Ontario transportation lawyer before a real dispute.
 */
export const B2B_TERMS_FULL: { heading: string; body: string[] }[] = [
  {
    heading: "1. Parties and services",
    body: [
      "These Commercial Terms & Conditions govern the delivery, white-glove handling, and any assembly, installation, or warehouse-receiving services (the \"Services\") provided by Yugo Technologies Inc. (\"Yugo\") to the business client identified on the accepted quote (the \"Client\").",
      "The Services are limited to those itemized on the accepted quote. Unless expressly stated, the Services do not include hard-wired electrical or plumbing connection, mounting into masonry, plaster, or substrates of unknown composition, modification of goods or premises, removal of existing furniture, or storage beyond the scheduled delivery date. Assembly is limited to manufacturer-intended, hand-tool assembly.",
    ],
  },
  {
    heading: "2. Quotes, acceptance, and the agreement",
    body: [
      "Quotes are valid for 14 days unless stated otherwise. A binding agreement is formed when the Client signs or electronically accepts the quote, or permits the Services to commence, whichever occurs first.",
      "These terms, together with the accepted quote and any signed master services agreement, constitute the entire agreement and supersede all prior discussions. Where documents conflict, a signed master services agreement prevails, then the accepted quote, then these terms.",
    ],
  },
  {
    heading: "3. Pricing, taxes, and payment",
    body: [
      "All prices are in Canadian dollars and exclusive of taxes. Harmonized Sales Tax at the prevailing Ontario rate is added and separately stated, and Yugo's HST registration number appears on each invoice.",
      "Net-30 payment terms are extended solely to Clients with a Yugo-approved partner account in good standing, subject to credit approval, and may be revoked at Yugo's discretion. All other Clients pay 100 percent of the quote at booking. Projects exceeding $2,500 require a 50 percent deposit on booking.",
      "Overdue amounts bear interest at 1.5 percent per month. The Client must notify Yugo in writing of any disputed invoice line within ten business days of the invoice date; undisputed amounts remain payable on the original due date.",
    ],
  },
  {
    heading: "4. Risk of loss and completion of delivery",
    body: [
      "Yugo bears risk of physical loss or damage to goods only while in Yugo's custody, beginning on physical receipt at origin and ending on completion of delivery. Delivery is complete when the goods are placed at the delivery point and the Client's authorized recipient has inspected and accepted them, or, absent an authorized recipient after a completed delivery attempt, when the goods are left or returned in accordance with these terms.",
      "Title to the goods remains at all times with the Client or its end-customer. Yugo takes no ownership interest.",
    ],
  },
  {
    heading: "5. Coverage, declared value, and insurance",
    body: [
      "Every delivery includes all-risk full replacement protection to $10,000 per shipment at no additional charge. The Client may declare a higher value before pickup; enhanced coverage to $50,000 per shipment is available for a premium disclosed on the quote, and pieces above $50,000 are scheduled individually with dedicated coverage arranged.",
      "Yugo maintains $5,000,000 commercial general liability and cargo coverage. Certificates of insurance are available on request, same or next business day, and Yugo will, where its policies permit, name the Client or the site owner as additional insured and provide a waiver of subrogation for a specific engagement.",
      "The Client shall maintain its own insurance on the goods. Yugo's coverage is not a substitute for the Client's property or all-risk insurance.",
    ],
  },
  {
    heading: "6. Limitation of liability",
    body: [
      "Except for liability that cannot be limited at law, Yugo's total aggregate liability arising out of the Services, whether in contract, tort including negligence, or otherwise, shall not exceed the greater of the declared value of the affected goods as recorded on the quote and delivery record, or the amount actually recoverable under the coverage arranged for the shipment. Where no value was declared, liability is limited to the fees paid for the affected Services.",
      "Yugo shall not be liable for any indirect, incidental, consequential, special, or punitive damages, including lost profits, loss of use, diminution in value, or claims by the Client's end-customers, even if advised of their possibility.",
    ],
  },
  {
    heading: "7. Inspection and claims",
    body: [
      "The Client's authorized recipient must inspect the goods at delivery and record any visible loss, damage, or shortage on the delivery record before signing. Signing a clean delivery record is conclusive evidence the goods were received in good order except for concealed damage.",
      "Claims for concealed damage must be reported in writing within five business days of completion of delivery. In all cases, written notice of a claim with particulars must be given within 60 days of delivery, and any final statement of claim within nine months of shipment. A claim must include the delivery record, photographs, the item's declared value or invoice, and a repair or replacement estimate.",
    ],
  },
  {
    heading: "8. Client and site responsibilities",
    body: [
      "The Client shall, at its cost and before the scheduled window: secure legal parking and loading-dock access; reserve any service elevator; clear and, where needed, protect access paths and common areas; provide accurate item dimensions and weights in pounds; confirm the goods will fit through all access points; and ensure an authorized recipient is present to inspect and accept the goods.",
      "Yugo is not liable for delay, non-delivery, damage, or added fees resulting from the Client's failure to meet these responsibilities, including where goods do not fit the access route.",
    ],
  },
  {
    heading: "9. Rescheduling, cancellation, and fees",
    body: [
      "Rescheduling or cancellation requires at least 48 hours' notice; later changes incur a fee up to 50 percent of the quote, or 100 percent within 24 hours or after crew dispatch. If delivery cannot be completed due to access failure or no authorized recipient, a failed-delivery fee plus a redelivery charge applies. Waiting time beyond a 15-minute grace period, and storage of goods held due to Client delay, are billed at the rates on the quote.",
    ],
  },
  {
    heading: "10. Assembly and installation",
    body: [
      "Assembly and installation are performed to manufacturer instructions using hand tools. Yugo does not warrant the goods and is not responsible for manufacturer defects or missing or incorrect parts or instructions, pre-existing conditions of the premises, or the suitability or load-bearing capacity of walls, ceilings, or fixtures. Yugo may decline any installation it deems unsafe or outside scope, without liability.",
    ],
  },
  {
    heading: "11. Indemnification",
    body: [
      "Each party shall indemnify and hold harmless the other from third-party claims for bodily injury or physical property damage to the extent caused by its own negligence or breach of these terms. The Client further indemnifies Yugo against claims arising from inaccurate item or access information, unsafe site conditions, or defects in the goods. Neither party indemnifies the other for indirect or consequential damages.",
    ],
  },
  {
    heading: "12. Confidentiality and privacy",
    body: [
      "Each party shall keep confidential the other's non-public information, including the Client's customer lists and the identities, contact details, and delivery addresses of the Client's end-customers, using it solely to perform the Services.",
      "Yugo handles personal information collected for delivery in accordance with Canada's Personal Information Protection and Electronic Documents Act (PIPEDA), maintains reasonable safeguards, does not sell such information, and retains it only as long as needed for the Services and legal recordkeeping.",
    ],
  },
  {
    heading: "13. Force majeure and general",
    body: [
      "Neither party is liable for delay or failure to perform, other than payment obligations, due to causes beyond its reasonable control, including severe weather, labour disruption, road or building closures, or governmental action.",
      "Yugo may subcontract or assign the Services; the Client may not assign without Yugo's written consent. If any provision is unenforceable, the remainder stays in effect. These terms are governed by the laws of Ontario and the federal laws of Canada applicable therein, with disputes resolved by good-faith negotiation, then mediation, then arbitration in Toronto, or the courts of Ontario.",
    ],
  },
];

export const B2B_TERMS_DISCLAIMER =
  "These terms are a working commercial draft. The liability, lien, and insurance provisions should be finalized by an Ontario transportation lawyer before they are relied upon in a dispute.";
