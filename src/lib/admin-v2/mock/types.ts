// Typed domain shapes for the admin v2 mock layer. These mirror the
// expected Supabase shapes but carry only what the UI renders today —
// enough to exercise the DataTable and module drawers. When the real
// Supabase types land (`src/types/supabase.ts`), swap these with the
// generated types; the column configs key off the same field names.

export type ServiceType = "move" | "delivery" | "bin_rental" | "storage";
export type ResidentialTier = "essential" | "signature" | "estate";
export type Vertical =
  | "furniture_retail"
  | "flooring"
  | "interior_designer"
  | "cabinetry"
  | "medical_lab"
  | "appliance"
  | "art_gallery"
  | "restaurant_hospitality"
  | "office_commercial"
  | "ecommerce_bulk"
  | "property_management";

export type LeadStatus = "new" | "pre-sale" | "closing" | "closed" | "lost";
export type LeadProbability = "low" | "mid" | "high";
export type LeadSource =
  | "ORGANIC"
  | "SUMMER2"
  | "DTJ25"
  | "SB2024"
  | "AFF20"
  | "REFERRAL"
  | "GOOGLE"
  | "INSTAGRAM";

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: LeadSource;
  sourceExternal: boolean;
  status: LeadStatus;
  size: number;
  interest: number[];
  probability: LeadProbability;
  lastAction: string;
  ownerName: string;
  createdAt: string;
};

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired";

export type Quote = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  tier: ResidentialTier;
  serviceType: ServiceType;
  total: number;
  status: QuoteStatus;
  expiresAt: string;
  createdAt: string;
  sentAt: string | null;
  viewedAt: string | null;
};

export type MoveStatus =
  | "draft"
  | "scheduled"
  | "pre-move"
  | "in-transit"
  | "completed"
  | "cancelled";

export type Move = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  organizationId: string | null;
  tier: ResidentialTier;
  serviceType: ServiceType;
  status: MoveStatus;
  scheduledAt: string;
  origin: string;
  destination: string;
  crew: { id: string; name: string }[];
  truck: string | null;
  total: number;
  onTime: boolean;
};

export type CustomerType = "b2c" | "b2b" | "pm";

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: CustomerType;
  vertical?: Vertical;
  ltv: number;
  movesCount: number;
  lastContactAt: string;
  tags: string[];
  createdAt: string;
};

export type CrewRole = "lead" | "mover" | "driver";
export type CrewAvailability = "available" | "on-move" | "off-duty";

export type CrewMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: CrewRole;
  availability: CrewAvailability;
  rating: number;
  damageRate: number;
  movesCompleted: number;
  nextAssignmentAt: string | null;
};

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "void"
  | "refunded";

export type Invoice = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  moveId: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  dueAt: string;
  paidAt: string | null;
  createdAt: string;
};

export type B2BPartner = {
  id: string;
  name: string;
  vertical: Vertical;
  primaryContact: string;
  email: string;
  phone: string;
  jobsLast30: number;
  revenueLast30: number;
  onTimePercent: number;
  status: "active" | "paused" | "archived";
  createdAt: string;
};

export type PMAccount = {
  id: string;
  name: string;
  primaryContact: string;
  email: string;
  buildings: number;
  movesLast30: number;
  contractStatus: "active" | "renewal" | "lapsed";
  createdAt: string;
};

export type BuildingConfig = "standard" | "split_transfer" | "multi_transfer";

export type Building = {
  id: string;
  name: string;
  address: string;
  pmAccountId: string | null;
  pmAccountName: string | null;
  elevatorConfig: BuildingConfig;
  complexity: 1 | 2 | 3 | 4 | 5;
  movesCompleted: number;
  lastMoveAt: string | null;
};
