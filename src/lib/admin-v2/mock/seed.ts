import type {
  B2BPartner,
  Building,
  CrewMember,
  Customer,
  CustomerType,
  Invoice,
  InvoiceStatus,
  Lead,
  LeadProbability,
  LeadSource,
  LeadStatus,
  Move,
  MoveStatus,
  PMAccount,
  Quote,
  QuoteStatus,
  ResidentialTier,
  ServiceType,
  Vertical,
} from "./types";

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const DAY = 24 * 60 * 60 * 1000;

export const FIRST_NAMES = [
  "Andy",
  "Emily",
  "Michael",
  "David",
  "Lily",
  "Christopher",
  "Isabella",
  "Sophia",
  "John",
  "Olivia",
  "Daniel",
  "Ava",
  "Matthew",
  "Charlotte",
  "Joshua",
  "Mia",
  "Andrew",
  "Harper",
  "Ryan",
  "Evelyn",
  "Benjamin",
  "Abigail",
  "Samuel",
  "Jacob",
  "Leah",
  "Noah",
  "Chloe",
];

export const LAST_NAMES = [
  "Shepard",
  "Thompson",
  "Carter",
  "Anderson",
  "Hernandez",
  "Wilson",
  "Lopez",
  "Morgan",
  "Davis",
  "Parker",
  "Brooks",
  "Bennett",
  "Reed",
  "Cooper",
  "Foster",
  "Ward",
  "Rivera",
  "Gray",
  "Watson",
  "Price",
];

const SOURCES: { label: LeadSource; external: boolean }[] = [
  { label: "ORGANIC", external: false },
  { label: "SUMMER2", external: true },
  { label: "DTJ25", external: true },
  { label: "SB2024", external: true },
  { label: "AFF20", external: true },
  { label: "REFERRAL", external: false },
  { label: "GOOGLE", external: false },
  { label: "INSTAGRAM", external: false },
];

const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "pre-sale",
  "closing",
  "closed",
  "lost",
];

const PROBABILITIES: LeadProbability[] = ["low", "mid", "high"];

const TIERS: ResidentialTier[] = ["essential", "signature", "estate"];
const SERVICE_TYPES: ServiceType[] = [
  "move",
  "delivery",
  "bin_rental",
  "storage",
];
const QUOTE_STATUSES: QuoteStatus[] = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
];
const MOVE_STATUSES: MoveStatus[] = [
  "draft",
  "scheduled",
  "pre-move",
  "in-transit",
  "completed",
  "cancelled",
];
const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
  "refunded",
];
const VERTICALS: Vertical[] = [
  "furniture_retail",
  "flooring",
  "interior_designer",
  "cabinetry",
  "medical_lab",
  "appliance",
  "art_gallery",
  "restaurant_hospitality",
  "office_commercial",
  "ecommerce_bulk",
  "property_management",
];

const ADDR_STREETS = [
  "Park Ave",
  "Lexington Ave",
  "Columbus Ave",
  "Madison Ave",
  "Amsterdam Ave",
  "Broadway",
  "Canal St",
  "Hudson St",
  "Wall St",
  "Houston St",
];
const ADDR_BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx"];

const pick = <T>(arr: T[], r: () => number): T =>
  arr[Math.floor(r() * arr.length)]!;

const fullName = (r: () => number) =>
  `${pick(FIRST_NAMES, r)} ${pick(LAST_NAMES, r)}`;
const email = (name: string, index: number) =>
  `${name.toLowerCase().replace(/[^a-z]/g, ".")}${index}@gmail.com`;
const phone = (r: () => number) => {
  const n = Math.floor(r() * 9000000) + 1000000;
  return `+1 (212) ${Math.floor(n / 10000)}-${n % 10000}`.replace(
    /(\d{3})(\d+)/,
    "$1 $2",
  );
};
const address = (r: () => number) =>
  `${Math.floor(r() * 900) + 10} ${pick(ADDR_STREETS, r)}, ${pick(ADDR_BOROUGHS, r)}`;

export const generateLeads = (count = 240, seed = 101): Lead[] => {
  const r = mulberry32(seed);
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const name = fullName(r);
    const source = pick(SOURCES, r);
    const probability = pick(PROBABILITIES, r);
    const status = pick(LEAD_STATUSES, r);
    const start = Math.floor(r() * 70) + 25;
    const interest = Array.from({ length: 7 }, () => {
      const swing = (r() - 0.5) * 30;
      return Math.max(8, Math.min(100, start + swing * r() * 3));
    });
    const size = Math.floor(r() * 2_400_000) + 18_000;
    const lastAction = new Date(now - r() * 60 * DAY).toISOString();
    const createdAt = new Date(now - r() * 120 * DAY).toISOString();
    return {
      id: `lead_${index + 1}`,
      name,
      email: email(name, index),
      phone: phone(r),
      source: source.label,
      sourceExternal: source.external,
      status,
      size,
      interest,
      probability,
      lastAction,
      ownerName: pick(FIRST_NAMES, r),
      createdAt,
    };
  });
};

export const generateCustomers = (count = 180, seed = 202): Customer[] => {
  const r = mulberry32(seed);
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const name = fullName(r);
    const type: CustomerType = r() > 0.7 ? (r() > 0.5 ? "b2b" : "pm") : "b2c";
    const vertical = type === "b2c" ? undefined : pick(VERTICALS, r);
    const movesCount = Math.floor(r() * 22) + 1;
    const ltv = movesCount * (Math.floor(r() * 4000) + 1500);
    return {
      id: `cust_${index + 1}`,
      name,
      email: email(name, index),
      phone: phone(r),
      type,
      vertical,
      ltv,
      movesCount,
      lastContactAt: new Date(now - r() * 60 * DAY).toISOString(),
      tags: r() > 0.7 ? ["VIP"] : [],
      createdAt: new Date(now - r() * 400 * DAY).toISOString(),
    };
  });
};

export const generateQuotes = (
  customers: Customer[],
  count = 220,
  seed = 303,
): Quote[] => {
  const r = mulberry32(seed);
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const customer = customers[Math.floor(r() * customers.length)]!;
    const tier = pick(TIERS, r);
    const serviceType = pick(SERVICE_TYPES, r);
    const status = pick(QUOTE_STATUSES, r);
    const total =
      Math.floor(r() * 12000) +
      (tier === "estate" ? 8000 : tier === "signature" ? 3500 : 1200);
    const createdAt = new Date(now - r() * 40 * DAY).toISOString();
    const sentAt =
      status === "draft"
        ? null
        : new Date(new Date(createdAt).getTime() + r() * DAY * 2).toISOString();
    const viewedAt =
      status === "viewed" || status === "accepted" || status === "declined"
        ? new Date(
            new Date(sentAt ?? createdAt).getTime() + r() * DAY * 3,
          ).toISOString()
        : null;
    return {
      id: `quote_${index + 1}`,
      number: `Q-${(10000 + index).toString()}`,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      tier,
      serviceType,
      total,
      status,
      expiresAt: new Date(now + r() * 10 * DAY).toISOString(),
      createdAt,
      sentAt,
      viewedAt,
    };
  });
};

export const generateMoves = (
  customers: Customer[],
  crew: CrewMember[],
  count = 160,
  seed = 404,
): Move[] => {
  const r = mulberry32(seed);
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const customer = customers[Math.floor(r() * customers.length)]!;
    const tier = pick(TIERS, r);
    const serviceType = pick(SERVICE_TYPES, r);
    const status = pick(MOVE_STATUSES, r);
    const crewSize = Math.floor(r() * 3) + 2;
    const crewTeam = Array.from({ length: crewSize }).map(() => {
      const m = crew[Math.floor(r() * crew.length)]!;
      return { id: m.id, name: m.name };
    });
    const scheduledAt = new Date(now + (r() - 0.3) * 30 * DAY).toISOString();
    const total =
      Math.floor(r() * 9000) +
      (tier === "estate" ? 7000 : tier === "signature" ? 3200 : 1100);
    return {
      id: `move_${index + 1}`,
      number: `M-${(20000 + index).toString()}`,
      customerId: customer.id,
      customerName: customer.name,
      organizationId: null,
      tier,
      serviceType,
      status,
      scheduledAt,
      origin: address(r),
      destination: address(r),
      crew: crewTeam,
      truck: r() > 0.3 ? `Truck ${Math.floor(r() * 12) + 1}` : null,
      total,
      onTime: r() > 0.15,
    };
  });
};

export const generateCrew = (count = 36, seed = 505): CrewMember[] => {
  const r = mulberry32(seed);
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const name = fullName(r);
    const role = pick<CrewMember["role"]>(["lead", "mover", "driver"], r);
    const availability = pick<CrewMember["availability"]>(
      ["available", "on-move", "off-duty"],
      r,
    );
    return {
      id: `crew_${index + 1}`,
      name,
      email: email(name, index),
      phone: phone(r),
      role,
      availability,
      rating: Math.round((3.5 + r() * 1.5) * 10) / 10,
      damageRate: Math.round(r() * 2 * 100) / 100,
      movesCompleted: Math.floor(r() * 240) + 20,
      nextAssignmentAt:
        availability === "available"
          ? new Date(now + r() * 10 * DAY).toISOString()
          : null,
    };
  });
};

export const generateInvoices = (moves: Move[], seed = 606): Invoice[] => {
  const r = mulberry32(seed);
  const now = Date.now();
  return moves.slice(0, 140).map((move, index) => {
    const status = pick(INVOICE_STATUSES, r);
    const subtotal = move.total;
    const tax = Math.round(subtotal * 0.08875);
    const total = subtotal + tax;
    const createdAt = new Date(now - r() * 60 * DAY).toISOString();
    return {
      id: `inv_${index + 1}`,
      number: `INV-${(30000 + index).toString()}`,
      customerId: move.customerId,
      customerName: move.customerName,
      moveId: move.id,
      status,
      subtotal,
      tax,
      total,
      dueAt: new Date(new Date(createdAt).getTime() + 14 * DAY).toISOString(),
      paidAt:
        status === "paid" ? new Date(now - r() * 30 * DAY).toISOString() : null,
      createdAt,
    };
  });
};

export const generateB2BPartners = (count = 42, seed = 707): B2BPartner[] => {
  const r = mulberry32(seed);
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const name = `${pick(LAST_NAMES, r)} ${pick(
      [
        "Furniture",
        "Interiors",
        "Flooring",
        "Appliance",
        "Gallery",
        "Hospitality",
        "Co.",
        "Studio",
        "Lab",
      ],
      r,
    )}`;
    return {
      id: `b2b_${index + 1}`,
      name,
      vertical: pick(VERTICALS, r),
      primaryContact: fullName(r),
      email: email(name, index),
      phone: phone(r),
      jobsLast30: Math.floor(r() * 40) + 2,
      revenueLast30: Math.floor(r() * 120000) + 5000,
      onTimePercent: Math.round((0.85 + r() * 0.14) * 100),
      status: pick<B2BPartner["status"]>(["active", "paused", "archived"], r),
      createdAt: new Date(now - r() * 600 * DAY).toISOString(),
    };
  });
};

export const generatePMAccounts = (count = 22, seed = 808): PMAccount[] => {
  const r = mulberry32(seed);
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const name = `${pick(LAST_NAMES, r)} Residential`;
    return {
      id: `pm_${index + 1}`,
      name,
      primaryContact: fullName(r),
      email: email(name, index),
      buildings: Math.floor(r() * 14) + 1,
      movesLast30: Math.floor(r() * 30) + 1,
      contractStatus: pick<PMAccount["contractStatus"]>(
        ["active", "renewal", "lapsed"],
        r,
      ),
      createdAt: new Date(now - r() * 900 * DAY).toISOString(),
    };
  });
};

export const generateBuildings = (
  pmAccounts: PMAccount[],
  count = 64,
  seed = 909,
): Building[] => {
  const r = mulberry32(seed);
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const hasPm = r() > 0.25;
    const pmAccount = hasPm
      ? pmAccounts[Math.floor(r() * pmAccounts.length)]
      : null;
    const complexity = (Math.floor(r() * 5) + 1) as 1 | 2 | 3 | 4 | 5;
    return {
      id: `bldg_${index + 1}`,
      name: `${Math.floor(r() * 900) + 100} ${pick(ADDR_STREETS, r)}`,
      address: address(r),
      pmAccountId: pmAccount?.id ?? null,
      pmAccountName: pmAccount?.name ?? null,
      elevatorConfig: pick<Building["elevatorConfig"]>(
        ["standard", "split_transfer", "multi_transfer"],
        r,
      ),
      complexity,
      movesCompleted: Math.floor(r() * 80),
      lastMoveAt:
        r() > 0.2 ? new Date(now - r() * 120 * DAY).toISOString() : null,
    };
  });
};
