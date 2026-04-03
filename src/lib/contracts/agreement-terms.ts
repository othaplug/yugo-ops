/**
 * Shared booking / contract agreement copy for ContractSign UI and contract PDFs.
 * Keep financial figures and cancellation text accurate — interpolate from quote payload.
 */

export type AgreementResidentialTier = "essential" | "signature" | "estate";

export type NonBinAgreementBuildParams = {
  serviceType: string;
  packageLabel: string;
  residentialTier: string | null | undefined;
  companyLegalName: string;
  companyDisplayName: string;
  isLogisticsDelivery: boolean;
  b2bNet30Invoice: boolean;
  paidInFullAtBooking: boolean;
  fmtPrice: (n: number) => string;
  grandTotal: number;
  deposit: number;
  balance: number;
  balanceDue: string;
  cancellation: string;
};

function normTier(t: string | null | undefined): AgreementResidentialTier | null {
  const x = (t ?? "").toLowerCase().trim();
  if (x === "essential" || x === "signature" || x === "estate") return x;
  return null;
}

/** Human label for PDF cover + checkbox (not emoji). */
export function agreementDocumentTitle(serviceType: string, residentialTier?: string | null): string {
  if (serviceType === "bin_rental") return "Bin Rental Agreement";
  const tier = normTier(residentialTier);
  if (serviceType === "local_move" && tier === "estate") return "Residential Estate Move Agreement";
  if (serviceType === "local_move" && tier === "signature") return "Residential Signature Move Agreement";
  if (serviceType === "local_move" && tier === "essential") return "Residential Essential Move Agreement";
  const map: Record<string, string> = {
    local_move: "Residential Move Agreement",
    long_distance: "Long Distance Move Agreement",
    office_move: "Office Relocation Agreement",
    single_item: "Delivery Service Agreement",
    white_glove: "White Glove Service Agreement",
    specialty: "Specialty Service Agreement",
    b2b_oneoff: "Commercial Delivery Agreement",
    b2b_delivery: "Commercial Delivery Agreement",
    event: "Event Logistics Agreement",
    labour_only: "Labour Service Agreement",
  };
  return map[serviceType] ?? "Service Agreement";
}

export function agreementCheckboxLabel(serviceType: string, residentialTier?: string | null): string {
  if (serviceType === "bin_rental") return "Bin Rental Agreement";
  const doc = agreementDocumentTitle(serviceType, residentialTier);
  return doc === "Service Agreement" ? "Service Agreement" : doc;
}

function serviceDescription(p: NonBinAgreementBuildParams): string {
  const { serviceType, packageLabel, residentialTier, companyDisplayName } = p;
  const tier = normTier(residentialTier);
  const pkg = packageLabel?.trim() || "your selected package";

  switch (serviceType) {
    case "local_move":
      if (tier === "estate") {
        return `${companyDisplayName} will perform a local residential Estate move for the ${pkg} tier: dedicated coordination, premium handling for high-value furnishings, art, and specialty goods as described in your quote, plus truck, crew, equipment, and loading/unloading between the addresses above.`;
      }
      if (tier === "signature") {
        return `${companyDisplayName} will perform a local residential Signature move for the ${pkg} tier: expanded protection and service inclusions as quoted, including truck, crew, equipment, and loading/unloading between the addresses above.`;
      }
      if (tier === "essential") {
        return `${companyDisplayName} will perform a local residential Essential move for the ${pkg} tier: truck, crew, standard equipment, and loading/unloading between the addresses above, as described in your quote.`;
      }
      return `${companyDisplayName} will provide professional local residential moving services including truck, crew, equipment, and loading/unloading for the ${pkg} scope in your quote.`;
    case "long_distance":
      return `${companyDisplayName} will provide long distance moving services between the origin and destination in your quote, including transport and access as specified (packing, storage, or delivery windows may apply per your quote).`;
    case "office_move":
      return `${companyDisplayName} will relocate your workplace as quoted: furniture, fixtures, and equipment in scope, coordination of origin and destination access, and professional loading and unloading unless your quote states otherwise.`;
    case "single_item":
      return `${companyDisplayName} will pick up and deliver the item(s) described in your quote with professional handling and protection appropriate to the shipment.`;
    case "white_glove":
      return `${companyDisplayName} will provide white glove service as quoted: premium handling, inside placement, optional assembly or debris removal if included in your quote.`;
    case "specialty":
      return `${companyDisplayName} will perform the specialty project in your quote (for example crating, piano, art, or antique handling) according to the agreed scope, crew, and timeline.`;
    case "b2b_oneoff":
    case "b2b_delivery":
      return `${companyDisplayName} will complete the commercial pickup and delivery described in your quote, including handling and documentation as specified.`;
    case "event":
      return `${companyDisplayName} will provide event logistics as quoted: round-trip transport between venues (or legs listed), optional on-site setup or strike, and coordinated return as described.`;
    case "labour_only":
      return `${companyDisplayName} will supply on-site labour at the address and for the tasks in your quote (for example loading, unloading, or staging). Unless your quote explicitly includes transport, this agreement does not cover hauling goods in ${companyDisplayName}'s vehicles.`;
    default:
      return `${companyDisplayName} will provide the services described in your quote.`;
  }
}

/** Industry-standard non-allowables; not legal advice — operational disclosure. */
function prohibitedItemsBody(p: NonBinAgreementBuildParams): string {
  const { companyDisplayName, serviceType, residentialTier } = p;
  const tier = normTier(residentialTier);

  const base = [
    `Unless ${companyDisplayName} agrees in writing beforehand, we do not pack, load, or transport:`,
    "",
    "(a) Dangerous goods and hazardous materials — fuels, oils, solvents, paints and thinners, propane or other compressed gas (except as lawfully exempt), fireworks, ammunition, bulk household chemicals, pesticides, pool chemicals, and similar items regulated or unsafe in a moving vehicle.",
    "",
    "(b) Perishables — refrigerated or frozen food, open food, and other goods that may spoil or attract pests in transit.",
    "",
    "(c) Living plants and animals.",
    "",
    `(d) High-value and irreplaceable articles you should retain personally — cash, negotiable instruments, jewelry and watches (unless declared and coverage is agreed), passports, wills, and other critical originals; and any item you prefer not to place on the truck.`,
    "",
    `(e) Illegal goods or contraband. Firearms and ammunition must not be concealed in shipments; lawful arrangements, if any, must be confirmed in writing before move day.`,
    "",
    `You agree to remove or identify any such items before our arrival. If prohibited or undisclosed goods are presented, ${companyDisplayName} may refuse them, adjust scope per Section 8, or pause service until the issue is resolved.`,
  ];

  if (serviceType === "labour_only") {
    return [
      `On-site crew will not handle dangerous goods or hazardous materials unless disclosed and approved in writing before the service date. You must remove or label fuels, solvents, bulk chemicals, ammunition, and similar items from areas where labour will work.`,
      "",
      ...base.slice(1),
    ].join("\n");
  }

  if (serviceType === "local_move" && tier === "estate") {
    return [
      ...base,
      "",
      `Estate-tier moves: you agree to disclose in writing before move day any fine art, antiques, wine or spirit collections, items of exceptional value, and specialty pieces so ${companyDisplayName} can plan handling, inventory, and valuation coverage. Undisclosed high-value items may be subject to standard released-value limits.`,
    ].join("\n");
  }

  if (serviceType === "specialty" || serviceType === "white_glove") {
    return [
      ...base,
      "",
      `Because this booking includes specialty or white glove handling, you agree to list condition notes, existing damage, and any conservation or installation requirements in writing before service. Packing of hazardous or perishable contents inside crated or blanket-wrapped pieces remains your responsibility unless explicitly contracted.`,
    ].join("\n");
  }

  return base.join("\n");
}

function clientResponsibilitiesBody(p: NonBinAgreementBuildParams): string {
  const { companyDisplayName, serviceType, isLogisticsDelivery } = p;

  if (isLogisticsDelivery) {
    return `You are responsible for: (a) accurate shipment descriptions, dimensions, weights, and special handling needs; (b) declaring individual items above $500 in value when required for coverage; (c) safe pickup and delivery access (dock or door, elevator bookings, parking, permits, clear paths); (d) removing or identifying hazardous materials, perishables, and prohibited items ${companyDisplayName} cannot transport. Omissions may require scope or price adjustments as agreed in writing.`;
  }

  if (serviceType === "office_move") {
    return `You are responsible for: (a) an accurate inventory of furniture, equipment, and materials in scope; (b) IT disconnect/reconnect planning with your vendors unless ${companyDisplayName} is contracted for IT services; (c) building access, elevator reservations, parking, and clear paths at origin and destination; (d) identifying hazardous, confidential destruction, or prohibited items ${companyDisplayName} cannot move. Omissions may require schedule or scope adjustments as agreed in writing.`;
  }

  if (serviceType === "long_distance") {
    return `You are responsible for: (a) accurate item lists and declared value for coverage; (b) compliance with any origin or destination access rules (elevators, long carry, parking); (c) removing perishables, hazardous materials, and prohibited items from the shipment; (d) being available or designating an authorized representative at delivery. Changes to delivery windows or storage may affect pricing as agreed in writing.`;
  }

  if (serviceType === "event") {
    return `You are responsible for: (a) accurate manifests for outbound and return legs; (b) venue access, load-in windows, permits, and on-site contact; (c) ensuring no hazardous, pyrotechnic, or illegal materials are included without prior written approval; (d) confirming floor protection or venue rules are satisfied before crew arrival. Failures may delay service or require additional charges if approved in writing.`;
  }

  if (serviceType === "labour_only") {
    return `You are responsible for: (a) a safe, lawful work area; (b) accurate description of items to be handled and any weight or access limitations; (c) removing hazardous materials from the work area; (d) supervising fragile or sentimental items you choose to move yourself. ${companyDisplayName} is not liable for conditions not disclosed before the crew arrives.`;
  }

  if (serviceType === "specialty") {
    return `You are responsible for: (a) disclosing dimensions, weight, structural condition, and path constraints (stairs, turns, surface protection); (b) securing permits or building approvals if required; (c) removing hazardous materials from the piece or area; (d) declaring value for insurance purposes when requested. Undisclosed conditions may require pausing work until resolved.`;
  }

  return `You are responsible for: (a) accurately disclosing all items to be moved, including dimensions and special handling; (b) declaring items valued above $500 individually when required for coverage; (c) building elevator bookings, parking, permits, and clear access at both locations; (d) removing or identifying hazardous materials, perishables, and prohibited items ${companyDisplayName} cannot transport. Failure to disclose access or inventory details may result in scope adjustments as agreed in writing.`;
}

export function buildNonBinAgreementSections(p: NonBinAgreementBuildParams): { title: string; body: string }[] {
  const {
    companyLegalName,
    companyDisplayName,
    b2bNet30Invoice,
    paidInFullAtBooking,
    fmtPrice,
    grandTotal,
    deposit,
    balance,
    balanceDue,
    cancellation,
  } = p;

  const paymentBody = b2bNet30Invoice
    ? `This service is confirmed on Net 30 invoice terms. The total quoted (${fmtPrice(grandTotal)} incl. HST) will appear on your invoice; no card payment is collected through this booking flow unless you approve otherwise in writing.`
    : paidInFullAtBooking
      ? `The full amount of ${fmtPrice(grandTotal)} (incl. HST) is due when you complete checkout after signing. No balance remains for this quoted scope unless you approve changes in writing. Payment will be charged to the card provided.`
      : `A deposit of ${fmtPrice(deposit)} is due when you complete booking after signing. The remaining balance of ${fmtPrice(balance)} is due ${balanceDue}. Payment will be charged to the card provided.`;

  const authBody = b2bNet30Invoice
    ? `You agree to pay the quoted total per the invoice issued by ${companyLegalName}, within the Net 30 terms stated on your quote. Any late fees or collection practices follow the commercial policy shared with your account.`
    : `I authorize ${companyLegalName} to securely store my payment card on file using Square's PCI-compliant vault and to charge the balance per the payment terms above. No additional charges will be made without prior authorization.`;

  const scopeNoun = p.isLogisticsDelivery ? "delivery" : p.serviceType === "labour_only" ? "labour" : "move";

  return [
    {
      title: "1. Service description",
      body: serviceDescription(p),
    },
    {
      title: "2. Quoted price guarantee",
      body: `The total quoted above (${fmtPrice(grandTotal)} incl. HST) is the agreed price for the ${scopeNoun} scope in your quote, provided access, inventory, and conditions match what was disclosed. There are no hidden surcharges beyond this package except changes you approve in writing.`,
    },
    {
      title: "3. Payment terms",
      body: paymentBody,
    },
    {
      title: b2bNet30Invoice ? "4. Invoicing" : "4. Card-on-file authorization",
      body: authBody,
    },
    {
      title: "5. Cancellation policy",
      body: cancellation,
    },
    {
      title: "6. Liability and insurance",
      body: `Standard cargo liability applies at $0.60 per pound per article unless upgraded coverage is purchased and noted on your quote. ${companyDisplayName} carries $2,000,000 in commercial liability insurance. Enhanced valuation or full-value protection, when selected, is governed by the add-on terms on your quote.`,
    },
    {
      title: "7. Items we do not pack, load, or transport",
      body: prohibitedItemsBody(p),
    },
    {
      title: "8. Scope changes",
      body: `If the actual scope differs from the quote (for example additional items, undisclosed access, weight or cube over the agreed inventory, or conditions beyond our reasonable control), ${companyDisplayName} will explain the impact and obtain your written approval before additional charges apply.`,
    },
    {
      title: "9. Claims and damage reporting",
      body: `Any claim for loss or damage must be reported in writing within 48 hours of completion of ${scopeNoun} service. Late reports may limit eligibility. ${companyDisplayName} will investigate promptly under the coverage that applies to your booking.`,
    },
    {
      title: "10. Your responsibilities",
      body: clientResponsibilitiesBody(p),
    },
    {
      title: "11. Delays and force majeure",
      body: `${companyDisplayName} is not liable for delays caused by events beyond its reasonable control, including severe weather, road closures, traffic, elevator failures, labour disruptions, or government restrictions. We will notify you and reschedule at the earliest reasonable time without penalty except where third-party costs cannot be avoided.`,
    },
  ];
}

export type BinAgreementBuildParams = {
  companyLegalName: string;
  companyDisplayName: string;
  fmtPrice: (n: number) => string;
  grandTotal: number;
  cancellation: string;
  cycleDays: number;
  hasScheduleDetails: boolean;
};

export function buildBinRentalAgreementSections(p: BinAgreementBuildParams): { title: string; body: string }[] {
  const { companyLegalName, companyDisplayName, fmtPrice, grandTotal, cancellation, cycleDays, hasScheduleDetails } =
    p;

  return [
    {
      title: "1. Bin rental service",
      body: `Plastic moving bin rental: delivery of empty bins to your location, use through the included rental period, and scheduled pickup of emptied and stacked bins, as described in your quote. Wardrobe boxes supplied for move day are returned at pickup unless otherwise noted on your quote.`,
    },
    {
      title: "2. Quoted fee and scope",
      body: `The total shown (${fmtPrice(grandTotal)} incl. HST) is the agreed price for the bin rental package in your quote (counts, accessories, delivery and pickup, and included rental period). This is equipment rental, not a full staffed residential move unless separately contracted. Additional bins or extended rental require written confirmation before charges.`,
    },
    {
      title: "3. Delivery, pickup, and rental period",
      body: hasScheduleDetails
        ? `Delivery, your reference move date, pickup, and the ${cycleDays}-day included rental cycle are summarized on your booking. Bins must be emptied, stacked, and ready at the agreed location. Late returns, no-shows, or unprepared pickups may incur fees as stated in your quote or confirmed in writing.`
        : `Delivery and pickup dates and the included rental period are as stated in your quote. Bins must be emptied, stacked, and ready for pickup. Late returns or unprepared pickups may incur fees as stated in your quote or confirmed in writing.`,
    },
    {
      title: "4. Payment",
      body: `Full payment of ${fmtPrice(grandTotal)} (incl. HST) is due when you complete checkout after signing unless your coordinator confirms different terms in writing.`,
    },
    {
      title: "5. Card on file",
      body: `I authorize ${companyLegalName} to keep my payment card on file through Square's PCI-compliant systems and to charge fees I approve in writing, including reasonable charges for late returns, extra rental days, missing bins, or damaged equipment, consistent with your quote and applicable law.`,
    },
    {
      title: "6. Cancellation",
      body: cancellation,
    },
    {
      title: "7. Care of bins and equipment",
      body: `Bins remain ${companyDisplayName}'s property. Use them only for normal household packing, return all bins and ties supplied, and report loss or damage promptly. Repair or replacement fees may apply as set out in your quote.`,
    },
    {
      title: "8. Liability and insurance",
      body: `This agreement covers rental logistics, not full moving valuation. ${companyDisplayName} maintains commercial liability insurance; details on request. Contents you place inside bins are your responsibility unless separate moving services are contracted.`,
    },
    {
      title: "9. Prohibited bin contents",
      body: `Do not place hazardous materials (fuels, solvents, paints, pesticides, ammunition, propane), perishable food, liquids that may leak, live animals, or illegal items in bins. You are responsible for contents; ${companyDisplayName} may refuse pickup or charge remediation if prohibited items are discovered.`,
    },
    {
      title: "10. Access and your responsibilities",
      body: `You are responsible for safe, legal access for delivery and pickup (parking, elevator bookings, entry, and someone available or instructions as agreed). Do not overload bins beyond a safe carrying weight.`,
    },
    {
      title: "11. Delays and rescheduling",
      body: `${companyDisplayName} is not liable for delays caused by weather, traffic, building access, or other circumstances outside its reasonable control. We will reschedule delivery or pickup as soon as practicable. Client-requested changes or repeated access failures may incur additional costs if agreed in writing.`,
    },
  ];
}
