// DB -> admin-v2 domain mappers. UI types intentionally use a narrower
// enum set than the raw DB enums so the chips/filters stay stable. Every
// raw DB value must land in exactly one bucket here.

import type {
  B2BPartner,
  Building,
  BuildingConfig,
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
} from "../mock/types";

type Maybe<T> = T | null | undefined;

const str = (value: Maybe<unknown>): string => {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
};

const num = (value: Maybe<unknown>, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const iso = (value: Maybe<unknown>): string => {
  if (!value) return new Date(0).toISOString();
  const d = new Date(str(value));
  return Number.isNaN(d.getTime())
    ? new Date(0).toISOString()
    : d.toISOString();
};

const isoOrNull = (value: Maybe<unknown>): string | null => {
  if (!value) return null;
  const d = new Date(str(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// ---------- Lead ----------

// DB statuses -> UI pipeline buckets. Comment every transition so the
// mapping stays auditable (`no-db-vars-in-ui.mdc`).
const mapLeadStatus = (raw: Maybe<string>): LeadStatus => {
  switch (str(raw).toLowerCase()) {
    case "new":
    case "assigned":
    case "follow_up_sent":
    case "awaiting_reply":
      return "new";
    case "contacted":
    case "qualified":
    case "follow_up":
      return "pre-sale";
    case "quote_sent":
      return "closing";
    case "converted":
      return "closed";
    case "lost":
    case "disqualified":
    case "stale":
      return "lost";
    default:
      return "new";
  }
};

const mapLeadSource = (raw: Maybe<string>): LeadSource => {
  const key = str(raw).toLowerCase();
  if (key === "google_ads") return "GOOGLE";
  if (key === "social_media") return "INSTAGRAM";
  if (key === "referral" || key === "partner_referral" || key === "realtor") {
    return "REFERRAL";
  }
  if (key === "website_form") return "ORGANIC";
  return "ORGANIC";
};

const mapLeadProbability = (
  raw: Maybe<string>,
  score: Maybe<number>,
): LeadProbability => {
  const priority = str(raw).toLowerCase();
  if (priority === "urgent" || priority === "high") return "high";
  if (priority === "low") return "low";
  const s = num(score);
  if (s >= 70) return "high";
  if (s >= 40) return "mid";
  if (s > 0) return "low";
  return "mid";
};

export type LeadRow = {
  id: string;
  lead_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
  first_response_at?: string | null;
  completeness_score?: number | null;
  estimated_value?: number | null;
  source_detail?: string | null;
  assigned_to?: string | null;
  interest_series?: number[] | null;
};

export const mapLead = (row: LeadRow, assignedName?: string): Lead => {
  const name = [row.first_name, row.last_name]
    .filter((part): part is string => Boolean(part && str(part).trim()))
    .join(" ")
    .trim();
  return {
    id: str(row.id),
    name: name || str(row.email) || str(row.lead_number) || "Lead",
    email: str(row.email),
    phone: str(row.phone),
    source: mapLeadSource(row.source),
    sourceExternal: Boolean(row.source_detail),
    status: mapLeadStatus(row.status),
    size: num(row.estimated_value),
    interest: Array.isArray(row.interest_series) ? row.interest_series : [],
    probability: mapLeadProbability(row.priority, row.completeness_score),
    lastAction: iso(row.first_response_at || row.created_at),
    ownerName: assignedName ?? "",
    createdAt: iso(row.created_at),
  };
};

// ---------- Quote ----------

const mapQuoteStatus = (raw: Maybe<string>): QuoteStatus => {
  switch (str(raw).toLowerCase()) {
    case "draft":
      return "draft";
    case "sent":
      return "sent";
    case "viewed":
      return "viewed";
    case "accepted":
      return "accepted";
    case "declined":
    case "rejected":
      return "declined";
    case "expired":
      return "expired";
    default:
      return "draft";
  }
};

const mapServiceType = (raw: Maybe<string>): ServiceType => {
  const key = str(raw).toLowerCase();
  if (key.includes("delivery")) return "delivery";
  if (key.includes("bin")) return "bin_rental";
  if (key.includes("storage")) return "storage";
  return "move";
};

const mapTier = (raw: Maybe<string>): ResidentialTier => {
  const key = str(raw).toLowerCase();
  if (key.includes("estate")) return "estate";
  if (key.includes("signature")) return "signature";
  return "essential";
};

export type QuoteRow = {
  id: string;
  quote_id?: string | null;
  quote_number?: string | null;
  contact_id?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  service_type?: string | null;
  tier_selected?: string | null;
  status?: string | null;
  custom_price?: number | null;
  tiers?: Record<string, { total?: number | null }> | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
};

export const mapQuote = (row: QuoteRow, customerName?: string): Quote => {
  const tier = mapTier(row.tier_selected);
  const tiersValue = num(
    row.tiers?.[tier]?.total ?? row.tiers?.signature?.total ?? 0,
  );
  const total = num(row.custom_price) || tiersValue;
  return {
    id: str(row.id),
    number: str(row.quote_number || row.quote_id || row.id).toString(),
    customerId: str(row.contact_id),
    customerName: customerName || str(row.client_name) || "—",
    customerEmail: str(row.client_email),
    tier,
    serviceType: mapServiceType(row.service_type),
    total,
    status: mapQuoteStatus(row.status),
    expiresAt: iso(row.expires_at || row.created_at),
    createdAt: iso(row.created_at),
    sentAt: isoOrNull(row.sent_at),
    viewedAt: isoOrNull(row.viewed_at),
  };
};

// ---------- Move ----------

const mapMoveStatus = (raw: Maybe<string>): MoveStatus => {
  switch (str(raw).toLowerCase()) {
    case "draft":
    case "pending":
      return "draft";
    case "scheduled":
    case "confirmed":
      return "scheduled";
    case "pre_move":
    case "pre-move":
    case "ready":
      return "pre-move";
    case "in_progress":
    case "in-progress":
    case "in_transit":
    case "in-transit":
    case "active":
      return "in-transit";
    case "completed":
    case "closed":
    case "delivered":
      return "completed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "scheduled";
  }
};

export type MoveRow = {
  id: string;
  move_code?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  scheduled_date?: string | null;
  estimate?: number | null;
  status?: string | null;
  move_type?: string | null;
  service_type?: string | null;
  tier_selected?: string | null;
  crew_id?: string | null;
  created_at?: string | null;
  contact_id?: string | null;
  margin_percent?: number | null;
  organization_id?: string | null;
};

export const mapMove = (
  row: MoveRow,
  crewById: Map<string, { id: string; name: string }>,
): Move => ({
  id: str(row.id),
  number: str(row.move_code || row.id),
  customerId: str(row.contact_id),
  customerName: str(row.client_name) || "Customer",
  tier: mapTier(row.tier_selected),
  serviceType: mapServiceType(row.service_type || row.move_type),
  status: mapMoveStatus(row.status),
  scheduledAt: iso(row.scheduled_date || row.created_at),
  origin: str(row.from_address),
  destination: str(row.to_address),
  crew:
    row.crew_id && crewById.get(str(row.crew_id))
      ? [crewById.get(str(row.crew_id))!]
      : [],
  truck: null,
  total: num(row.estimate),
  onTime: num(row.margin_percent) >= 0,
});

// ---------- Customer ----------

const mapCustomerType = (raw: Maybe<string>): CustomerType => {
  const key = str(raw).toLowerCase();
  if (key === "pm" || key.includes("property")) return "pm";
  if (
    key === "b2b" ||
    key.includes("partner") ||
    key.includes("commercial") ||
    key.includes("vendor")
  ) {
    return "b2b";
  }
  return "b2c";
};

const mapVertical = (raw: Maybe<string>): Vertical | undefined => {
  const key = str(raw).toLowerCase();
  if (!key) return undefined;
  if (key.includes("furniture")) return "furniture_retail";
  if (key.includes("floor")) return "flooring";
  if (key.includes("interior")) return "interior_designer";
  if (key.includes("cabinet")) return "cabinetry";
  if (key.includes("medical") || key.includes("lab")) return "medical_lab";
  if (key.includes("appliance")) return "appliance";
  if (key.includes("art") || key.includes("gallery")) return "art_gallery";
  if (key.includes("restaurant") || key.includes("hospitality"))
    return "restaurant_hospitality";
  if (key.includes("office") || key.includes("commercial"))
    return "office_commercial";
  if (key.includes("ecom") || key.includes("bulk")) return "ecommerce_bulk";
  if (key.includes("property")) return "property_management";
  return undefined;
};

export type CustomerRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  type?: string | null;
  vertical?: string | null;
  created_at?: string | null;
};

export const mapCustomer = (
  row: CustomerRow,
  stats: {
    ltv?: number;
    movesCount?: number;
    lastContactAt?: string | null;
    tags?: string[];
  } = {},
): Customer => ({
  id: str(row.id),
  name: str(row.name) || "Customer",
  email: str(row.email),
  phone: str(row.phone),
  type: mapCustomerType(row.type),
  vertical: mapVertical(row.vertical),
  ltv: num(stats.ltv),
  movesCount: num(stats.movesCount),
  lastContactAt: iso(stats.lastContactAt || row.created_at),
  tags: stats.tags ?? [],
  createdAt: iso(row.created_at),
});

// ---------- Invoice ----------

const mapInvoiceStatus = (raw: Maybe<string>): InvoiceStatus => {
  switch (str(raw).toLowerCase()) {
    case "paid":
      return "paid";
    case "sent":
    case "issued":
    case "open":
      return "sent";
    case "overdue":
    case "past_due":
      return "overdue";
    case "void":
    case "voided":
      return "void";
    case "refunded":
      return "refunded";
    default:
      return "draft";
  }
};

export type InvoiceRow = {
  id: string;
  invoice_number?: string | null;
  client_name?: string | null;
  organization_id?: string | null;
  move_id?: string | null;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  paid_at?: string | null;
  due_at?: string | null;
};

export const mapInvoice = (row: InvoiceRow): Invoice => {
  const total = num(row.amount);
  const tax = Math.round(total * 0.0875 * 100) / 100;
  return {
    id: str(row.id),
    number: str(row.invoice_number || row.id),
    customerId: str(row.organization_id),
    customerName: str(row.client_name) || "Customer",
    moveId: row.move_id ? str(row.move_id) : null,
    status: mapInvoiceStatus(row.status),
    subtotal: Math.max(0, total - tax),
    tax,
    total,
    dueAt: iso(row.due_at || row.created_at),
    paidAt: isoOrNull(row.paid_at),
    createdAt: iso(row.created_at),
  };
};

// ---------- Crew ----------

export type CrewMemberRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

export const mapCrewMember = (row: CrewMemberRow): CrewMember => {
  const role = str(row.role).toLowerCase();
  const mappedRole: CrewMember["role"] =
    role === "driver" ? "driver" : role === "lead" ? "lead" : "mover";
  return {
    id: str(row.id),
    name: str(row.name) || "Crew",
    email: str(row.email),
    phone: str(row.phone),
    role: mappedRole,
    availability: row.is_active ? "available" : "off-duty",
    rating: 4.6,
    damageRate: 0,
    movesCompleted: 0,
    nextAssignmentAt: null,
  };
};

// ---------- B2B Partner / PM / Building ----------

export type OrganizationRow = {
  id: string;
  name?: string | null;
  type?: string | null;
  vertical?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  contract_status?: string | null;
  buildings_count?: number | null;
  created_at?: string | null;
};

export const mapB2BPartner = (
  row: OrganizationRow,
  stats: { jobsLast30?: number; revenueLast30?: number } = {},
): B2BPartner => ({
  id: str(row.id),
  name: str(row.name) || "Partner",
  vertical: mapVertical(row.vertical) ?? "office_commercial",
  primaryContact: str(row.primary_contact_name),
  email: str(row.primary_contact_email),
  phone: str(row.primary_contact_phone),
  jobsLast30: num(stats.jobsLast30),
  revenueLast30: num(stats.revenueLast30),
  onTimePercent: 96,
  status: "active",
  createdAt: iso(row.created_at),
});

export const mapPMAccount = (
  row: OrganizationRow,
  stats: { buildings?: number; movesLast30?: number } = {},
): PMAccount => {
  const status = str(row.contract_status).toLowerCase();
  const contract: PMAccount["contractStatus"] =
    status === "renewal"
      ? "renewal"
      : status === "lapsed" || status === "expired"
        ? "lapsed"
        : "active";
  return {
    id: str(row.id),
    name: str(row.name) || "Account",
    primaryContact: str(row.primary_contact_name),
    email: str(row.primary_contact_email),
    buildings: num(stats.buildings ?? row.buildings_count),
    movesLast30: num(stats.movesLast30),
    contractStatus: contract,
    createdAt: iso(row.created_at),
  };
};

export type BuildingRow = {
  id: string;
  name?: string | null;
  address?: string | null;
  pm_account_id?: string | null;
  pm_account_name?: string | null;
  elevator_config?: string | null;
  complexity?: number | null;
  last_move_at?: string | null;
  moves_completed?: number | null;
};

const mapElevator = (raw: Maybe<string>): BuildingConfig => {
  const key = str(raw).toLowerCase();
  if (key.includes("multi")) return "multi_transfer";
  if (key.includes("split")) return "split_transfer";
  return "standard";
};

export const mapBuilding = (row: BuildingRow): Building => {
  const complexity = Math.min(Math.max(num(row.complexity, 1), 1), 5) as
    | 1
    | 2
    | 3
    | 4
    | 5;
  return {
    id: str(row.id),
    name: str(row.name) || "Building",
    address: str(row.address),
    pmAccountId: row.pm_account_id ? str(row.pm_account_id) : null,
    pmAccountName: row.pm_account_name ? str(row.pm_account_name) : null,
    elevatorConfig: mapElevator(row.elevator_config),
    complexity,
    movesCompleted: num(row.moves_completed),
    lastMoveAt: isoOrNull(row.last_move_at),
  };
};
