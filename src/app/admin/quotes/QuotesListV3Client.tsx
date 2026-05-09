"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format-currency";
import { formatAdminCreatedAt } from "@/lib/date-format";
import { toTitleCase } from "@/lib/format-text";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";
import { quoteStatusAllowsHardDelete } from "@/lib/quotes/delete-eligibility";

import { PageHeader } from "@/design-system/admin/layout";
import {
  Button,
  StatusPill,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  Input,
} from "@/design-system/admin/primitives";
import {
  DataTable,
  type ColumnDef,
  type BulkAction,
  type ColumnSort,
  type RowAction,
  type ViewMode,
} from "@/design-system/admin/table";
import { KpiStrip } from "@/design-system/admin/dashboard";
import { PaperPlaneTilt, Trash, Plus, Copy } from "@phosphor-icons/react";
import { useToast } from "../components/Toast";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Quote {
  id: string;
  quote_id: string;
  contact_id: string;
  client_name: string;
  service_type: string;
  status: string;
  tiers: unknown;
  custom_price: number | null;
  recommended_tier: string | null;
  from_address?: string;
  to_address?: string;
  move_date?: string;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  created_at: string;
  loss_reason?: string | null;
  version?: number | null;
  is_revised?: boolean | null;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function quoteAmountRaw(q: Quote): number | null {
  if (q.custom_price) return q.custom_price;
  if (q.tiers && typeof q.tiers === "object") {
    const tiers = q.tiers as Record<string, { total?: number }>;
    const recKey = (q.recommended_tier ?? "signature")
      .toString()
      .toLowerCase()
      .trim();
    const recommended = tiers[recKey]?.total;
    if (recommended != null) return recommended;
    const first = Object.values(tiers).find((t) => t?.total);
    if (first?.total) return first.total;
  }
  return null;
}

function quoteAmount(q: Quote): string {
  const raw = quoteAmountRaw(q);
  return raw != null ? formatCurrency(raw) : "";
}

function quoteDetailPath(q: Quote): string {
  const slug = (q.quote_id || "").trim() || q.id;
  return `/admin/quotes/${encodeURIComponent(slug)}`;
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function expiryInfo(
  expiresAt: string | null,
  status: string,
): { label: string; tone: "warning" | "danger" | "neutral" } | null {
  if (!expiresAt || status === "accepted") return null;
  const daysLeft = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / 86_400_000,
  );
  if (daysLeft <= 0) return { label: "Expired", tone: "danger" };
  if (daysLeft <= 2) return { label: `${daysLeft}d left`, tone: "danger" };
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, tone: "warning" };
  return null;
}

function statusTone(
  status: string,
): "wine" | "forest" | "neutral" | "warning" | "success" | "danger" | "info" {
  switch (status) {
    case "accepted":
      return "success";
    case "viewed":
    case "sent":
      return "info";
    case "declined":
    case "expired":
      return "danger";
    case "cold":
    case "draft":
      return "neutral";
    default:
      return "neutral";
  }
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function QuotesListV3Client({
  quotes,
  isSuperAdmin = false,
}: {
  quotes: Quote[];
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<ColumnSort | null>({
    columnId: "created_at",
    direction: "desc",
  });
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = React.useState<{
    ids: string[];
    typed: string;
  } | null>(null);

  const kpis = React.useMemo(() => {
    const total = quotes.length;
    const open = quotes.filter((q) =>
      ["draft", "sent", "viewed"].includes(q.status),
    );
    const openValue = open.reduce((a, q) => a + (quoteAmountRaw(q) ?? 0), 0);
    const accepted = quotes.filter((q) => q.status === "accepted").length;
    const expiring = quotes.filter((q) => {
      const i = expiryInfo(q.expires_at, q.status);
      return i?.tone === "danger" || i?.tone === "warning";
    }).length;

    const DECIDED = new Set(["accepted", "confirmed", "booked", "paid", "expired", "declined", "lost", "cold"]);
    const decided = quotes.filter((q) => DECIDED.has(q.status)).length;
    const won = quotes.filter((q) => ["accepted", "confirmed", "booked", "paid"].includes(q.status)).length;
    const conversionRate = decided > 0 ? Math.round((won / decided) * 100) : 0;

    const amounts = quotes.map((q) => quoteAmountRaw(q)).filter((v): v is number => v != null && v > 0);
    const avgQuote = amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;

    const lostCounts: Record<string, number> = {};
    for (const q of quotes) {
      if (q.loss_reason) {
        const key = q.loss_reason.trim().split(":")[0]?.trim().toLowerCase() || "";
        if (key) lostCounts[key] = (lostCounts[key] || 0) + 1;
      }
    }
    const LOSS_LABEL: Record<string, string> = {
      competitor: "Competitor",
      postponed: "Postponed",
      budget: "Over budget",
      no_response: "No response",
      other: "Other",
    };
    const topLost = Object.entries(lostCounts).sort((a, b) => b[1] - a[1])[0];
    const topLostReason = topLost ? (LOSS_LABEL[topLost[0]] ?? topLost[0]) : "—";

    return [
      {
        id: "total",
        label: "Total quotes",
        value: total.toString(),
      },
      {
        id: "open",
        label: "Open",
        value: open.length.toString(),
        hint: `${open.length} drafting / sent / viewed`,
      },
      {
        id: "open-value",
        label: "Open value",
        value: formatCurrency(openValue),
      },
      {
        id: "accepted",
        label: "Accepted",
        value: accepted.toString(),
        hint: `${expiring} expiring soon`,
      },
      {
        id: "conversion",
        label: "Conversion",
        value: `${conversionRate}%`,
        hint: `${won} won of ${decided} decided`,
      },
      {
        id: "avg-quote",
        label: "Avg quote",
        value: formatCurrency(avgQuote),
      },
      {
        id: "lost-reason",
        label: "Top lost reason",
        value: topLostReason,
      },
    ];
  }, [quotes]);

  const columns = React.useMemo<ColumnDef<Quote>[]>(
    () => [
      {
        id: "quote_id",
        shortLabel: "Quote",
        header: "Quote",
        accessor: (q) => q.quote_id,
        sortable: true,
        searchable: true,
        width: 160,
        cell: (q) => (
          <div className="flex items-center gap-1.5">
            <span className="yu3-num text-[13px] font-medium text-[var(--yu3-ink-strong)]">
              {q.quote_id || ""}
            </span>
            {q.version != null && q.version > 1 && (
              <span className="text-[9px] font-bold text-[var(--tx3)] tracking-wide">
                v{q.version}
              </span>
            )}
            {q.is_revised && (
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-500 border border-amber-500/30">
                Revised
              </span>
            )}
          </div>
        ),
      },
      {
        id: "client",
        shortLabel: "Client",
        header: "Client",
        accessor: (q) => q.client_name,
        sortable: true,
        searchable: true,
        width: 220,
        cell: (q) => (
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[var(--yu3-ink-strong)] truncate">
              {q.client_name || "Unnamed client"}
            </div>
            {q.from_address ? (
              <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                {q.from_address}
                {q.to_address ? ` → ${q.to_address}` : ""}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "service",
        shortLabel: "Service",
        header: "Service",
        accessor: (q) => q.service_type,
        sortable: true,
        searchable: true,
        width: 140,
        cell: (q) => (
          <span className="text-[12px] text-[var(--yu3-ink)]">
            {serviceTypeDisplayLabel(q.service_type) || ""}
          </span>
        ),
      },
      {
        id: "status",
        shortLabel: "Status",
        header: "Status",
        accessor: (q) => q.status,
        sortable: true,
        width: 160,
        cell: (q) => {
          const expiry = expiryInfo(q.expires_at, q.status);
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusPill tone={statusTone(q.status)}>
                {toTitleCase(q.status)}
              </StatusPill>
              {expiry ? (
                <StatusPill tone={expiry.tone}>{expiry.label}</StatusPill>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "sent",
        shortLabel: "Sent",
        header: "Sent",
        accessor: (q) => q.sent_at || q.created_at,
        sortable: true,
        width: 120,
        cell: (q) => (
          <span className="text-[13px] font-medium yu3-num text-[var(--yu3-ink)]">
            {relTime(q.sent_at || q.created_at)}
          </span>
        ),
      },
      {
        id: "amount",
        shortLabel: "Amount",
        header: "Amount",
        accessor: (q) => quoteAmountRaw(q) ?? 0,
        align: "right",
        sortable: true,
        width: 130,
        cell: (q) => (
          <span className="yu3-num text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
            {quoteAmount(q)}
          </span>
        ),
      },
      {
        id: "created_at",
        shortLabel: "Created",
        header: "Created",
        accessor: (q) => q.created_at,
        sortable: true,
        width: 140,
        cell: (q) => (
          <span className="text-[13px] font-medium yu3-num text-[var(--yu3-ink)] whitespace-nowrap">
            {formatAdminCreatedAt(q.created_at)}
          </span>
        ),
      },
    ],
    [],
  );

  const executeBulkDelete = React.useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/admin/quotes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        const count = typeof data.deleted === "number" ? data.deleted : ids.length;
        toast(`Deleted ${count} quote${count === 1 ? "" : "s"}`, "check");
        setSelectedIds(new Set());
        setBulkDeleteConfirm(null);
        router.refresh();
      } else {
        toast("Error: " + (data.error || "Failed"), "x");
      }
    },
    [router, toast],
  );

  const runBulk = React.useCallback(
    async (action: "resend" | "expire" | "delete", ids: string[]) => {
      if (action === "delete") {
        setBulkDeleteConfirm({ ids, typed: "" });
        return;
      }
      const res = await fetch("/api/admin/quotes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        const labels: Record<string, string> = {
          resend: "Resent",
          expire: "Expired",
        };
        const count =
          typeof data.updated === "number"
            ? data.updated
            : ids.length;
        toast(
          `${labels[action]} ${count} quote${count === 1 ? "" : "s"}`,
          "check",
        );
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast("Error: " + (data.error || "Failed"), "x");
      }
    },
    [router, toast],
  );

  const bulkActions = React.useMemo<BulkAction<Quote>[]>(
    () => [
      {
        id: "resend",
        label: "Resend",
        icon: <PaperPlaneTilt size={14} />,
        run: (rows) =>
          runBulk(
            "resend",
            rows.map((r) => r.id),
          ),
      },
      {
        id: "expire",
        label: "Mark expired",
        run: (rows) =>
          runBulk(
            "expire",
            rows.map((r) => r.id),
          ),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash size={14} />,
        danger: true,
        run: (rows) =>
          runBulk(
            "delete",
            rows.map((r) => r.id),
          ),
      },
    ],
    [runBulk],
  );

  const rowActions = React.useMemo<RowAction<Quote>[]>(
    () => [
      {
        id: "open",
        label: "Open quote",
        run: (r) => router.push(quoteDetailPath(r)),
      },
      {
        id: "edit",
        label: "Edit",
        run: (r) => router.push(`${quoteDetailPath(r)}/edit`),
      },
      {
        id: "copy-link",
        label: "Copy client link",
        icon: <Copy size={14} />,
        run: async (r) => {
          const idForPublic = (r.quote_id || "").trim() || r.id;
          const url = `${location.origin}/quote/${encodeURIComponent(idForPublic)}`;
          await navigator.clipboard.writeText(url).catch(() => null);
          toast("Link copied", "check");
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash size={14} />,
        danger: true,
        run: async (r) => {
          if (!quoteStatusAllowsHardDelete(r.status, isSuperAdmin)) {
            toast("This quote cannot be deleted", "x");
            return;
          }
          if (!window.confirm("Delete this quote?")) return;
          const res = await fetch(`/api/admin/quotes/${r.id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            toast("Quote deleted", "check");
            router.refresh();
          } else {
            toast("Failed to delete", "x");
          }
        },
      },
    ],
    [isSuperAdmin, router, toast],
  );

  const pipelineStages = React.useMemo(
    () => [
      { id: "draft", label: "Draft", tone: "neutral" as const },
      { id: "sent", label: "Sent", tone: "wine" as const },
      { id: "viewed", label: "Viewed", tone: "info" as const },
      { id: "accepted", label: "Accepted", tone: "success" as const },
      { id: "expired", label: "Expired", tone: "danger" as const },
      { id: "declined", label: "Declined", tone: "danger" as const },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Pipeline"
        title="Quotes"
        description="Track every quote from draft to accepted. Send reminders in bulk."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={16} />}
            onClick={() => router.push("/admin/quotes/new")}
          >
            New quote
          </Button>
        }
      />

      <KpiStrip tiles={kpis} columns={4} />

      <DataTable<Quote>
        columns={columns}
        rows={quotes}
        rowId={(q) => q.id}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        selectedRowIds={selectedIds}
        onSelectedRowIdsChange={setSelectedIds}
        bulkActions={bulkActions}
        rowActions={rowActions}
        onRowClick={(q) => router.push(quoteDetailPath(q))}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableViews={["list", "pipeline"]}
        pipeline={{
          stages: pipelineStages,
          stageForRow: (q) => q.status,
          renderCard: (q) => (
            <div className="bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-md)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="yu3-num text-[12px] font-semibold text-[var(--yu3-ink-strong)]">
                  {q.quote_id}
                </span>
                <span className="yu3-num text-[12px] text-[var(--yu3-ink-muted)]">
                  {quoteAmount(q)}
                </span>
              </div>
              <div className="mt-1 text-[13px] font-medium text-[var(--yu3-ink)] truncate">
                {q.client_name || "Unnamed client"}
              </div>
              <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate mt-0.5">
                {serviceTypeDisplayLabel(q.service_type) || ""}
              </div>
            </div>
          ),
        }}
      />

      {bulkDeleteConfirm && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setBulkDeleteConfirm(null);
          }}
        >
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>
                Delete {bulkDeleteConfirm.ids.length}{" "}
                {bulkDeleteConfirm.ids.length === 1 ? "quote" : "quotes"}?
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p className="text-[13px] text-[var(--yu3-ink-muted)]">
                This permanently deletes{" "}
                {bulkDeleteConfirm.ids.length === 1
                  ? "this quote"
                  : `these ${bulkDeleteConfirm.ids.length} quotes`}{" "}
                and cannot be undone.
              </p>
              {bulkDeleteConfirm.ids.length > 1 && (
                <div className="mt-4">
                  <p className="text-[12px] font-medium text-[var(--yu3-ink)] mb-1.5">
                    Type{" "}
                    <span className="font-mono font-bold tracking-wide">
                      DELETE
                    </span>{" "}
                    to confirm
                  </p>
                  <Input
                    value={bulkDeleteConfirm.typed}
                    onChange={(e) =>
                      setBulkDeleteConfirm((prev) =>
                        prev ? { ...prev, typed: e.target.value } : null,
                      )
                    }
                    placeholder="DELETE"
                    autoFocus
                  />
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setBulkDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  bulkDeleteConfirm.ids.length > 1 &&
                  bulkDeleteConfirm.typed !== "DELETE"
                }
                onClick={() => executeBulkDelete(bulkDeleteConfirm.ids)}
              >
                Delete{" "}
                {bulkDeleteConfirm.ids.length === 1
                  ? "quote"
                  : `${bulkDeleteConfirm.ids.length} quotes`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
