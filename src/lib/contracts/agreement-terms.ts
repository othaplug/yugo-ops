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
        return `${companyDisplayName} will deliver an Estate-tier local residential move for the ${pkg} package: a private moving experience with dedicated coordination, pre-move walkthrough, white-glove handling for fine furnishings, art, and specialty pieces, full packing materials and supplies as quoted, precision placement, and 30-day concierge support, with truck, crew, equipment, and careful loading and unloading between the residences above.`;
      }
      if (tier === "signature") {
        return `${companyDisplayName} will deliver a Signature-tier local residential move for the ${pkg} package: full-service handling with complete furniture wrapping, room-of-choice placement, mattress and TV protection, debris removal, and enhanced valuation coverage as quoted, with truck, crew, equipment, and attentive loading and unloading between the addresses above.`;
      }
      if (tier === "essential") {
        return `${companyDisplayName} will deliver an Essential-tier local residential move for the ${pkg} package: efficient, professional handling with protective wrapping for key furniture, basic disassembly and reassembly, standard floor protection, truck, crew, standard equipment, and loading and unloading between the addresses above, as described in your quote.`;
      }
      return `${companyDisplayName} will provide a carefully scoped local residential move for the ${pkg} package (truck, crew, equipment, and loading and unloading) as described in your quote.`;
    case "long_distance":
      return `${companyDisplayName} will oversee your long-distance relocation between the origin and destination in your quote, including transport and access as specified (packing, storage, or delivery timing may apply per your quotation).`;
    case "office_move":
      return `${companyDisplayName} will relocate your workplace with the same care we bring to private homes: furniture, fixtures, and equipment within scope, coordinated access at origin and destination, and professional loading and unloading unless your quote states otherwise.`;
    case "single_item":
      return `${companyDisplayName} will collect and deliver the piece(s) in your quote with measured handling and protection suited to your items.`;
    case "white_glove":
      return `${companyDisplayName} will provide white-glove service as quoted: refined handling, inside placement, and optional assembly or debris removal where included.`;
    case "specialty":
      return `${companyDisplayName} will execute the specialty engagement in your quote (for example crating, piano, art, or antique work) according to the agreed scope, crew, and schedule.`;
    case "b2b_oneoff":
    case "b2b_delivery":
      return `${companyDisplayName} will complete the commercial pickup and delivery in your quote with the documentation and handling standards specified.`;
    case "event":
      return `${companyDisplayName} will manage your event logistics end to end, as quoted: a dedicated crew that handles delivery, on-site placement, optional setup, and the post-event strike and return across the date(s) and leg(s) in your quote. Every piece is inventoried, wrapped, and protected; load-in and load-out are run to the windows and access rules of your venue; and a coordinator stays reachable through both the delivery and return days. Round trips are handled by the same team so nothing is re-briefed, executed with the same precision and discretion we bring to a private estate move.`;
    case "labour_only":
      return `${companyDisplayName} will place an on-site crew at the address for the tasks in your quote (for example loading, unloading, or staging). Unless your quote explicitly includes transport, this agreement does not cover moving goods in ${companyDisplayName}'s vehicles.`;
    default:
      return `${companyDisplayName} will provide the services described in your quote, executed to the standard you expect from us.`;
  }
}

/** Industry-standard non-allowables; not legal advice — operational disclosure. */
function prohibitedItemsBody(p: NonBinAgreementBuildParams): string {
  const { companyDisplayName, serviceType, residentialTier, isLogisticsDelivery } = p;
  const tier = normTier(residentialTier);
  const carryScope = isLogisticsDelivery ? "every shipment we carry" : "every move we carry";
  const concealPhrase = isLogisticsDelivery
    ? "concealed in a shipment"
    : "concealed among the goods we are moving";

  const base = [
    `For the safety of your home, our team, and ${carryScope}, the following categories fall outside what we pack, load, or transport unless ${companyDisplayName} confirms otherwise in writing:`,
    "",
    "(a) Dangerous goods and hazardous materials: fuels, oils, solvents, paints and thinners, propane or other compressed gas (except where lawfully exempt), fireworks, ammunition, bulk household chemicals, pesticides, pool chemicals, and similar items that are regulated or unsafe aboard our vehicles.",
    "",
    "(b) Perishables: refrigerated or frozen food, open food, and anything that may spoil or attract pests en route.",
    "",
    "(c) Living plants and animals.",
    "",
    `(d) Irreplaceable valuables best kept with you: cash, negotiable instruments, jewelry and watches (unless declared and coverage is agreed), passports, wills, and other essential originals; and any piece you would prefer not to entrust to the truck.`,
    "",
    `(e) Illegal goods or contraband. Firearms and ammunition must never be ${concealPhrase}; any lawful arrangement must be confirmed in writing before move day.`,
    "",
    `We ask that you remove or clearly identify these items before we arrive. Should prohibited or undisclosed goods appear, ${companyDisplayName} may decline them, adjust scope under Section 8, or pause service until the matter is resolved, with your comfort and our duty of care both in mind.`,
  ];

  if (serviceType === "labour_only") {
    return [
      `Our crew will not handle dangerous goods or hazardous materials unless disclosed and approved in writing before the service date. Please remove or clearly label fuels, solvents, bulk chemicals, ammunition, and similar items from any area where our team will work.`,
      "",
      ...base.slice(1),
    ].join("\n");
  }

  if (serviceType === "local_move" && tier === "estate") {
    return [
      ...base,
      "",
      `Estate-tier service: please share in writing, before move day, any fine art, antiques, wine or spirits collections, items of exceptional value, and specialty pieces so we may plan handling, inventory, and valuation with the attention they deserve. Pieces not disclosed may be subject to standard released-value limits.`,
    ].join("\n");
  }

  if (serviceType === "specialty" || serviceType === "white_glove") {
    return [
      ...base,
      "",
      `With specialty or white-glove work, we ask for written condition notes, existing damage, and any conservation or installation requirements before we begin. Hazardous or perishable contents packed inside crated or blanket-wrapped pieces remain your responsibility unless we have explicitly agreed otherwise.`,
    ].join("\n");
  }

  return base.join("\n");
}

function clientResponsibilitiesBody(p: NonBinAgreementBuildParams): string {
  const { companyDisplayName, serviceType, isLogisticsDelivery } = p;

  if (isLogisticsDelivery) {
    return `To honor the delivery we quoted, you agree to: (a) provide accurate shipment descriptions, dimensions, weights, and any special handling notes; (b) declare individual items above $500 in value when required for coverage; (c) ensure gracious access for pickup and delivery (dock or door, elevator bookings, parking, permits, and clear paths); (d) remove or flag hazardous materials, perishables, and items ${companyDisplayName} cannot carry. Omissions may call for scope or investment adjustments, always confirmed with you in writing.`;
  }

  if (serviceType === "office_move") {
    return `To keep your relocation seamless, you agree to: (a) share an accurate inventory of furniture, equipment, and materials in scope; (b) coordinate IT disconnect and reconnect with your vendors unless ${companyDisplayName} is engaged for IT work; (c) arrange building access, elevator reservations, parking, and unobstructed paths at origin and destination; (d) identify hazardous, confidential-destruction, or prohibited items we cannot move. Omissions may affect schedule or scope and will be addressed transparently in writing.`;
  }

  if (serviceType === "long_distance") {
    return `For a long-distance move done well, you agree to: (a) provide accurate item lists and declared values for coverage; (b) respect origin and destination access rules (elevators, long carry, parking); (c) clear perishables, hazardous materials, and prohibited items from the move; (d) be present or name an authorized representative at delivery. Changes to windows or storage may adjust pricing only with your written approval.`;
  }

  if (serviceType === "event") {
    return `For an event executed without friction, you agree to: (a) supply accurate manifests for outbound and return legs; (b) secure venue access, load-in windows, permits, and a reliable on-site contact; (c) ensure no hazardous, pyrotechnic, or illegal materials are included without prior written consent; (d) confirm floor protection and venue rules are satisfied before our crew arrives. Shortfalls may delay service or incur additional costs only as agreed in writing.`;
  }

  if (serviceType === "labour_only") {
    return `You agree to: (a) maintain a safe, lawful workspace; (b) describe items and any weight or access limits honestly; (c) remove hazardous materials from the work area; (d) personally oversee fragile or sentimental pieces you wish to carry yourself. ${companyDisplayName} cannot be responsible for conditions we were not told about before the crew arrives.`;
  }

  if (serviceType === "specialty") {
    return `You agree to: (a) disclose dimensions, weight, structural condition, and path constraints (stairs, turns, surface protection); (b) obtain permits or building approvals where required; (c) clear hazardous materials from the piece or area; (d) declare value for insurance when we request it. Conditions we learn only on site may require a thoughtful pause until resolved.`;
  }

  return `You agree to: (a) disclose every item to be moved, with dimensions and special handling needs; (b) declare items valued above $500 individually when coverage requires it; (c) arrange elevator bookings, parking, permits, and clear access at both homes; (d) remove or identify hazardous materials, perishables, and items ${companyDisplayName} cannot transport. Surprises on access or inventory may lead to scope adjustments, always discussed and confirmed with you in writing.`;
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
    ? `Your booking is confirmed on Net 30 invoice terms. The total we quoted (${fmtPrice(grandTotal)} incl. HST) will appear on your invoice; no card is taken through this step unless you direct otherwise in writing.`
    : paidInFullAtBooking
      ? `The full investment of ${fmtPrice(grandTotal)} (incl. HST) is due when you complete checkout after signing. Nothing further is owed on this quoted scope unless you approve a change in writing. We will charge the card you provide.`
      : `A deposit of ${fmtPrice(deposit)} secures your date when you complete booking after signing. The remaining balance of ${fmtPrice(balance)} is due ${balanceDue}. We will charge the card you provide according to these terms.`;

  const authBody = b2bNet30Invoice
    ? `You agree to remit the quoted total on the invoice from ${companyLegalName}, within the Net 30 terms on your quote. Any late fees or collection steps follow the commercial policy already shared with your account.`
    : `I authorize ${companyLegalName} to keep my payment card on file through Square's secure, PCI-compliant vault and to charge the balance according to the payment terms above. Nothing further is charged without your prior approval.`;

  const scopeNoun = p.isLogisticsDelivery ? "delivery" : p.serviceType === "labour_only" ? "labour" : "move";

  const liabilityTier = normTier(p.residentialTier);
  const liabilityBody =
    p.serviceType === "local_move" && liabilityTier === "estate"
      ? `Valuation coverage is included with your Estate package. Eligible claims may be resolved through repair by verified professional restorers, replacement with an equivalent item at current market value, or a full cash settlement. Per-item coverage up to $10,000; per move up to $100,000. Zero deductible. Items valued over $10,000 may be individually declared for additional coverage. ${companyDisplayName} maintains $5,000,000 in commercial liability insurance.`
      : p.serviceType === "local_move" && liabilityTier === "signature"
        ? `Enhanced declared-value coverage is included with your Signature package, providing full declared value protection up to $50,000 per move. Per-item coverage up to $2,500. ${companyDisplayName} maintains $5,000,000 in commercial liability insurance.`
        : p.serviceType === "local_move" && liabilityTier === "essential"
          ? `Released-value cargo liability applies at $0.60 per pound per article unless you purchase upgraded coverage shown on your quote. ${companyDisplayName} maintains $5,000,000 in commercial liability insurance. Where you select enhanced valuation or full-value protection, those terms on your quote govern.`
          : p.serviceType === "white_glove"
            ? `Standard Protection is included with your White Glove service: cargo liability at $5.00 per pound per article, total coverage up to $30,000, zero deductible. Eligible claims are resolved through full repair of any damaged item, or replacement at current market value where repair is not possible. Where you select an enhanced or full-replacement coverage rider shown on your quote, those terms govern. ${companyDisplayName} maintains $5,000,000 in commercial liability insurance.`
            : p.serviceType === "office_move"
              ? `Commercial cargo liability applies to the furniture, equipment, and materials in your quote, with eligible claims resolved through full repair, or replacement at current market value where repair is not possible. ${companyDisplayName} carries $5,000,000 in commercial general liability insurance, and on request provides a Certificate of Insurance (COI) naming your building management along with a WSIB Certificate of Clearance. This coverage protects the physical handling of your property; it does not extend to business interruption, downtime, lost revenue, or consequential or indirect losses arising from the relocation. Where you declare individual high-value items or select upgraded coverage shown on your quote, those terms govern.`
              : p.serviceType === "event"
                ? `Standard Protection is included with your event: cargo liability at $5.00 per pound per article, total coverage up to $30,000, zero deductible. Eligible claims are resolved through full repair of any damaged item, or replacement at current market value where repair is not possible. High-value production, staging, or AV equipment should be individually declared before the event so we can plan handling and coverage; pieces not declared are subject to the standard limits above. Where you select an enhanced coverage rider shown on your quote (for example $50,000 or $100,000 event value), those terms govern. ${companyDisplayName} maintains $5,000,000 in commercial liability insurance and, on request, provides a Certificate of Insurance naming your venue.`
                : `Released-value cargo liability applies at $0.60 per pound per article unless you purchase upgraded coverage shown on your quote. ${companyDisplayName} maintains $5,000,000 in commercial liability insurance. Where you select enhanced valuation or full-value protection, those terms on your quote govern.`;

  const sections: { title: string; body: string }[] = [
    {
      title: "1. Service Description",
      body: serviceDescription(p),
    },
    {
      title: "2. Your Quoted Investment",
      body: `The total above (${fmtPrice(grandTotal)} incl. HST) is the agreed price for the ${scopeNoun} we outlined in your quote, provided access, inventory, and conditions match what you shared with us. There are no hidden surcharges in this package beyond changes you approve in writing.`,
    },
    {
      title: "3. Payment Terms",
      body: paymentBody,
    },
    {
      title: b2bNet30Invoice ? "4. Invoicing" : "4. Card-on-File Authorization",
      body: authBody,
    },
    {
      title: "5. Cancellation Policy",
      body: cancellation,
    },
    {
      title: "6. Liability and Insurance",
      body: liabilityBody,
    },
    {
      title: "7. What We Do Not Pack or Transport",
      body: prohibitedItemsBody(p),
    },
    {
      title: "8. Changes to Scope",
      body: `Should the day-of reality differ from the quote (additional pieces, access we were not told about, weight or volume beyond the agreed inventory, or circumstances outside reasonable control), ${companyDisplayName} will walk you through the impact and secure your written approval before any further charges apply.`,
    },
    {
      title: "9. Claims and Care of Your Goods",
      body: `Please report any loss or damage in writing within 48 hours of ${scopeNoun} completion. Later notice may limit what we can resolve. ${companyDisplayName} will review every claim promptly under the coverage that applies to your booking.`,
    },
    {
      title: "10. Your Part in a Smooth Experience",
      body: clientResponsibilitiesBody(p),
    },
    {
      title: "11. When the Unexpected Happens",
      body: `${companyDisplayName} cannot be responsible for delays arising from events outside reasonable control: severe weather, road closures, traffic, elevator outages, labour disruptions, or government orders. We will reach out quickly and reschedule for the earliest suitable time, without penalty on our side except where unavoidable third-party costs apply.`,
    },
  ];

  // Office / commercial relocations carry three additional clauses that matter
  // to building management and to a business in motion. These mirror what
  // high-end commercial movers warrant: COI + WSIB for the building, clear
  // handling of technology and data, and a business-continuity boundary.
  if (p.serviceType === "office_move") {
    sections.push(
      {
        title: "12. Certificate of Insurance and Building Access",
        body: `On request, ${companyDisplayName} will issue a Certificate of Insurance (COI) naming your building management, along with a WSIB Certificate of Clearance, in time for your freight-elevator and loading-dock bookings. You agree to confirm each building's requirements and to reserve the freight elevator and loading dock, submit any COI to building management by their deadline, complete contractor registration where required, and secure approved after-hours or weekend access windows at both the origin and destination. ${companyDisplayName} is not responsible for delays caused by building access, elevator availability, or documentation that was not arranged in time.`,
      },
      {
        title: "13. Technology and Data",
        body: `Where ${companyDisplayName} is engaged to handle IT and hardware, our crew safely disconnects, protects, transports, and reinstalls your equipment to its labeled destination. You remain responsible for backing up all data before move day and for any software, server, or network reconfiguration. ${companyDisplayName} is not responsible for data loss, software faults, or telecom and connectivity provisioning. We recommend verified backups before the move and that your team retains custody of confidential, sensitive, or high-security materials.`,
      },
      {
        title: "14. Business Continuity",
        body: `${companyDisplayName} will work to the schedule and floor plan agreed with you to keep disruption to a minimum, with a dedicated coordinator as your single point of contact. Our responsibility is limited to the careful physical handling of your property under the coverage above. We are not liable for business interruption, downtime, lost revenue, or third-party costs (including telecom or internet provisioning) arising from the relocation.`,
      },
    );
  }

  // Events carry three additional clauses that matter for date-critical,
  // venue-bound work: venue access + COI + compliance, the setup/strike and
  // standby scope, and the timing/postponement boundary an event demands.
  if (p.serviceType === "event") {
    sections.push(
      {
        title: "12. Venue Access, Certificate of Insurance and Compliance",
        body: `You agree to secure, and to share with ${companyDisplayName} in advance, everything our crew needs to enter and work at each venue: confirmed load-in and load-out windows, dock or freight-elevator reservations, parking or staging areas, gate or security clearance, and any building or municipal permits. On request, ${companyDisplayName} will issue a Certificate of Insurance naming the venue in time for its deadline. You are responsible for confirming and meeting each venue's rules, including floor and surface protection, noise or curfew limits, union or house-labour requirements, and any hard vacate time. ${companyDisplayName} is not responsible for delays, denied access, or fees arising from venue requirements, access, or documentation that were not arranged in time, and where a venue imposes a hard cutoff we will prioritize a safe, on-time exit over unfinished non-essential tasks.`,
      },
      {
        title: "13. Setup, Strike and On-Site Standby",
        body: `Where your quote includes setup or strike (teardown), ${companyDisplayName} will place, assemble, and later dismantle and return the items in scope to their original condition and location, using the equipment quoted (which may include dollies, pallet jacks, or a liftgate truck for palletized freight). Our scope is the physical logistics of your items; it does not include the design, programming, rigging, electrical, or operation of third-party production, staging, or AV systems unless expressly quoted. If our crew is held on site beyond the scheduled window because a venue, vendor, or space is not ready, standby (wait) time may apply at the rate on your quote, always confirmed with you before it accrues. Please designate an on-site contact empowered to make decisions during load-in and load-out.`,
      },
      {
        title: "14. Event Timing, Postponement and Force Majeure",
        body: `An event is date-critical, and ${companyDisplayName} plans crew and fleet around your specific window. Deposits secure that reserved capacity; the cancellation terms in Section 5 reflect the commitments we make on your behalf ahead of the date. Should you need to postpone, we will make every reasonable effort to transfer your booking to a new date subject to availability, and any date-driven price difference will be confirmed with you in writing. ${companyDisplayName} cannot be responsible for delays or losses arising from causes outside reasonable control, including severe weather, road or venue closures, power or elevator outages, labour disruptions, permit or government orders, or a venue's failure to open or provide agreed access. In such cases we will communicate quickly and work with you to reschedule for the earliest suitable time, without penalty on our side except where unavoidable third-party costs apply.`,
      },
    );
  }

  return sections;
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
      title: "1. Bin Rental Service",
      body: `A refined alternative to cardboard: premium plastic moving bins, delivered empty to your door, yours through the included rental period, then collected once emptied and neatly stacked, exactly as described in your quote. Wardrobe boxes supplied for move day return with pickup unless your quote notes otherwise.`,
    },
    {
      title: "2. Your Quoted Investment",
      body: `The total shown (${fmtPrice(grandTotal)} incl. HST) covers the bin program in your quote: quantities, accessories, delivery, pickup, and the rental window. This is equipment rental, not a full staffed residential move unless you have engaged us separately. Extra bins or extended time are confirmed in writing before any charge.`,
    },
    {
      title: "3. Delivery, Pickup, and Timing",
      body: hasScheduleDetails
        ? `Delivery, your reference move date, pickup, and the ${cycleDays}-day rental cycle appear on your booking summary. Please have bins emptied, stacked, and ready at the agreed location. Late returns, missed appointments, or unprepared pickups may incur fees as your quote describes or as we confirm with you in writing.`
        : `Delivery and pickup dates and your rental window are set out in your quote. Please have bins emptied, stacked, and ready. Late returns or unprepared pickups may incur fees as quoted or as confirmed in writing.`,
    },
    {
      title: "4. Payment",
      body: `The full amount of ${fmtPrice(grandTotal)} (incl. HST) is due when you complete checkout after signing, unless your coordinator arranges different terms in writing.`,
    },
    {
      title: "5. Card on File",
      body: `I authorize ${companyLegalName} to retain my card on file through Square's secure, PCI-compliant systems and to charge only what you approve in writing, fairly, for example, for late returns, extra rental days, missing bins, or damaged equipment, in line with your quote and the law.`,
    },
    {
      title: "6. Cancellation",
      body: cancellation,
    },
    {
      title: "7. Caring for the Bins",
      body: `The bins remain ${companyDisplayName}'s property. Use them for ordinary household packing, return every bin and tie we supplied, and tell us promptly about loss or damage. Repair or replacement may be billed as your quote explains.`,
    },
    {
      title: "8. Liability and Insurance",
      body: `This agreement covers rental logistics, not the full valuation stack of a staffed move. ${companyDisplayName} carries commercial liability insurance; we are happy to share particulars on request. What you pack inside the bins stays your responsibility unless you have contracted separate moving coverage.`,
    },
    {
      title: "9. What Not to Place in Bins",
      body: `Please keep hazardous materials (fuels, solvents, paints, pesticides, ammunition, propane), perishable food, liquids that could leak, live animals, and illegal items out of the bins. You remain responsible for contents; if prohibited items appear, ${companyDisplayName} may decline pickup or apply remediation charges as appropriate.`,
    },
    {
      title: "10. Access and Your Home",
      body: `Kindly ensure safe, lawful access for delivery and pickup: parking, elevator bookings, entry, and someone on hand or clear instructions as agreed. For the crew's safety, do not overload bins beyond a comfortable carrying weight.`,
    },
    {
      title: "11. Delays and Rescheduling",
      body: `${companyDisplayName} cannot be held liable for delays caused by weather, traffic, building access, or other matters outside reasonable control. We will reconnect with you and reschedule as soon as we can. Changes you request, or repeated access issues, may carry additional cost only when agreed in writing.`,
    },
  ];
}
