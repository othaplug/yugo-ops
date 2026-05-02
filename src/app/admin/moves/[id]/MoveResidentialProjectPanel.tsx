"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { Printer, CalendarBlank } from "@phosphor-icons/react";
import { Button } from "@/design-system/admin/primitives";
import { formatMoveDate } from "@/lib/date-format";
import { toTitleCase } from "@/lib/format-text";

type DayLike = Record<string, unknown> & {
  id?: string;
  date?: string;
  label?: string;
  day_type?: string;
  status?: string;
  day_number?: number;
  crew_size?: number | null;
  truck_type?: string | null;
  origin_address?: string | null;
  destination_address?: string | null;
  description?: string | null;
};

export default function MoveResidentialProjectPanel(props: {
  moveId: string;
  moveCode: string | null | undefined;
  projectId: string;
  tree: {
    project: Record<string, unknown>;
    phases: {
      phase_name?: string | null;
      phase_type?: string | null;
      days?: DayLike[];
    }[];
  };
}) {
  const flatDays = useMemo(() => {
    const rows: DayLike[] = [];
    const phList = props.tree.phases || [];
    for (const ph of phList) {
      const ds = Array.isArray(ph.days) ? ph.days : [];
      for (const d of ds) {
        rows.push({
          ...d,
          phase_name: ph.phase_name,
          phase_type: ph.phase_type,
        } as DayLike);
      }
    }
    rows.sort((a, b) => {
      const n1 = typeof a.day_number === "number" ? a.day_number : 0;
      const n2 = typeof b.day_number === "number" ? b.day_number : 0;
      if (n1 !== n2) return n1 - n2;
      return String(a.date || "").localeCompare(String(b.date || ""));
    });
    return rows;
  }, [props.tree.phases]);

  const projectTitle =
    typeof props.tree.project.project_name === "string" && props.tree.project.project_name.trim()
      ? props.tree.project.project_name.trim()
      : "Residential project";

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const handlePrintManifest = useCallback(() => {
    const code = escapeHtml((props.moveCode || "").trim() || props.moveId);
    const title = escapeHtml(projectTitle);
    const rowsHtml = flatDays
      .map((d, idx) => {
        const dn = typeof d.day_number === "number" ? d.day_number : idx + 1;
        const ds = typeof d.date === "string" ? escapeHtml(d.date.slice(0, 10)) : "";
        const type = escapeHtml(toTitleCase(String(d.day_type || "")));
        const stat = escapeHtml(toTitleCase(String(d.status || "scheduled")));
        const route = escapeHtml(
          `${String(d.origin_address || "").trim()}${d.destination_address ? ` · ${String(d.destination_address).trim()}` : ""}`,
        );
        const desc =
          typeof d.description === "string"
            ? escapeHtml(d.description.replace(/\s+/g, " ").slice(0, 400))
            : "";
        return `<tr><td>${dn}</td><td>${ds}</td><td>${type}</td><td>${stat}</td><td>${route}</td><td>${desc}</td></tr>`;
      })
      .join("");
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#222}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}th{font-weight:600}</style></head><body>
<h1 style="font-size:18px">${title}</h1>
<p style="font-size:12px;color:#444">Move ${code} · ${flatDays.length} operational day${flatDays.length === 1 ? "" : "s"}</p>
<table><thead><tr><th>Day</th><th>Date</th><th>Type</th><th>Status</th><th>Route</th><th>Notes</th></tr></thead><tbody>${rowsHtml}</tbody></table>
<script>window.onload=function(){window.print();window.close()}</script>
</body></html>`;
    const w = window.open("", "_blank", "noopener,noreferrer,width=860,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(doc);
    w.document.close();
  }, [flatDays, projectTitle, props.moveCode, props.moveId]);

  return (
    <div className="rounded-lg border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] mb-1">
            Multi-day project
          </p>
          <h3 className="text-[15px] font-semibold text-[var(--yu3-ink)]">{projectTitle}</h3>
          <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1">
            Move {(props.moveCode || "").trim() || props.moveId} linked to residential project planner.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
            <Link href={`/admin/move-projects/${props.projectId}`}>
              <Button type="button" variant="secondary" size="sm" className="gap-1.5 font-semibold uppercase tracking-wide text-[10px]">
              <CalendarBlank className="size-3.5" aria-hidden />
              Edit schedule
            </Button>
          </Link>
            <Button
              type="button"
              variant="secondary"
              size="sm"
            className="gap-1.5 font-semibold uppercase tracking-wide text-[10px]"
            onClick={handlePrintManifest}
          >
            <Printer className="size-3.5" aria-hidden />
            Print manifest
          </Button>
        </div>
      </div>

      <ol className="space-y-2">
        {flatDays.map((d, idx) => {
          const idVal = typeof d.id === "string" ? d.id : `row-${idx}`;
          const st = String(d.status || "").toLowerCase();
          const done = st === "completed" || st === "complete";
          const dateStr =
            typeof d.date === "string" && d.date.length >= 10 ? d.date.slice(0, 10) : null;
          return (
            <li
              key={idVal}
              id={`mpd-${idVal}`}
              className="rounded-md border border-[var(--yu3-line-subtle)] px-3 py-2 bg-[var(--yu3-bg-surface-subtle)]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[12px] font-semibold text-[var(--yu3-ink)]">
                  {(typeof d.label === "string" && d.label.trim()) ||
                    `${toTitleCase(String(d.day_type || "Day"))}${
                      typeof d.day_number === "number" ? ` · Day ${d.day_number}` : ""
                    }`}
                </span>
                {dateStr ? (
                  <span className="text-[11px] text-[var(--yu3-ink-muted)]">{formatMoveDate(dateStr)}</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--yu3-ink-muted)]">
                <span>
                  {done ? (
                    <span className="text-[var(--yu3-success)] font-semibold">Complete</span>
                  ) : (
                    <span className="font-medium text-[var(--yu3-warning)]">Scheduled</span>
                  )}
                </span>
                {d.crew_size != null ? <span>Crew ×{Math.max(1, Number(d.crew_size) || 0)}</span> : null}
                {d.truck_type ? <span>{String(d.truck_type)}</span> : null}
              </div>
              {(d.origin_address || d.destination_address) && (
                <p className="text-[10px] text-[var(--yu3-ink-muted)] mt-1 leading-snug break-words">
                  {String(d.origin_address || "").trim() || "—"}
                  {d.destination_address ? ` · ${String(d.destination_address).trim()}` : ""}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
