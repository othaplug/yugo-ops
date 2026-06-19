/**
 * Client-facing "what's included" bullets per office tier. The commercial
 * parallel to residential-tier-quote-display. Additive: Signature shows the
 * Essential base plus its IT additions; Priority shows everything.
 *
 * Every tier carries the commercial standards (COI for building management,
 * WSIB on request, $5M CGL, OPS+ tracking, photo docs). There is no electrician
 * / electrical-disconnect line anywhere by design.
 */

import { type OfficeTierKey } from "@/lib/tiers/office-tier-definitions";

/** Standards present on every office tier (after the move-scope lines). */
const OFFICE_STANDARDS: string[] = [
  "Floor, doorway, and elevator protection",
  "Placement per your floor plan",
  "Dedicated project coordinator",
  "$5M commercial general liability insurance",
  "Certificate of Insurance (COI) for building management",
  "WSIB Certificate of Clearance on request",
  "OPS+ real-time tracking for your team",
  "Photo documentation of key items",
];

export interface OfficeIncludesContext {
  crew?: number;
  trucks?: number;
}

function crewLine(ctx: OfficeIncludesContext): string {
  const trucks = ctx.trucks ?? 1;
  const crew = ctx.crew ?? null;
  const truckText = `${trucks} truck${trucks === 1 ? "" : "s"}`;
  return crew
    ? `Professional crew of ${crew} and ${truckText}`
    : `Professional crew and ${truckText}`;
}

/** The client-facing includes list for a given office tier. */
export function officeTierIncludes(
  tier: OfficeTierKey,
  ctx: OfficeIncludesContext = {},
): string[] {
  const move = [
    crewLine(ctx),
    "Furniture wrapping and blanket protection on every piece",
    "Disassembly and reassembly of desks, tables, and monitor arms",
    "Monitor removal and remount",
  ];

  if (tier === "essential") {
    return [
      ...move,
      ...OFFICE_STANDARDS,
      "Your team packs and unpacks",
    ];
  }

  if (tier === "signature") {
    return [
      ...move,
      "Yugo packs and protects all IT and hardware (monitors, TVs, electronics)",
      "IT packing supplies included",
      ...OFFICE_STANDARDS,
      "Your team packs general boxes and unpacks",
    ];
  }

  // priority — full service
  return [
    ...move,
    "Full packing of every box and every item",
    "Full unpacking and setup at your new space",
    "All packing supplies included (bins, boxes, wrap, tape, labels)",
    "Dedicated on-site project manager runs the job",
    "Debris and packing-material removal from both locations",
    ...OFFICE_STANDARDS,
  ];
}
