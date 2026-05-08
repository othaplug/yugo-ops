"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CaretRight, PencilSimple as Pencil, Plus, Trash as Trash2 } from "@phosphor-icons/react";
import { PageHeader } from "@/design-system/admin/layout";
import { Button, Tabs, TabsList, TabsTrigger } from "@/design-system/admin/primitives";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import Badge from "../../components/Badge";
import ContactDetailsModal from "../../components/ContactDetailsModal";
import EditPartnerModal from "./EditPartnerModal";
import DeliverySummaryModal from "./DeliverySummaryModal";
import PartnerPaymentTermsSection from "./PartnerPaymentTermsSection";
import PartnerCardOnFileSection from "./PartnerCardOnFileSection";
import PortalAccessSection from "./PortalAccessSection";
import PartnerRateCardTab from "./PartnerRateCardTab";
import AdminPartnerAnalytics from "./AdminPartnerAnalytics";
import PartnerPortalFeaturesCard from "@/components/admin/PartnerPortalFeaturesCard";
import PartnerBuildingsTab, { type PartnerPropertyRow } from "./PartnerBuildingsTab";
import PartnerReferralSection from "./PartnerReferralSection";
import InvoiceDetailModal from "./InvoiceDetailModal";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import { formatJobId, getMoveCode, getMoveDetailPath } from "@/lib/move-code";
import { getStatusLabel } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";
import { ScheduleDeliveryButton, ScheduleMoveItem } from "../../components/ScheduleItem";
import {
  isPmBatchScheduleVertical,
  isPropertyManagementDeliveryVertical,
  organizationTypeLabel,
} from "@/lib/partner-type";
import { getPartnerLabelsForPartner } from "@/utils/partnerType";

interface MoveRow {
  id: string;
  move_number?: string | null;
  move_code?: string | null;
  client_name?: string | null;
  status?: string | null;
  stage?: string | null;
  scheduled_date?: string | null;
  created_at?: string | null;
  estimate?: number | null;
  pm_reason_code?: string | null;
  partner_property_id?: string | null;
}

interface ChangeRequestRow {
  id: string;
  move_id: string;
  type: string;
  description: string;
  status: string;
  urgency?: string;
  created_at: string;
  moves?: { move_code?: string; client_name?: string } | { move_code?: string; client_name?: string }[];
}

interface ClientDetailClientProps {
  client: any;
  deliveries: any[];
  moves: MoveRow[];
  partnerMoves?: MoveRow[];
  partnerProperties?: PartnerPropertyRow[];
  portfolioPartner?: boolean;
  pmMetrics?: {
    buildingsCount: number;
    totalMoves: number;
    movesThisMonth: number;
    revenueMtd: number;
    revenueYtd: number;
    avgMoveValue: number;
    onTimeRate: number | null;
  } | null;
  changeRequests?: ChangeRequestRow[];
  allInvoices: any[];
  outstandingTotal: number;
  partnerSince: Date | null;
  partnerDuration: string | null;
  backHref: string;
  isAdmin?: boolean;
  /** Super admin email list; rate card mutations require this */
  isSuperAdmin?: boolean;
  squareAppId?: string;
  squareLocationId?: string;
}

type PartnerAdminTab = "overview" | "buildings" | "rate-card" | "moves" | "analytics" | "portal";

export default function ClientDetailClient({
  client,
  deliveries,
  moves,
  partnerMoves = [],
  partnerProperties = [],
  portfolioPartner = false,
  pmMetrics = null,
  changeRequests = [],
  allInvoices,
  outstandingTotal,
  partnerSince,
  partnerDuration,
  backHref,
  isAdmin,
  isSuperAdmin = false,
  squareAppId = "",
  squareLocationId = "",
}: ClientDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resendPortalLoading, setResendPortalLoading] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [summaryDelivery, setSummaryDelivery] = useState<typeof deliveries[0] | null>(null);
  const [summaryInvoice, setSummaryInvoice] = useState<typeof allInvoices[0] | null>(null);
  const [activeTab, setActiveTab] = useState<PartnerAdminTab>("overview");

  useEffect(() => {
    if (searchParams.get("edit") === "1") setEditModalOpen(true);
    const t = searchParams.get("tab");
    if (t === "rate-card") setActiveTab("rate-card");
    else if (t === "analytics") setActiveTab("analytics");
    else if (t === "portal") setActiveTab("portal");
    else if (portfolioPartner && t === "buildings") setActiveTab("buildings");
    else if (portfolioPartner && t === "moves") setActiveTab("moves");
  }, [searchParams, portfolioPartner]);

  useEffect(() => {
    if (!portfolioPartner && (activeTab === "buildings" || activeTab === "moves")) {
      setActiveTab("overview");
    }
  }, [portfolioPartner, activeTab]);

  const paidInvoices = allInvoices.filter((i) => i.status === "paid");
  const paidTotal = paidInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);

  const isClient = client.type === "b2c";
  const personaLabel = isClient ? "Client" : "Partner";
  const verticalKey = String(client.vertical || client.type || "");
  const showPmProposal = !isClient && isPropertyManagementDeliveryVertical(verticalKey);
  const showPmBatchSchedule = !isClient && isPmBatchScheduleVertical(verticalKey);
  const partnerLabels = getPartnerLabelsForPartner({
    vertical: client.vertical,
    type: client.type,
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${client.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast("Client deleted", "check");
      setDeleteConfirmOpen(false);
      router.push(backHref);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "x");
    } finally {
      setDeleting(false);
    }
  };

  const handlePartnerTabChange = (tab: string) => {
    const nextTab = tab as PartnerAdminTab;
    setActiveTab(nextTab);
    const next = new URLSearchParams(searchParams.toString());
    if (nextTab === "overview") {
      next.delete("tab");
      next.delete("building");
    } else {
      next.set("tab", nextTab);
      if (nextTab !== "moves") next.delete("building");
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const partnerTabs = (
    portfolioPartner
      ? (["overview", "buildings", "rate-card", "moves", "analytics", "portal"] as const)
      : (["overview", "rate-card", "analytics", "portal"] as const)
  ) satisfies readonly PartnerAdminTab[];

  const tabLabel = (tab: PartnerAdminTab) =>
    tab === "overview"
      ? "Overview"
      : tab === "buildings"
        ? "Buildings"
        : tab === "rate-card"
          ? "Rate card"
          : tab === "moves"
            ? "Moves"
            : tab === "analytics"
              ? "Analytics"
              : "Portal";

  return (
    <div className="w-full min-w-0 py-4 md:py-6 flex flex-col gap-4 animate-fade-up">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] transition-colors w-fit"
      >
        ← Back
      </button>

      <PageHeader
        eyebrow="CRM"
        title={client.name}
        titleClamp={false}
        description={
          isClient
            ? "Move client"
            : organizationTypeLabel(client.vertical || client.type)
        }
        actions={
          isAdmin ? (
            <div
              className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[12rem] sm:items-end"
              role="group"
              aria-label="Profile actions"
            >
              {!isClient && showPmBatchSchedule ? (
                <Button
                  variant="primary"
                  size="sm"
                  uppercase
                  trailingIcon={<CaretRight weight="bold" className="opacity-90" size={14} aria-hidden />}
                  onClick={() =>
                    router.push(
                      `/admin/moves/create?mode=pm_batch&partner=${encodeURIComponent(client.id)}`,
                    )
                  }
                >
                  Schedule moves
                </Button>
              ) : null}
              {isClient ? (
                <Button
                  variant="secondary"
                  size="sm"
                  uppercase
                  disabled={resendPortalLoading || !client.email?.trim() || moves.length === 0}
                  trailingIcon={<CaretRight weight="bold" className="opacity-90" size={14} aria-hidden />}
                  onClick={async () => {
                    const moveId = moves[0]?.id;
                    if (!moveId) {
                      toast("No move yet. Create a move first.", "x");
                      return;
                    }
                    if (!client.email?.trim()) {
                      toast("Add client email first (Edit).", "x");
                      return;
                    }
                    setResendPortalLoading(true);
                    try {
                      const res = await fetch(`/api/moves/${moveId}/send-tracking-link`, { method: "POST" });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Failed to send");
                      toast("Tracking link sent.", "mail");
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "Failed to send", "x");
                    } finally {
                      setResendPortalLoading(false);
                    }
                  }}
                >
                  {resendPortalLoading ? "Sending…" : "Send tracking link"}
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    uppercase
                    disabled={resendPortalLoading || !client.email?.trim()}
                    trailingIcon={<CaretRight weight="bold" className="opacity-90" size={14} aria-hidden />}
                    onClick={async () => {
                      if (!client.email?.trim()) {
                        toast("Add partner email first (Edit).", "x");
                        return;
                      }
                      setResendPortalLoading(true);
                      try {
                        const res = await fetch(`/api/admin/organizations/${client.id}/resend-portal`, { method: "POST" });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to send");
                        toast("Partner portal access sent.", "mail");
                      } catch (e) {
                        toast(e instanceof Error ? e.message : "Failed to send", "x");
                      } finally {
                        setResendPortalLoading(false);
                      }
                    }}
                  >
                    {resendPortalLoading ? "Sending…" : "Resend portal access"}
                  </Button>
                  {showPmProposal ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      uppercase
                      disabled={proposalLoading}
                      trailingIcon={<CaretRight weight="bold" className="opacity-90" size={14} aria-hidden />}
                      onClick={async () => {
                        setProposalLoading(true);
                        try {
                          const res = await fetch(`/api/admin/organizations/${client.id}/pm-proposal`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({}),
                          });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            throw new Error((err as { error?: string }).error || "Failed to generate");
                          }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `yugo-proposal-${client.name?.replace(/\s+/g, "-") || "partner"}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast("Proposal downloaded", "check");
                        } catch (e) {
                          toast(e instanceof Error ? e.message : "Failed", "x");
                        } finally {
                          setProposalLoading(false);
                        }
                      }}
                    >
                      {proposalLoading ? "Generating…" : "Generate proposal PDF"}
                    </Button>
                  ) : null}
                </>
              )}
              <Button
                variant="secondary"
                size="sm"
                uppercase
                leadingIcon={<Pencil weight="regular" size={14} aria-hidden />}
                trailingIcon={<CaretRight weight="bold" className="opacity-90" size={14} aria-hidden />}
                onClick={() => setEditModalOpen(true)}
              >
                Edit {isClient ? "client" : "partner"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                uppercase
                leadingIcon={<Trash2 weight="regular" size={14} aria-hidden />}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Delete
              </Button>
            </div>
          ) : undefined
        }
        className="pb-2"
      />

      {/* Portal Access, partners only */}
      {!isClient && isAdmin && (
        <PortalAccessSection
          orgId={client.id}
          orgName={client.name || ""}
          partnerVertical={client.vertical || client.type}
        />
      )}

      {/* Partner workspace tabs (below portal access) */}
      {!isClient && isAdmin && (
        <Tabs value={activeTab} onValueChange={handlePartnerTabChange}>
          <TabsList variant="underline" className="w-full min-w-0 justify-start border-b border-[var(--yu3-line-subtle)] pb-0">
            {partnerTabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} variant="underline">
                {tabLabel(tab)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Rate Card tab content */}
      {!isClient && isAdmin && activeTab === "rate-card" && (
        <PartnerRateCardTab orgId={client.id} orgName={client.name || ""} canEditRates={isSuperAdmin} />
      )}

      {!isClient && isAdmin && portfolioPartner && activeTab === "buildings" && (
        <PartnerBuildingsTab
          partnerId={client.id}
          properties={partnerProperties}
          moves={partnerMoves}
          onViewMoves={(buildingId) => {
            setActiveTab("moves");
            const next = new URLSearchParams(searchParams.toString());
            next.set("tab", "moves");
            next.set("building", buildingId);
            router.replace(`${pathname}?${next.toString()}`, { scroll: false });
          }}
        />
      )}

      {!isClient && isAdmin && portfolioPartner && activeTab === "moves" && (
        <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] shadow-[var(--yu3-shadow-sm)] p-5 md:p-6 mt-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-4">
            <div className="min-w-0">
              <h3 className="yu3-t-eyebrow text-[var(--yu3-ink-muted)] mb-3 sm:mb-2">
                Moves for this partner
              </h3>
              <p className="yu3-t-body text-[13px] text-[var(--yu3-ink-muted)] leading-relaxed">
                Tenant and portfolio jobs tied to this organization (residential move ops), not B2B deliveries.
              </p>
            </div>
            {showPmBatchSchedule ? (
              <Button
                variant="primary"
                size="sm"
                uppercase
                className="shrink-0 self-start sm:self-center"
                leadingIcon={<Plus weight="bold" size={16} aria-hidden />}
                trailingIcon={<CaretRight weight="bold" size={14} className="opacity-90" aria-hidden />}
                onClick={() =>
                  router.push(
                    `/admin/moves/create?mode=pm_batch&partner=${encodeURIComponent(client.id)}`,
                  )
                }
              >
                Create move
              </Button>
            ) : null}
          </div>
          {(() => {
            const buildingFilter = searchParams.get("building");
            const filteredMoves =
              buildingFilter?.trim()
                ? partnerMoves.filter((m) => m.partner_property_id === buildingFilter.trim())
                : partnerMoves;
            const propName =
              buildingFilter?.trim() &&
              partnerProperties.find((pr) => pr.id === buildingFilter.trim())?.building_name;
            return (
              <>
                {propName ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--yu3-ink)]">
                    <span>
                      Filtered: <span className="font-semibold text-[var(--yu3-ink-strong)]">{propName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => router.replace(`/admin/clients/${client.id}?tab=moves`)}
                      className="text-[var(--yu3-wine)] font-semibold hover:underline"
                    >
                      Clear filter
                    </button>
                  </div>
                ) : null}
                <div className="divide-y divide-[var(--yu3-line-subtle)] -mx-2">
                  {filteredMoves.length === 0 ? (
                    <div className="text-[10px] text-[var(--yu3-ink-muted)] py-4 text-center">
                      {buildingFilter ? "No moves for this building yet" : "No moves yet"}
                    </div>
                  ) : (
                    filteredMoves.map((m, idx) => (
                      <ScheduleMoveItem
                        key={m.id}
                        href={getMoveDetailPath(m)}
                        leftPrimary={String(idx + 1).padStart(2, "0")}
                        leftSecondary={formatMoveDate(
                          m.scheduled_date || (m.created_at ? new Date(m.created_at).toISOString().slice(0, 10) : null)
                        )}
                        status={getStatusLabel(m.status ?? null)}
                        title={m.client_name || m.move_number || "Move"}
                        subtitle={m.move_number ?? getMoveCode(m as { move_code?: string | null; id?: string | null })}
                      />
                    ))
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Analytics tab content */}
      {!isClient && isAdmin && activeTab === "analytics" && (
        <AdminPartnerAnalytics
          orgId={client.id}
          orgName={client.name || ""}
          partnerVertical={client.vertical || client.type}
        />
      )}

      {/* Portal Features tab content */}
      {!isClient && isAdmin && activeTab === "portal" && (
        <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] shadow-[var(--yu3-shadow-sm)] p-5 md:p-6 mt-2 space-y-6">
          <PartnerCardOnFileSection
            orgId={client.id}
            squareCardId={client.square_card_id}
            cardLastFour={client.card_last_four}
            cardBrand={client.card_brand}
            cardOnFile={client.card_on_file}
            squareAppId={squareAppId}
            squareLocationId={squareLocationId}
            onSaved={() => router.refresh()}
          />
          <PartnerPaymentTermsSection
            orgId={client.id}
            orgName={client.name || "Partner"}
            initialInvoiceDueDays={client.invoice_due_days ?? 30}
            initialInvoiceDueDayOfMonth={client.invoice_due_day_of_month ?? null}
            onSaved={() => router.refresh()}
          />
          <PartnerPortalFeaturesCard
            orgId={client.id}
            vertical={client.vertical}
            initialFeatures={client.portal_features}
          />
        </div>
      )}

      {/* Overview content, hidden when rate card tab active */}
      {(isClient || !isAdmin || activeTab === "overview") && (
        <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] shadow-[var(--yu3-shadow-sm)] p-5 md:p-6 mt-2">

      {/* Overview + since */}
      <div className="pt-2 pb-6">
        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-4 leading-relaxed">
          Profile summary
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {partnerSince && (
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">{personaLabel} since</div>
              <div className="text-[15px] font-bold font-heading text-[var(--yu3-ink-strong)]">
                {partnerSince.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                {partnerDuration && (
                  <span className="text-[11px] font-normal text-[var(--yu3-ink-muted)] ml-2">({partnerDuration})</span>
                )}
              </div>
            </div>
          )}
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">{isClient ? "Type" : "Partner type"}</div>
            <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
              {isClient ? "Move client" : organizationTypeLabel(client.vertical || client.type)}
            </div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mt-3 mb-1">
              Primary contact
            </div>
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="text-[13px] font-semibold text-[var(--yu3-wine)] hover:underline text-left"
            >
              {client.contact_name || "View contact details"}
            </button>
            {client.email ? (
              <a
                href={`mailto:${client.email}`}
                className="block text-[12px] text-[var(--yu3-ink)] mt-1 break-all hover:text-[var(--yu3-wine)]"
              >
                {client.email}
              </a>
            ) : null}
            {client.address && (
              <>
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mt-3 mb-1">Address</div>
                <div className="text-[12px] text-[var(--yu3-ink)]">{client.address}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* High-level metrics */}
      <div className="border-t border-[var(--yu3-line-subtle)] pt-6 pb-6">
        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-3">Metrics</div>
        {portfolioPartner && pmMetrics ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">Buildings</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-ink-strong)]">{pmMetrics.buildingsCount}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">Total moves</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-ink-strong)]">{pmMetrics.totalMoves}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">This month</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-ink-strong)]">{pmMetrics.movesThisMonth} moves</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">Revenue (MTD)</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-success)]">{formatCompactCurrency(pmMetrics.revenueMtd)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">Revenue (YTD)</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-success)]">{formatCompactCurrency(pmMetrics.revenueYtd)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">Outstanding</div>
              <div className={`text-[18px] md:text-[20px] font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--yu3-warning)]" : "text-[var(--yu3-success)]"}`}>
                {outstandingTotal > 0 ? formatCompactCurrency(outstandingTotal) : formatCompactCurrency(0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">Avg move value</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-ink-strong)]">
                {pmMetrics.avgMoveValue > 0 ? formatCompactCurrency(pmMetrics.avgMoveValue) : "-"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">On-time rate</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-ink-strong)]">
                {pmMetrics.onTimeRate != null ? `${Math.round(pmMetrics.onTimeRate * 100)}%` : "-"}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">Invoices</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-ink-strong)]">
                {allInvoices.length}{" "}
                <span className="text-[11px] font-normal text-[var(--yu3-ink-muted)]">({paidInvoices.length} paid)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6">
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">
                {isClient ? "Moves" : partnerLabels.totalMetric}
              </div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-ink-strong)]">
                {isClient ? moves.length : deliveries.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">AVG DEL</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-ink-strong)]">{client.deliveries_per_month ?? "-"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">Total paid</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-success)]">{formatCompactCurrency(paidTotal)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">Outstanding</div>
              <div className={`text-[18px] md:text-[20px] font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--yu3-warning)]" : "text-[var(--yu3-success)]"}`}>
                {outstandingTotal > 0 ? formatCompactCurrency(outstandingTotal) : formatCompactCurrency(0)}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-1">Invoices</div>
              <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--yu3-ink-strong)]">
                {allInvoices.length} <span className="text-[11px] font-normal text-[var(--yu3-ink-muted)]">({paidInvoices.length} paid)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent moves (B2C) or Recent projects (delivery partners) / moves (portfolio) */}
      <div className="border-t border-[var(--yu3-line-subtle)] pt-6 pb-4">
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-3">
          {isClient ? "Recent moves" : partnerLabels.recentLabel}
        </h3>
        <div className="divide-y divide-[var(--yu3-line-subtle)] -mx-2">
          {isClient ? (
            moves.length === 0 ? (
              <div className="text-[10px] text-[var(--yu3-ink-muted)] py-4 text-center">No moves yet</div>
            ) : (
              moves.map((m, idx) => (
                <ScheduleMoveItem
                  key={m.id}
                  href={getMoveDetailPath(m)}
                  leftPrimary={String(idx + 1).padStart(2, "0")}
                  leftSecondary={formatMoveDate(m.scheduled_date || (m.created_at ? new Date(m.created_at).toISOString().slice(0, 10) : null))}
                  status={getStatusLabel(m.status ?? null)}
                  title={m.client_name || m.move_number || "Move"}
                  subtitle={m.move_number ?? getMoveCode(m as { move_code?: string | null; id?: string | null })}
                />
              ))
            )
          ) : portfolioPartner ? (
            partnerMoves.length === 0 ? (
              <div className="text-[10px] text-[var(--yu3-ink-muted)] py-4 text-center">No moves yet</div>
            ) : (
              partnerMoves.slice(0, 8).map((m, idx) => (
                <ScheduleMoveItem
                  key={m.id}
                  href={getMoveDetailPath(m)}
                  leftPrimary={String(idx + 1).padStart(2, "0")}
                  leftSecondary={formatMoveDate(m.scheduled_date || (m.created_at ? new Date(m.created_at).toISOString().slice(0, 10) : null))}
                  status={getStatusLabel(m.status ?? null)}
                  title={m.client_name || m.move_number || "Move"}
                  subtitle={m.move_number ?? getMoveCode(m as { move_code?: string | null; id?: string | null })}
                />
              ))
            )
          ) : (
            <>
              {deliveries.map((d) => (
                <ScheduleDeliveryButton
                  key={d.id}
                  onClick={() => setSummaryDelivery(d)}
                  timeSlot={d.time_slot || "-"}
                  pill={`${d.items?.length || 0} items`}
                  status={toTitleCase(d.status || "")}
                  title={d.customer_name}
                  subtitle={`${d.delivery_number} • ${d.client_name}`}
                />
              ))}
              {deliveries.length === 0 && (
                <div className="text-[10px] text-[var(--yu3-ink-muted)] py-4 text-center">{partnerLabels.emptyState}</div>
              )}
            </>
          )}
        </div>
      </div>

      {portfolioPartner && isAdmin && (
        <PartnerReferralSection
          orgId={client.id}
          portalFeatures={client.portal_features}
          onSaved={() => router.refresh()}
        />
      )}

      {/* Change requests (client-submitted) */}
      {changeRequests.length > 0 && (
        <div className="border-t border-[var(--yu3-line-subtle)] pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)]">Change requests</h3>
            <Link href="/admin/change-requests" className="text-[10px] font-semibold text-[var(--yu3-wine)] hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-[var(--yu3-line-subtle)]">
            {changeRequests.slice(0, 5).map((cr) => {
              const moveData = Array.isArray(cr.moves) ? cr.moves[0] : cr.moves;
              const moveCode = moveData?.move_code ? formatJobId(moveData.move_code, "move") : "-";
              return (
                <Link
                  key={cr.id}
                  href={getMoveDetailPath({ move_code: moveData?.move_code, id: cr.move_id })}
                  className="flex items-center gap-2.5 py-3 first:pt-0 hover:text-[var(--yu3-wine)] transition-colors text-left w-full"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-[var(--yu3-ink-strong)]">{cr.type}</div>
                    <div className="text-[9px] text-[var(--yu3-ink-muted)] line-clamp-1">{cr.description}</div>
                  </div>
                  <span className="text-[9px] text-[var(--yu3-ink-muted)] shrink-0">{moveCode}</span>
                  <span className={`dt-badge tracking-[0.04em] shrink-0 ${
                    cr.status === "pending" ? "text-[var(--yu3-wine)]" : cr.status === "approved" ? "text-[var(--yu3-success)]" : "text-[var(--yu3-danger)]"
                  }`}>
                    {toTitleCase(cr.status)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoices - click opens detail popup */}
      <div className="border-t border-[var(--yu3-line-subtle)] pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)]">Invoices</h3>
          {outstandingTotal > 0 && (
            <div className="text-[11px] font-semibold text-[var(--yu3-warning)]">
              Outstanding: {formatCompactCurrency(outstandingTotal)}
            </div>
          )}
        </div>
        <div className="divide-y divide-[var(--yu3-line-subtle)]">
          {allInvoices.map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => setSummaryInvoice(inv)}
              className="flex items-center gap-2.5 py-3 first:pt-0 hover:text-[var(--yu3-wine)] transition-colors text-left w-full"
            >
              <div className="flex-1">
                <div className="text-[11px] font-semibold">{inv.invoice_number}</div>
                <div className="text-[9px] text-[var(--yu3-ink-muted)]">Due: {inv.due_date}</div>
              </div>
              <div className="text-[10px] font-bold">{formatCurrency(inv.amount)}{Number(inv.amount) > 0 ? <span className="text-[9px] text-[var(--yu3-ink-muted)] ml-0.5">+{formatCurrency(Math.round(Number(inv.amount) * 0.13))} HST</span> : null}</div>
              <Badge status={inv.status} />
            </button>
          ))}
          {allInvoices.length === 0 && (
            <div className="text-[10px] text-[var(--yu3-ink-muted)] py-4 text-center">No invoices yet</div>
          )}
        </div>
      </div>

        </div>
      )}

      <DeliverySummaryModal open={!!summaryDelivery} onClose={() => setSummaryDelivery(null)} delivery={summaryDelivery} />
      <InvoiceDetailModal open={!!summaryInvoice} onClose={() => setSummaryInvoice(null)} invoice={summaryInvoice} />

      <ContactDetailsModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        contact={{
          name: client.contact_name || client.name,
          email: client.email,
          phone: client.phone,
          company: client.name,
        }}
      />
      {isAdmin && (
        <EditPartnerModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          client={client}
          onSaved={() => router.refresh()}
        />
      )}
      {typeof document !== "undefined" &&
        deleteConfirmOpen &&
        createPortal(
          <ModalOverlay open onClose={() => setDeleteConfirmOpen(false)} title="Delete client?" maxWidth="sm">
            <div className="p-5 space-y-4">
              <p className="text-[12px] text-[var(--yu3-ink)]">
                This will remove the client from the list. Linked moves or invoices will not be deleted. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--yu3-line)] text-[var(--yu3-ink)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--yu3-danger)] text-white disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </ModalOverlay>,
          document.body
        )}
    </div>
  );
}
