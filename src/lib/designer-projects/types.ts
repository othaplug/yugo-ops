export type DesignerPhase =
  | "planning"
  | "vendor_coordination"
  | "staging"
  | "install_ready"
  | "install_scheduled"
  | "completed";

export type VendorReadiness =
  | "pending"
  | "confirmed"
  | "partial"
  | "delayed"
  | "received";

export const DESIGNER_PHASE_LABELS: Record<DesignerPhase, string> = {
  planning: "Planning",
  vendor_coordination: "Vendor Coordination",
  staging: "Staging",
  install_ready: "Install Ready",
  install_scheduled: "Install Scheduled",
  completed: "Completed",
};

export const PHASE_ORDER: DesignerPhase[] = [
  "planning",
  "vendor_coordination",
  "staging",
  "install_ready",
  "install_scheduled",
  "completed",
];

export const VENDOR_READINESS_LABELS: Record<VendorReadiness, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  partial: "Partial",
  delayed: "Delayed",
  received: "Received",
};

export interface ProjectVendor {
  id: string;
  project_id: string;
  vendor_name: string;
  vendor_address: string | null;
  vendor_access: string | null;
  vendor_access_notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  readiness: VendorReadiness;
  readiness_notes: string | null;
  pickup_date: string | null;
  pickup_window: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  received_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectInventoryItem {
  id: string;
  project_id: string;
  vendor_id: string | null;
  item_name: string;
  vendor_name: string | null;
  quantity: number;
  room_destination: string | null;
  item_status: string | null;
  status: string;
  requires_assembly: boolean | null;
  requires_crating: boolean | null;
  item_value: number | null;
  is_fragile?: boolean | null;
  is_high_value?: boolean | null;
  special_handling_notes: string | null;
  placement_notes: string | null;
  pickup_photo_url: string | null;
  delivery_photo_url: string | null;
  photo_urls: string[] | null;
  condition_on_receipt: string | null;
  inspection_notes: string | null;
  sort_order?: number;
  created_at: string;
}

export interface DesignerProject {
  id: string;
  project_number: string;
  partner_id: string;
  project_name: string;
  end_client_name: string | null;
  end_client_contact: string | null;
  site_address: string | null;
  install_unit: string | null;
  install_floor: string | null;
  install_access: string | null;
  install_access_notes: string | null;
  rooms: Array<{ room: string; notes?: string }>;
  placement_spec_url: string | null;
  status: string;
  designer_phase: DesignerPhase | null;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  estimated_budget: number | null;
  project_mgmt_fee: number | null;
  coordinator_id: string | null;
  coordinator_name: string | null;
  hubspot_deal_id: string | null;
  delivery_job_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DesignerProjectWithRelations extends DesignerProject {
  organizations?: { name: string; type: string } | null;
  project_vendors?: ProjectVendor[];
  project_inventory?: ProjectInventoryItem[];
}

export interface ProjectPriceBreakdown {
  baseRate: number;
  extraItems: { count: number; charge: number };
  extraStops: { count: number; charge: number };
  assembly: { count: number; charge: number };
  highValue: { count: number; charge: number };
  subtotal: number;
  hst: number;
  total: number;
}
