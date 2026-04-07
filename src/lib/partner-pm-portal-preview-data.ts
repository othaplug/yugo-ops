import type {
  PmPortalSummary,
  PmProjectRow,
} from "@/app/partner/PartnerPropertyManagementPortal";

const PROP_A = "preview-pm-prop-harbour";
const PROP_B = "preview-pm-prop-annex";

const SAMPLE_PROJECTS: PmProjectRow[] = [
  {
    id: "preview-proj-1",
    project_name: "Spring lease-up — Tower A",
    project_type: "lease_up",
    total_units: 42,
    tracked_units: 18,
    status: "active",
  },
  {
    id: "preview-proj-2",
    project_name: "Lobby refresh coordination",
    project_type: "building_upgrade",
    total_units: null,
    tracked_units: 6,
    status: "active",
  },
];

/** Mock for `/partner/pm-preview` (dev / flagged envs only). Uses today’s date for “Today” / week strip. */
export function buildPmPortalPreviewSample(): PmPortalSummary {
  const todayStr = new Date().toISOString().slice(0, 10);
  const d3 = new Date();
  d3.setDate(d3.getDate() + 3);
  const d3s = d3.toISOString().slice(0, 10);

  const upcomingMoves: PmPortalSummary["upcomingMoves"] = [
    {
      id: "preview-mov-1",
      move_code: "18402",
      scheduled_date: todayStr,
      scheduled_time: "10 AM – 12 PM",
      unit_number: "1408",
      tenant_name: "J. Patel",
      status: "confirmed",
      building_name: "Harbourview Towers",
      move_type_label: "Tenant move-out",
      tracking_url: "#preview-track",
    },
    {
      id: "preview-mov-2",
      move_code: "18418",
      scheduled_date: d3s,
      scheduled_time: "8 AM – 10 AM",
      unit_number: "210",
      tenant_name: "M. Chen",
      status: "scheduled",
      building_name: "The Annex Lofts",
      move_type_label: "Tenant move-in",
      tracking_url: "#preview-track-2",
    },
  ];

  const weekMovesByDate: NonNullable<PmPortalSummary["weekMovesByDate"]> = {};
  for (const m of upcomingMoves) {
    const day = m.scheduled_date || "";
    if (!day) continue;
    if (!weekMovesByDate[day]) weekMovesByDate[day] = [];
    weekMovesByDate[day].push({
      id: m.id,
      move_code: m.move_code,
      unit_number: m.unit_number,
      tenant_name: m.tenant_name,
      building_name: m.building_name,
      scheduled_time: m.scheduled_time ?? null,
      status: m.status,
    });
  }

  const todaysMoves: NonNullable<PmPortalSummary["todaysMoves"]> = upcomingMoves
    .filter((m) => m.scheduled_date === todayStr)
    .map((m) => ({
      id: m.id,
      move_code: m.move_code,
      scheduled_date: m.scheduled_date,
      scheduled_time: m.scheduled_time || "",
      unit_number: m.unit_number,
      tenant_name: m.tenant_name,
      status: m.status,
      building_name: m.building_name,
      move_type_label: m.move_type_label,
      tracking_url: m.tracking_url || "#",
    }));

  return {
    org: { name: "Sample Property Group", vertical: "property_management_residential" },
    contract: {
      id: "preview-contract",
      contract_number: "PM-2026-1042",
      contract_type: "per_move",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      status: "active",
    },
    properties: [
      {
        id: PROP_A,
        building_name: "Harbourview Towers",
        address: "120 Queens Quay W, Toronto, ON",
        total_units: 240,
        service_region: "GTA",
      },
      {
        id: PROP_B,
        building_name: "The Annex Lofts",
        address: "722 Bathurst St, Toronto, ON",
        total_units: 48,
        service_region: "GTA",
      },
    ],
    stats: {
      propertiesCount: 2,
      totalUnits: 288,
      movesThisMonth: 7,
      movesCompletedThisMonth: 5,
      revenueThisMonth: 18420,
      upcomingScheduledCount: 2,
    },
    upcomingMoves,
    todaysMoves,
    weekMovesByDate,
    activeProjectsCount: SAMPLE_PROJECTS.length,
    recentCompleted: [
      {
        id: "preview-done-1",
        move_code: "18390",
        scheduled_date: "2026-03-28",
        unit_number: "905",
        tenant_name: "A. Okonkwo",
        building_name: "Harbourview Towers",
        move_type_label: "Move-out",
        amount: 1240,
        estimate: 1180,
      },
    ],
    projects: SAMPLE_PROJECTS,
    dashboard: {
      showPropertyStrip: true,
      showProjects: true,
      scheduledByProperty: { [PROP_A]: 2, [PROP_B]: 1 },
    },
    overviewAttention: {
      pendingApprovalMoveCount: 0,
      overdueInvoiceCount: 0,
      buildingsIncompleteAccessCount: 1,
    },
  };
}

/** Rows for `/partner/pm-preview` move history (Analytics → Move history). Mirrors API shape; includes filter helpers. */
export type PmMoveHistoryPreviewRow = {
  id: string;
  date: string | null;
  partner_property_id: string;
  building_name: string;
  unit: string | null;
  move_type: string;
  reason_code: string;
  tenant_name: string | null;
  status: string | null;
  price: number;
  pod_url: string | null;
  tracking_url: string | null;
  arrived_on_time: boolean | null;
};

function previewRangeBounds(range: string): { start: string | null; end: string | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (range === "all") return { start: null, end: null };
  if (range === "this_month") {
    return { start: new Date(y, m, 1).toISOString().slice(0, 10), end: null };
  }
  if (range === "last_month") {
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    return { start, end };
  }
  if (range === "last_3_months") {
    return { start: new Date(y, m - 3, d).toISOString().slice(0, 10), end: null };
  }
  if (range === "this_year") {
    return { start: `${y}-01-01`, end: null };
  }
  return { start: new Date(y, m, 1).toISOString().slice(0, 10), end: null };
}

function previewMatchesType(reason_code: string, move_type: string, typeFilter: string): boolean {
  if (!typeFilter || typeFilter === "all") return true;
  const label = move_type.toLowerCase();
  const code = reason_code.toLowerCase();
  if (typeFilter === "tenant_move_in")
    return code.includes("move_in") || code.includes("tenant_move_in") || label.includes("move-in");
  if (typeFilter === "tenant_move_out")
    return code.includes("move_out") || code.includes("tenant_move_out") || label.includes("move-out");
  if (typeFilter === "renovation")
    return (
      code.includes("reno") ||
      code.includes("displacement") ||
      code.includes("return") ||
      label.includes("renovation")
    );
  if (typeFilter === "suite_transfer") return code.includes("suite") || label.includes("suite");
  if (typeFilter === "emergency") return code.includes("emergency") || label.includes("emergency");
  return true;
}

/** Filter preview rows the same way as `/api/partner/pm/move-history`. */
export function filterPmMoveHistoryPreviewRows(
  rows: PmMoveHistoryPreviewRow[],
  params: { buildingId: string; typeFilter: string; range: string },
): PmMoveHistoryPreviewRow[] {
  const { start, end } = previewRangeBounds(params.range);
  let out = rows.filter((r) => {
    const day = r.date;
    if (start && (!day || day < start)) return false;
    if (end && day && day > end) return false;
    return true;
  });
  if (params.buildingId && params.buildingId !== "all") {
    out = out.filter((r) => r.partner_property_id === params.buildingId);
  }
  const tf = params.typeFilter?.trim().toLowerCase() || "";
  if (tf && tf !== "all") {
    out = out.filter((r) => previewMatchesType(r.reason_code, r.move_type, tf));
  }
  return out;
}

export function summarizePmMoveHistoryPreview(rows: PmMoveHistoryPreviewRow[]): {
  totalMoves: number;
  totalSpend: number;
  avgCost: number;
  onTimeRate: number | null;
} {
  const totalMoves = rows.length;
  const totalSpend = rows.reduce((s, r) => s + r.price, 0);
  const avgCost = totalMoves > 0 ? Math.round(totalSpend / totalMoves) : 0;
  const onTimeRows = rows.filter((r) => r.arrived_on_time === true || r.arrived_on_time === false);
  const onTimeHits = onTimeRows.filter((r) => r.arrived_on_time === true).length;
  const onTimeRate =
    onTimeRows.length > 0 ? Math.round((onTimeHits / onTimeRows.length) * 100) : null;
  return { totalMoves, totalSpend, avgCost, onTimeRate };
}

/** Static portfolio moves for the PM portal preview (no auth / no API). */
export function buildPmMoveHistoryPreviewBase(): PmMoveHistoryPreviewRow[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d1 = new Date(y, m, 4).toISOString().slice(0, 10);
  const d2 = new Date(y, m, 18).toISOString().slice(0, 10);
  const d3 = new Date(y, m - 1, 22).toISOString().slice(0, 10);

  return [
    {
      id: "preview-hist-1",
      date: d1,
      partner_property_id: PROP_A,
      building_name: "Harbourview Towers",
      unit: "905",
      move_type: "Tenant move-out",
      reason_code: "tenant_move_out",
      tenant_name: "A. Okonkwo",
      status: "completed",
      price: 1240,
      pod_url: "#preview-pod-1",
      tracking_url: null,
      arrived_on_time: true,
    },
    {
      id: "preview-hist-2",
      date: d2,
      partner_property_id: PROP_B,
      building_name: "The Annex Lofts",
      unit: "210",
      move_type: "Tenant move-in",
      reason_code: "tenant_move_in",
      tenant_name: "M. Chen",
      status: "paid",
      price: 980,
      pod_url: "#preview-pod-2",
      tracking_url: null,
      arrived_on_time: false,
    },
    {
      id: "preview-hist-3",
      date: d3,
      partner_property_id: PROP_A,
      building_name: "Harbourview Towers",
      unit: "1204",
      move_type: "Suite transfer",
      reason_code: "suite_transfer",
      tenant_name: "R. Singh",
      status: "completed",
      price: 1420,
      pod_url: null,
      tracking_url: "#preview-track-hist",
      arrived_on_time: true,
    },
  ];
}
