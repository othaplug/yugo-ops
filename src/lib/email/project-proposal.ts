/**
 * Project proposal email body. Shared by the project create route and the
 * status-change ("Send proposal") route so both send the same enriched email:
 * not just a budget line + portal link, but the actual program — every phase
 * with its date and location, and the budget. Pass the result into emailLayout.
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
type ProposalPhase = {
  phase_name?: string | null;
  scheduled_date?: string | null;
  address?: string | null;
};

const FOREST = "#2C3E2D";
const INK = "#3A3532";
const BODY = "#6B635C";
const LINE = "#E7E2DA";

function fmtDate(d?: string | null): string {
  if (!d) return "TBC";
  const dt = new Date(`${String(d).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return "TBC";
  return dt.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

  const phaseRows = (phases ?? [])
    .map(
      (p, i) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid ${LINE};font-size:12px;color:${BODY};width:24px">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${LINE};font-size:12.5px;color:${INK};font-weight:600">${esc(p.phase_name) || "Phase"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${LINE};font-size:12px;color:${BODY};white-space:nowrap">${fmtDate(p.scheduled_date)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${LINE};font-size:12px;color:${BODY}">${esc(p.address) || "&mdash;"}</td>
      </tr>`,
    )
    .join("");

  const phaseTable =
    (phases ?? []).length > 0
      ? `
      <p style="font-size:11px;font-weight:700;color:${FOREST};letter-spacing:.5px;text-transform:uppercase;margin:26px 0 8px">Program &middot; ${phases.length} phase${phases.length === 1 ? "" : "s"}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid ${LINE}">
        <thead>
          <tr>
            <th style="padding:6px 10px;text-align:left;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${BODY};font-weight:700;border-bottom:1px solid ${LINE}"></th>
            <th style="padding:6px 10px;text-align:left;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${BODY};font-weight:700;border-bottom:1px solid ${LINE}">Phase</th>
            <th style="padding:6px 10px;text-align:left;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${BODY};font-weight:700;border-bottom:1px solid ${LINE}">Date</th>
            <th style="padding:6px 10px;text-align:left;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${BODY};font-weight:700;border-bottom:1px solid ${LINE}">Location</th>
          </tr>
        </thead>
        <tbody>${phaseRows}</tbody>
      </table>`
      : "";

  const html = `
    <div style="font-size:9px;font-weight:700;color:${FOREST};letter-spacing:1.5px;text-transform:none;margin-bottom:8px">New Project Proposal</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 6px;color:${INK}">${esc(project.project_name)}</h1>
    ${window ? `<p style="font-size:12px;color:${BODY};margin:0 0 18px">${window}${project.site_address ? ` &middot; base: ${esc(project.site_address)}` : ""}</p>` : ""}
    <p style="font-size:13px;color:${BODY};line-height:1.6;margin:0 0 6px">
      Hi${org.contact_name ? ` ${esc(org.contact_name)}` : ""},<br/><br/>
      A new project proposal has been prepared for <strong style="color:${FOREST}">${esc(org.name)}</strong>.
      ${budget > 0 ? `The estimated program value is <strong style="color:${INK}">$${budget.toLocaleString()}</strong> + HST.` : ""}
    </p>
    ${phaseTable}
    <p style="font-size:13px;color:${BODY};line-height:1.6;margin:22px 0 20px">
      Log in to your partner portal to review the full details and confirm.
    </p>
    <a href="${baseUrl}/partner" style="display:inline-block;background:${FOREST};color:#FFFFFF;padding:14px 28px;border-radius:0;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
      View Project
    </a>`;

  const subject = `New Project Proposal: ${project.project_name ?? ""}${project.project_number ? ` (${project.project_number})` : ""}`;
  return { subject, html };
}
