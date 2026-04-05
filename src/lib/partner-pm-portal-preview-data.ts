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

/** Deterministic mock for `/partner/pm-preview` (dev / flagged envs only). */
export function buildPmPortalPreviewSample(): PmPortalSummary {
  return {
    org: { name: "Sample Property Group" },
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
    },
    upcomingMoves: [
      {
        id: "preview-mov-1",
        move_code: "18402",
        scheduled_date: "2026-04-12",
        scheduled_time: "10 AM – 12 PM",
        unit_number: "1408",
        tenant_name: "J. Patel",
        status: "confirmed",
        building_name: "Harbourview Towers",
        move_type_label: "Move-out",
      },
      {
        id: "preview-mov-2",
        move_code: "18418",
        scheduled_date: "2026-04-14",
        scheduled_time: "8 AM – 10 AM",
        unit_number: "210",
        tenant_name: "M. Chen",
        status: "scheduled",
        building_name: "The Annex Lofts",
        move_type_label: "Move-in",
      },
    ],
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
  };
}
