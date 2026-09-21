/**
 * Project proposal email body. Shared by the project create route and the
 * status-change ("Send proposal") route so both send the same email: a luxury,
 * ordered layout (serif title, an at-a-glance meta row, and the full program —
 * every phase with its install AND teardown date and location). Pass the result
 * into emailLayout, which supplies the Yugo cream shell + header/footer.
 */

type ProposalProject = {
  project_name?: string | null;
  project_number?: string | null;
  estimated_budget?: number | null;
  project_mgmt_fee?: number | null;
  start_date?: string | null;
  target_end_date?: string | null;
  site_address?: string | null;
};
type ProposalOrg = { name?: string | null; contact_name?: string | null };
export type ProposalPhase = {
  phase_name?: string | null;
  address?: string | null;
  /** In date (delivery / setup). Falls back to the phase scheduled_date. */
  install_date?: string | null;
  /** Out date (teardown / return), when the phase has one. */
  teardown_date?: string | null;
};

const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";
const FOREST = "#2C3E2D";
const WINE = "#2B0416";
const INK = "#3A3532";
const BODY = "#6B635C";
const RULE = "#E4DDD2";

function fmtDate(d?: string | null): string {
  if (!d) return "TBC";
  const dt = new Date(`${String(d).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return "TBC";
  return dt.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Short base label: "Dymon Storage, 285 Taunton Rd E, Oshawa, ON" -> "Dymon Storage, Oshawa". */
function shortBase(addr?: string | null): string | null {
  if (!addr) return null;
  const parts = String(addr).split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? null;
  const name = parts[0];
  const city = parts.length >= 3 ? parts[parts.length - 2] : parts[parts.length - 1];
  return city && city !== name ? `${name}, ${city}` : name;
}

function metaCell(label: string, value: string): string {
  return `
    <td style="padding:0 18px 0 0;vertical-align:top;">
      <div style="font-family:${SERIF};font-size:11px;font-weight:400;letter-spacing:0.12em;text-transform:uppercase;color:${BODY};margin:0 0 5px;">${label}</div>
      <div style="font-family:${SERIF};font-size:17px;line-height:1.25;color:${INK};">${value}</div>
    </td>`;
}

/**
 * Derive each phase's install + teardown date from its jobs (deliveries). A
 * phase's earliest job is the install/set-up; the latest (when distinct) is the
 * teardown/return. Falls back to the phase's own scheduled_date for install.
 */
export function enrichPhasesWithJobs(
  phases: Array<{
    id: string;
    phase_name?: string | null;
    address?: string | null;
    scheduled_date?: string | null;
  }>,
  jobs: Array<{ phase_id?: string | null; scheduled_date?: string | null }>,
): ProposalPhase[] {
  return phases.map((ph) => {
    const dates = jobs
      .filter((j) => j.phase_id === ph.id && j.scheduled_date)
      .map((j) => String(j.scheduled_date).slice(0, 10))
      .sort();
    return {
      phase_name: ph.phase_name,
      address: ph.address,
      install_date: dates[0] ?? ph.scheduled_date ?? null,
      teardown_date: dates.length > 1 ? dates[dates.length - 1] : null,
    };
  });
}

export function projectProposalEmailBody(input: {
  project: ProposalProject;
  org: ProposalOrg;
  phases: ProposalPhase[];
  baseUrl: string;
}): { subject: string; html: string } {
  const { project, org, phases, baseUrl } = input;
  const budget = (project.estimated_budget || 0) + (project.project_mgmt_fee || 0);
  const window =
    project.start_date || project.target_end_date
      ? `${fmtDate(project.start_date)} &ndash; ${fmtDate(project.target_end_date)}`
      : null;
  const base = shortBase(project.site_address);
  const hasTeardown = (phases ?? []).some((p) => p.teardown_date);

  // ── At-a-glance meta row (value / dates / base) ──
  const metas: string[] = [];
  if (budget > 0) metas.push(metaCell("Program value", `$${budget.toLocaleString()} <span style="font-size:12px;color:${BODY};">+ HST</span>`));
  if (window) metas.push(metaCell("Dates", window));
  if (base) metas.push(metaCell("Storage base", esc(base)));
  const metaRow = metas.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 26px;"><tr>${metas.join("")}</tr></table>`
    : "";

  // ── Program table (install + teardown) ──
  const th = (t: string, extra = "") =>
    `<th style="padding:0 12px 8px 0;text-align:left;font-family:${SERIF};font-size:11px;font-weight:400;letter-spacing:0.1em;text-transform:uppercase;color:${BODY};border-bottom:1px solid ${RULE};${extra}">${t}</th>`;
  const td = (t: string, extra = "") =>
    `<td style="padding:11px 12px 11px 0;font-size:13px;color:${BODY};border-bottom:1px solid ${RULE};${extra}">${t}</td>`;

  const phaseRows = (phases ?? [])
    .map((p) => {
      const cols = [
        td(`<span style="font-size:14px;color:${INK};font-weight:600;">${esc(p.phase_name) || "Phase"}</span>`),
        td(`<span style="color:${FOREST};font-weight:600;white-space:nowrap;">${fmtDate(p.install_date)}</span>`),
        hasTeardown ? td(`<span style="white-space:nowrap;">${fmtDate(p.teardown_date)}</span>`) : "",
        td(esc(p.address) || "&mdash;"),
      ].join("");
      return `<tr>${cols}</tr>`;
    })
    .join("");

  const program =
    (phases ?? []).length > 0
      ? `
      <div style="font-family:${SERIF};font-size:11px;font-weight:400;letter-spacing:0.12em;text-transform:uppercase;color:${FOREST};margin:0 0 10px;">The Program &middot; ${phases.length} location${phases.length === 1 ? "" : "s"}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid ${RULE};">
        <thead><tr>
          ${th("Location")}${th("Install")}${hasTeardown ? th("Teardown") : ""}${th("Address")}
        </tr></thead>
        <tbody>${phaseRows}</tbody>
      </table>`
      : "";

  const html = `
    <div style="padding:6px 12px 40px;">
      <!-- Eyebrow -->
      <div style="font-family:${SERIF};font-size:12px;font-weight:400;letter-spacing:0.22em;text-transform:uppercase;color:${WINE};margin:0 0 16px;">Project Proposal</div>

      <!-- Title -->
      <h1 style="font-family:${SERIF};font-weight:400;font-size:32px;line-height:1.12;letter-spacing:-0.01em;color:${INK};margin:0 0 12px;">${esc(project.project_name)}</h1>

      <!-- Prepared for -->
      <p style="font-family:inherit;font-size:14px;line-height:1.5;color:${BODY};margin:0 0 26px;">
        Prepared for <strong style="color:${FOREST};font-weight:600;">${esc(org.name)}</strong>${org.contact_name ? ` &middot; ${esc(org.contact_name)}` : ""}.
      </p>

      <!-- Meta -->
      <div style="border-top:1px solid ${RULE};padding-top:22px;"></div>
      ${metaRow}

      <!-- Greeting -->
      <p style="font-size:15px;line-height:1.62;color:${BODY};margin:0 0 28px;">
        ${org.contact_name ? `Hi ${esc(org.contact_name.split(" ")[0])},<br/><br/>` : ""}Here is the full program, location by location${hasTeardown ? ". Each site is set up and taken down by the same crew, so the whole run stays in one pair of hands" : ""}. Review the schedule below and log in to confirm.
      </p>

      <!-- Program table (spans the full content width, no card padding) -->
      <div style="margin:2px 0 30px;">
        ${program}
      </div>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${FOREST};border-radius:0;">
        <a href="${baseUrl}/partner" style="display:inline-block;padding:15px 34px;font-family:inherit;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">View Full Proposal</a>
      </td></tr></table>
    </div>`;

  const subject = `Project Proposal: ${project.project_name ?? ""}${project.project_number ? ` (${project.project_number})` : ""}`;
  return { subject, html };
}
