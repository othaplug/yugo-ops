type AppSearchEntry = {
  name: string
  href: string
  type: "Page" | "Action"
  /** Shown in results under the title */
  sub?: string
  /** Extra words users might type: settings, menu, roles, and so on */
  k: string[]
}

/**
 * Navigable admin destinations for the top bar and global search, plus common
 * synonyms. Kept in sync with `design-system/admin/layout/nav.ts` and main
 * `/admin` routes. Entity records (moves, clients, and so on) are merged in
 * `runAdminTopbarSearch` in admin-search.
 */
const ENTRIES: AppSearchEntry[] = [
  {
    name: "Overview",
    href: "/admin",
    type: "Page",
    sub: "Command Center",
    k: [
      "dashboard",
      "home",
      "command",
      "center",
      "centre",
      "ops",
    ],
  },
  {
    name: "Activity",
    href: "/admin/activity",
    type: "Page",
    sub: "Feed and updates",
    k: ["activity", "feed", "events", "log", "history"],
  },
  {
    name: "Calendar",
    href: "/admin/calendar",
    type: "Page",
    k: ["calendar", "schedule", "agenda", "date"],
  },
  {
    name: "Live tracking",
    href: "/admin/crew",
    type: "Page",
    sub: "Map and crews",
    k: ["tracking", "live", "map", "gps", "location", "crew", "field"],
  },
  {
    name: "Quotes",
    href: "/admin/quotes",
    type: "Page",
    k: ["quotes", "residential", "b2b", "estimate"],
  },
  {
    name: "Leads",
    href: "/admin/leads",
    type: "Page",
    k: ["leads", "pipeline", "crm", "funnel", "sales"],
  },
  {
    name: "All leads",
    href: "/admin/leads/all",
    type: "Page",
    k: ["leads", "all", "everyone", "list"],
  },
  {
    name: "My leads",
    href: "/admin/leads/mine",
    type: "Page",
    k: ["leads", "mine", "assigned", "own"],
  },
  {
    name: "Dispatch",
    href: "/admin/dispatch",
    type: "Page",
    sub: "Day board and crew assignments",
    k: [
      "dispatch",
      "board",
      "day",
      "schedule",
      "assign",
      "jobs",
      "operations",
    ],
  },
  {
    name: "All moves",
    href: "/admin/moves",
    type: "Page",
    k: ["moves", "residential", "relocation", "shipments", "list"],
  },
  {
    name: "B2B jobs",
    href: "/admin/b2b/jobs",
    type: "Page",
    sub: "Deliveries and projects",
    k: [
      "b2b",
      "jobs",
      "deliveries",
      "projects",
      "logistics",
    ],
  },
  {
    name: "Inbound B2B",
    href: "/admin/b2b/jobs/inbound",
    type: "Page",
    k: ["inbound", "b2b", "intake", "receiving", "warehousing"],
  },
  {
    name: "All deliveries",
    href: "/admin/deliveries",
    type: "Page",
    k: [
      "deliveries",
      "jobs",
      "projects",
      "dlv",
    ],
  },
  {
    name: "Bin rentals",
    href: "/admin/bin-rentals",
    type: "Page",
    k: ["bins", "roll", "dumpster", "rental", "waste"],
  },
  {
    name: "Move projects",
    href: "/admin/move-projects",
    type: "Page",
    k: ["move", "projects", "office", "install"],
  },
  {
    name: "Projects",
    href: "/admin/projects",
    type: "Page",
    k: ["projects", "b2b", "site"],
  },
  {
    name: "All partners",
    href: "/admin/partners",
    type: "Page",
    k: ["partners", "b2b", "clients", "org", "organizations"],
  },
  {
    name: "Referral partners",
    href: "/admin/partners/referral",
    type: "Page",
    k: ["referral", "realtor", "agents", "introducers", "realtors"],
  },
  {
    name: "Referral realtors (legacy list)",
    href: "/admin/partners/realtors",
    type: "Page",
    k: [
      "realtors",
      "referral",
      "realtor",
    ],
  },
  {
    name: "Partner health",
    href: "/admin/partners/health",
    type: "Page",
    k: ["health", "score", "partners", "kpi", "vendors"],
  },
  {
    name: "Retail partners",
    href: "/admin/partners/retail",
    type: "Page",
    k: ["retail", "showroom", "merchandise", "partners", "b2b"],
  },
  {
    name: "Designers",
    href: "/admin/partners/designers",
    type: "Page",
    k: ["designers", "interior", "design", "stagers", "partners"],
  },
  {
    name: "Hospitality",
    href: "/admin/partners/hospitality",
    type: "Page",
    k: ["hospitality", "hotel", "fnb", "restaurant", "partners", "b2b"],
  },
  {
    name: "Art gallery",
    href: "/admin/partners/gallery",
    type: "Page",
    k: ["gallery", "art", "install", "exhibit", "partners"],
  },
  {
    name: "Crew analytics",
    href: "/admin/crew/analytics",
    type: "Page",
    k: [
      "crew",
      "analytics",
      "performance",
      "productivity",
      "stats",
    ],
  },
  {
    name: "Crew assignments",
    href: "/admin/crew/assignments",
    type: "Page",
    k: ["assignments", "dispatch", "crew", "jobs"],
  },
  {
    name: "Crew availability",
    href: "/admin/crew/availability",
    type: "Page",
    k: ["availability", "shifts", "time off", "crew", "labor"],
  },
  {
    name: "Buildings",
    href: "/admin/buildings",
    type: "Page",
    sub: "Platform settings · building and access records",
    k: [
      "buildings",
      "condo",
      "strata",
      "access",
      "addresses",
      "platform",
      "settings",
    ],
  },
  {
    name: "Claims",
    href: "/admin/claims",
    type: "Page",
    k: ["claims", "damage", "insurance", "incidents"],
  },
  {
    name: "Revenue and finance",
    href: "/admin/finance",
    type: "Page",
    sub: "Revenue, invoices, and profitability",
    k: [
      "finance",
      "revenue",
      "reporting",
      "money",
      "profitability",
      "forecast",
    ],
  },
  {
    name: "Invoices (finance)",
    href: "/admin/finance/invoices",
    type: "Page",
    k: [
      "invoices",
      "billing",
      "ar",
      "finance",
    ],
  },
  {
    name: "Tips",
    href: "/admin/finance/tips",
    type: "Page",
    k: ["tips", "gratuity", "crew", "finance"],
  },
  {
    name: "Profitability",
    href: "/admin/finance/profitability",
    type: "Page",
    k: ["profitability", "margin", "finance", "p and l", "p&l"],
  },
  {
    name: "Forecast",
    href: "/admin/finance/forecast",
    type: "Page",
    k: ["forecast", "projection", "finance", "revenue", "outlook", "mrr", "cogs"],
  },
  {
    name: "Invoices (legacy list)",
    href: "/admin/invoices",
    type: "Page",
    k: ["invoices", "list", "billing", "ar"],
  },
  {
    name: "Revenue (legacy page)",
    href: "/admin/revenue",
    type: "Page",
    k: ["revenue", "income", "rolling", "finance", "mrr", "kpi", "cogs"],
  },
  {
    name: "Tips (legacy page)",
    href: "/admin/tips",
    type: "Page",
    k: ["tips", "gratuity", "finance", "kpi"],
  },
  {
    name: "Contacts and clients",
    href: "/admin/clients",
    type: "Page",
    k: [
      "clients",
      "contacts",
      "people",
      "crm",
      "companies",
      "customers",
    ],
  },
  {
    name: "Change requests",
    href: "/admin/change-requests",
    type: "Page",
    k: ["change", "requests", "edits", "variations", "scope"],
  },
  {
    name: "EOD reports",
    href: "/admin/reports",
    type: "Page",
    k: ["reports", "eod", "end of day", "ops", "paperwork"],
  },
  {
    name: "Audit log (admin)",
    href: "/admin/audit-log",
    type: "Page",
    k: [
      "audit",
      "log",
      "history",
      "compliance",
      "who",
    ],
  },
  {
    name: "Inbound shipments",
    href: "/admin/inbound-shipments",
    type: "Page",
    k: ["inbound", "receiving", "shipments", "freight", "trailer"],
  },
  {
    name: "Perks and referrals",
    href: "/admin/perks",
    type: "Page",
    k: ["perks", "referral", "program", "incentives", "credits", "rewards"],
  },
  {
    name: "Widget leads",
    href: "/admin/widget-leads",
    type: "Page",
    k: ["widget", "web", "form", "leads", "inbox"],
  },
  {
    name: "Drafts",
    href: "/admin/drafts",
    type: "Page",
    k: ["drafts", "incomplete", "saved"],
  },
  {
    name: "Users",
    href: "/admin/users",
    type: "Page",
    k: [
      "users",
      "people",
      "access",
      "logins",
      "accounts",
    ],
  },
  {
    name: "Settings",
    href: "/admin/settings",
    type: "Page",
    sub: "Company, team, and product preferences",
    k: [
      "settings",
      "preferences",
      "config",
      "options",
      "menu",
      "sidebar",
      "account",
    ],
  },
  {
    name: "Platform controls",
    href: "/admin/platform",
    type: "Page",
    sub: "Fleet, pricing, HubSpot, and org tools",
    k: [
      "platform",
      "admin",
      "fleet",
      "vehicles",
      "trucks",
      "equipment",
      "pricing",
      "verticals",
      "integrations",
      "hubspot",
      "hub spot",
      "hub",
      "developer",
    ],
  },
  {
    name: "Platform integrations",
    href: "/admin/settings/platform/integrations",
    type: "Page",
    k: [
      "integrations",
      "api",
      "webhook",
      "connect",
    ],
  },
  {
    name: "Team and roles (settings)",
    href: "/admin/settings/operations/team",
    type: "Page",
    k: [
      "team",
      "roles",
      "permissions",
      "invites",
      "staff",
      "members",
    ],
  },
  {
    name: "Email templates (settings)",
    href: "/admin/settings/operations/email-templates",
    type: "Page",
    sub: "Outreach and comms",
    k: [
      "email",
      "templates",
      "reminders",
      "messaging",
      "branding",
    ],
  },
  {
    name: "Notification inbox",
    href: "/admin/notifications",
    type: "Page",
    k: [
      "notifications",
      "inbox",
      "alerts",
      "reminders",
      "bell",
    ],
  },
  { name: "New quote", href: "/admin/quotes/new", type: "Action", sub: "Create a quote", k: ["new", "quote", "create", "start"] },
  { name: "New move", href: "/admin/moves/new", type: "Action", sub: "Schedule a move", k: ["new", "move", "create", "book"] },
  { name: "New contact", href: "/admin/clients/new", type: "Action", sub: "Add a client", k: ["new", "contact", "client", "person", "add"] },
  { name: "New partner", href: "/admin/partners/new", type: "Action", k: ["new", "partner", "onboard", "b2b"] },
  { name: "New delivery", href: "/admin/deliveries/new", type: "Action", k: ["new", "delivery", "job", "create", "b2b"] },
  { name: "New invoice", href: "/admin/finance/invoices/new", type: "Action", k: ["new", "invoice", "bill", "ar"] },
]

function entryHaystack(e: AppSearchEntry): string {
  return [e.name, e.sub, e.href, e.href.replace("/admin", ""), ...e.k]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

/** Match static app routes and quick actions. Callers usually merge with `runAdminEntitySearch`. */
export function searchAdminAppRoutes(
  q: string,
  maxResults: number,
): { type: string; name: string; sub?: string; href: string }[] {
  const term = q.trim().toLowerCase()
  if (term.length < 2) return []

  const scored: { e: AppSearchEntry; i: number }[] = []
  for (const e of ENTRIES) {
    const hay = entryHaystack(e)
    if (!hay.includes(term)) continue
    const i = hay.indexOf(term)
    scored.push({ e, i: i < 0 ? 999 : i })
  }
  scored.sort((a, b) => a.i - b.i || a.e.name.localeCompare(b.e.name))

  const out: { type: string; name: string; sub?: string; href: string }[] = []
  const seen = new Set<string>()
  for (const { e } of scored) {
    if (seen.has(e.href)) continue
    seen.add(e.href)
    out.push({
      type: e.type,
      name: e.name,
      sub: e.sub,
      href: e.href,
    })
    if (out.length >= maxResults) break
  }
  return out
}
