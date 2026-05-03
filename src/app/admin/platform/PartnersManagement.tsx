"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useToast } from "../components/Toast";
import { Icon } from "@/components/AppIcons";
import PartnerVerticalRatesEditor from "./PartnerVerticalRatesEditor";
import ModalOverlay from "../components/ModalOverlay";
import { CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import {
  ADMIN_TOOLBAR_PRIMARY_SOLID_CLASS,
  ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS,
} from "../components/admin-toolbar-action-classes";
import { organizationTypeLabel } from "@/lib/partner-type";

interface PortalUser {
  user_id: string;
  email: string;
  name: string;
  status: string;
  last_sign_in_at: string | null;
}

interface Partner {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  portal_users: PortalUser[];
  has_portal_access: boolean;
}

interface PartnerData {
  partners: Partner[];
  totalOrgs: number;
  totalPortalUsers: number;
  totalDeliveries: number;
  totalMoves: number;
}

const TYPE_COLORS: Record<string, string> = {
  retail: "text-[#4A7CE5]",
  designer: "text-[#8B5CF6]",
  gallery: "text-[var(--accent-text)]",
  furniture_retailer: "text-[#3B82F6]",
  interior_designer: "text-[#A78BFA]",
  cabinetry: "text-[#B45309]",
  flooring: "text-[#0D9488]",
  art_gallery: "text-[var(--accent-text)]",
  antique_dealer: "text-[#BE123C]",
  hospitality: "text-[var(--org)]",
  medical_equipment: "text-[#0EA5E9]",
  av_technology: "text-[#6366F1]",
  appliances: "text-[#64748B]",
  realtor: "text-[var(--grn)]",
  property_manager: "text-[#16A34A]",
  developer: "text-[#7C3AED]",
  property_management_residential: "text-[var(--accent-text)]",
  property_management_commercial: "text-[var(--accent-text)]",
  developer_builder: "text-[#7C3AED]",
};

export default function PartnersManagement() {
  const { toast } = useToast();
  const [data, setData] = useState<PartnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAccess, setFilterAccess] = useState<"all" | "active" | "none">("all");
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{ orgId: string; user: PortalUser } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [addUserOrg, setAddUserOrg] = useState<Partner | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionDryRun, setProvisionDryRun] = useState<{ to_provision: number; already_provisioned: number; partners: { id: string; name: string; email: string; contact_name: string | null }[] } | null>(null);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionResults, setProvisionResults] = useState<{ provisioned: number; errors: number; results: { name: string; email: string; status: string; error?: string }[] } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/partners/list");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof d.error === "string" ? d.error : "Could not load partner organizations";
        throw new Error(msg);
      }
      setData(d);
    } catch (e) {
      setData(null);
      toast(e instanceof Error ? e.message : "Could not load partner organizations", "x");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRevoke = async (orgId: string, userId: string) => {
    setRevoking(userId);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/revoke-portal-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to revoke");
      toast("Portal access revoked", "check");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to revoke", "x");
    } finally {
      setRevoking(null);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (!resetPassword.trim() || resetPassword.length < 8) {
      toast("Password must be at least 8 characters", "x");
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${resetTarget.orgId}/reset-partner-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: resetTarget.user.user_id, new_password: resetPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to reset");
      toast("Password reset and email sent", "mail");
      setResetTarget(null);
      setResetPassword("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to reset", "x");
    } finally {
      setResetLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUserOrg) return;
    if (!addEmail.trim()) { toast("Email is required", "x"); return; }
    if (!addPassword.trim() || addPassword.length < 8) { toast("Password must be at least 8 characters", "x"); return; }
    setAddLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${addUserOrg.id}/invite-portal-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim(), name: addName.trim(), password: addPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to invite");
      toast("Portal user added", "mail");
      setAddUserOrg(null);
      setAddEmail("");
      setAddName("");
      setAddPassword("");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to invite", "x");
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenProvision = async () => {
    setProvisionOpen(true);
    setProvisionDryRun(null);
    setProvisionResults(null);
    setProvisionLoading(true);
    try {
      const res = await fetch("/api/admin/partners/provision-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: true }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setProvisionDryRun(d);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to preview", "x");
    } finally {
      setProvisionLoading(false);
    }
  };

  const handleRunProvision = async () => {
    setProvisionLoading(true);
    try {
      const res = await fetch("/api/admin/partners/provision-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: false, send_emails: true }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setProvisionResults(d);
      setProvisionDryRun(null);
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to provision", "x");
    } finally {
      setProvisionLoading(false);
    }
  };

  const handleResend = async (orgId: string) => {
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/resend-portal`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to resend");
      toast("Welcome email resent", "mail");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to resend", "x");
    }
  };

  const generatePwd = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
    let pwd = "";
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 12; i++) pwd += chars[arr[i]! % chars.length];
    return pwd;
  };

  const filtered = (data?.partners || []).filter((p) => {
    if (filterType !== "all" && p.type !== filterType) return false;
    if (filterAccess === "active" && !p.has_portal_access) return false;
    if (filterAccess === "none" && p.has_portal_access) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.contact_name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        p.portal_users.some((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeUsersCount = (data?.partners || []).reduce((s, p) => s + p.portal_users.filter((u) => u.status === "activated").length, 0);
  const pendingUsersCount = (data?.totalPortalUsers ?? 0) - activeUsersCount;

  return (
    <>
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="admin-section-h2 flex items-center gap-2.5">
              <Icon name="handshake" className="w-[16px] h-[16px]" /> Partner User Management
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Invite partners, manage portal access, revoke credentials</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenProvision}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--accent-text)] transition-all shrink-0"
            >
              Provision All Partners
            </button>
            <Link href="/admin/partners/onboard" className="admin-btn admin-btn-sm admin-btn-primary shrink-0 inline-flex items-center justify-center">
              + Invite New Partner
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        {!loading && data && (
          <div className="px-5 py-3 border-b border-[var(--brd)] bg-[var(--bg)]/30 flex flex-wrap gap-4">
            <Stat label="Partner Orgs" value={data.totalOrgs} />
            <Stat label="Portal Users" value={data.totalPortalUsers} />
            <Stat label="Active" value={activeUsersCount} color="var(--grn)" />
            <Stat label="Pending" value={pendingUsersCount} color="var(--gold)" />
            <Stat label="Deliveries" value={data.totalDeliveries} />
            <Stat label="Moves" value={data.totalMoves} />
          </div>
        )}

        {/* Filters: search + selects on one row; selects are width-capped because .admin-premium-input is width 100% */}
        <div className="px-5 py-3 border-b border-[var(--brd)] flex flex-row flex-wrap items-end gap-x-3 gap-y-2 sm:flex-nowrap sm:items-center">
          <div className="relative min-w-0 flex-1 basis-[min(100%,14rem)] sm:basis-auto sm:min-w-[12rem] sm:max-w-xl">
            <MagnifyingGlass size={14} weight="regular" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx2)]" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partners, users, emails..."
              className="admin-premium-input w-full pl-10 pr-3 py-2 text-[12px]"
            />
          </div>
          <div className="w-[min(100%,11rem)] shrink-0 sm:w-[10.5rem]">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="admin-premium-input admin-premium-input--compact w-full text-[var(--tx)]"
            >
              <option value="all">All Types</option>
              <optgroup label="Furniture & Design">
                <option value="furniture_retailer">Furniture Retailer</option>
                <option value="interior_designer">Interior Designer</option>
                <option value="cabinetry">Cabinetry</option>
                <option value="flooring">Flooring</option>
              </optgroup>
              <optgroup label="Art & Specialty">
                <option value="art_gallery">Art Gallery</option>
                <option value="antique_dealer">Antique Dealer</option>
              </optgroup>
              <optgroup label="Hospitality & Commercial">
                <option value="hospitality">Hospitality</option>
              </optgroup>
              <optgroup label="Medical & Technical">
                <option value="medical_equipment">Medical Equipment</option>
                <option value="av_technology">AV / Technology</option>
                <option value="appliances">Appliances</option>
              </optgroup>
              <optgroup label="Referral Partners">
                <option value="realtor">Realtor</option>
                <option value="property_manager">Property Manager</option>
                <option value="developer">Developer</option>
              </optgroup>
              <optgroup label="Legacy">
                <option value="retail">Retail (legacy)</option>
                <option value="designer">Designer (legacy)</option>
                <option value="gallery">Gallery (legacy)</option>
              </optgroup>
            </select>
          </div>
          <div className="w-[min(100%,9.5rem)] shrink-0 sm:w-[9rem]">
            <select
              value={filterAccess}
              onChange={(e) => setFilterAccess(e.target.value as "all" | "active" | "none")}
              className="admin-premium-input admin-premium-input--compact w-full text-[var(--tx)]"
            >
              <option value="all">All Access</option>
              <option value="active">Has Portal Access</option>
              <option value="none">No Portal Access</option>
            </select>
          </div>
        </div>

        {/* Partner List */}
        <div className="divide-y divide-[var(--brd)]">
          {loading ? (
            <div className="px-5 py-12 text-center text-[12px] text-[var(--tx3)]">Loading partners...</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-[12px] text-[var(--tx3)]">
              {search || filterType !== "all" || filterAccess !== "all" ? "No partners match your filters." : "No partner organizations yet."}
            </div>
          ) : (
            filtered.map((partner) => {
              const isExpanded = expandedOrg === partner.id;
              const usersCount = partner.portal_users.length;
              const activeCount = partner.portal_users.filter((u) => u.status === "activated").length;
              const typeColor = TYPE_COLORS[partner.type] || "text-[var(--accent-text)]";

              return (
                <div key={partner.id}>
                  {/* Org Row */}
                  <div
                    className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-[var(--bg)]/30 transition-colors"
                    onClick={() => setExpandedOrg(isExpanded ? null : partner.id)}
                  >
                    <CaretRight
                      size={14}
                      weight="regular"
                      className={`text-[var(--tx3)] transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                      aria-hidden
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--tx)]">
                          {partner.name}
                        </span>
                        <span
                          className={`dt-badge shrink-0 !whitespace-nowrap ${typeColor}`}
                        >
                          {partner.type === "b2b" ? "Other partner" : organizationTypeLabel(partner.type)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate">
                        {partner.contact_name && `${partner.contact_name} · `}
                        {partner.email || "No email"}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {usersCount > 0 ? (
                        <span className="text-[10px] font-semibold text-[var(--tx2)]">
                          {activeCount}/{usersCount} user{usersCount !== 1 ? "s" : ""} active
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[var(--tx3)]">No portal users</span>
                      )}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${usersCount > 0 ? "bg-[var(--grn)]" : "bg-[var(--tx3)]/30"}`} />
                    </div>
                  </div>

                  {/* Expanded: Portal Users */}
                  {isExpanded && (
                    <div className="bg-[var(--bg)]/40 border-t border-[var(--brd)]">
                      <div className="px-5 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">Portal Users</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/clients/${partner.id}`}
                            className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
                          >
                            View Details
                            <CaretRight weight="bold" className="w-3 h-3 shrink-0 opacity-90" aria-hidden />
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setAddUserOrg(partner);
                              setAddPassword(generatePwd());
                            }}
                            className={ADMIN_TOOLBAR_PRIMARY_SOLID_CLASS}
                          >
                            Add User
                          </button>
                        </div>
                      </div>

                      <PartnerVerticalRatesEditor organizationId={partner.id} />

                      {partner.portal_users.length === 0 ? (
                        <div className="px-5 pb-4 text-[11px] text-[var(--tx3)]">
                          No portal users. Click &quot;Add User&quot; to invite someone.
                        </div>
                      ) : (
                        <div className="px-5 pb-4 space-y-1.5">
                          {partner.portal_users.map((u) => (
                            <div
                              key={u.user_id}
                              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--brd)] bg-[var(--card)]"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-[12px] font-semibold text-[var(--tx)] truncate">
                                  {u.name || u.email.split("@")[0]}
                                </div>
                                <div className="text-[10px] text-[var(--tx3)] truncate">{u.email}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`dt-badge tracking-[0.04em] ${
                                  u.status === "activated"
                                    ? "text-[var(--grn)]"
                                    : "text-amber-700 dark:text-amber-300"
                                }`}>
                                  {u.status === "activated" ? "Active" : "Pending"}
                                </span>
                                {u.last_sign_in_at && (
                                  <span className="text-[9px] text-[var(--tx3)] hidden sm:block">
                                    {formatRelative(u.last_sign_in_at)}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleResend(partner.id); }}
                                  className="px-2 py-0.5 rounded-md text-[9px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--accent-text)] transition-all"
                                  title="Resend welcome email"
                                >
                                  Resend
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setResetTarget({ orgId: partner.id, user: u }); setResetPassword(generatePwd()); }}
                                  className="px-2 py-0.5 rounded-md text-[9px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--accent-text)] transition-all"
                                >
                                  Reset
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRevoke(partner.id, u.user_id); }}
                                  disabled={revoking === u.user_id}
                                  className="px-2 py-0.5 rounded-md text-[9px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                  {revoking === u.user_id ? "..." : "Revoke"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Invite New Partner Modal */}
      {/* Reset Password Modal */}
      <ModalOverlay
        open={!!resetTarget}
        onClose={() => { setResetTarget(null); setResetPassword(""); }}
        title="Reset Partner Password"
        maxWidth="md"
      >
        {resetTarget && (
          <form onSubmit={handleResetPassword} className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx3)]">
              Set a new temporary password for <strong>{resetTarget.user.name || resetTarget.user.email}</strong>. They will receive an email with the new password and login link.
            </p>
            <div>
              <label className="admin-premium-label">New Temporary Password *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                  className="admin-premium-input flex-1"
                />
                <button type="button" onClick={() => setResetPassword(generatePwd())} className="px-3 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--accent-text)]">
                  Generate
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => { setResetTarget(null); setResetPassword(""); }} className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">
                Cancel
              </button>
              <button type="submit" disabled={resetLoading} className="admin-btn admin-btn-sm admin-btn-primary flex-1">
                {resetLoading ? "Sending..." : "Set Password & Send Email"}
              </button>
            </div>
          </form>
        )}
      </ModalOverlay>

      {/* Provision All Partners Modal */}
      <ModalOverlay
        open={provisionOpen}
        onClose={() => { setProvisionOpen(false); setProvisionDryRun(null); setProvisionResults(null); }}
        title="Provision Portal Access for All Partners"
        maxWidth="md"
      >
        <div className="p-5 space-y-4">
          {provisionLoading && (
            <p className="text-[12px] text-[var(--tx3)] text-center py-4">Scanning partners...</p>
          )}

          {/* Dry-run preview */}
          {!provisionLoading && provisionDryRun && !provisionResults && (
            <>
              <div className="flex gap-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
                <div className="text-center flex-1">
                  <div className="text-[22px] font-bold text-[var(--accent-text)]">{provisionDryRun.to_provision}</div>
                  <div className="text-[10px] text-[var(--tx3)] mt-0.5">Need Access</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-[22px] font-bold text-[var(--grn)]">{provisionDryRun.already_provisioned}</div>
                  <div className="text-[10px] text-[var(--tx3)] mt-0.5">Already Set Up</div>
                </div>
              </div>

              {provisionDryRun.to_provision === 0 ? (
                <p className="text-[12px] text-[var(--grn)] text-center">All partners already have portal access.</p>
              ) : (
                <>
                  <p className="text-[12px] text-[var(--tx3)]">
                    The following {provisionDryRun.to_provision} partner{provisionDryRun.to_provision !== 1 ? "s" : ""} will be provisioned. New auth accounts will be created and welcome emails sent. Existing auth users with the same email will simply be linked, no email sent, no password changed.
                  </p>
                  <div className="max-h-[220px] overflow-y-auto space-y-1">
                    {provisionDryRun.partners.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--card)]">
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-[var(--tx)] truncate">{p.name}</div>
                          <div className="text-[10px] text-[var(--tx3)] truncate">{p.contact_name ? `${p.contact_name} · ` : ""}{p.email || "No email"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setProvisionOpen(false); setProvisionDryRun(null); }}
                      className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRunProvision}
                      className="admin-btn admin-btn-sm admin-btn-primary flex-1"
                    >
                      Provision {provisionDryRun.to_provision} Partner{provisionDryRun.to_provision !== 1 ? "s" : ""}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Results */}
          {!provisionLoading && provisionResults && (
            <>
              <div className="flex gap-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
                <div className="text-center flex-1">
                  <div className="text-[22px] font-bold text-[var(--grn)]">{provisionResults.provisioned}</div>
                  <div className="text-[10px] text-[var(--tx3)] mt-0.5">Provisioned</div>
                </div>
                {provisionResults.errors > 0 && (
                  <div className="text-center flex-1">
                    <div className="text-[22px] font-bold text-[var(--red)]">{provisionResults.errors}</div>
                    <div className="text-[10px] text-[var(--tx3)] mt-0.5">Errors</div>
                  </div>
                )}
              </div>
              <div className="max-h-[220px] overflow-y-auto space-y-1">
                {provisionResults.results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${r.status === "error" ? "border-[var(--red)]/40 bg-[var(--rdim)]" : "border-[var(--brd)] bg-[var(--card)]"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-[var(--tx)] truncate">{r.name}</div>
                      <div className="text-[10px] text-[var(--tx3)] truncate">{r.email}</div>
                      {r.error && <div className="text-[10px] text-[var(--red)] truncate">{r.error}</div>}
                    </div>
                    <span className={`dt-badge tracking-[0.04em] shrink-0 ${
                      r.status === "error" ? "text-[var(--red)]"
                      : r.status === "linked_existing" ? "text-blue-600 dark:text-sky-400"
                      : "text-[var(--grn)]"
                    }`}>
                      {r.status === "error" ? "Error" : r.status === "linked_existing" ? "Linked" : "Invited"}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { setProvisionOpen(false); setProvisionResults(null); }}
                className="admin-btn admin-btn-sm admin-btn-primary w-full"
              >
                Done
              </button>
            </>
          )}
        </div>
      </ModalOverlay>

      {/* Add Portal User Modal */}
      <ModalOverlay
        open={!!addUserOrg}
        onClose={() => { setAddUserOrg(null); setAddEmail(""); setAddName(""); setAddPassword(""); }}
        title={`Add Portal User ${addUserOrg?.name || ""}`}
        maxWidth="md"
      >
        {addUserOrg && (
          <form onSubmit={handleAddUser} className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx3)]">
              Invite someone at <strong>{addUserOrg.name}</strong> to access the partner portal.
            </p>
            <div>
              <label className="admin-premium-label">Email *</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="user@company.com"
                required
                className="admin-premium-input w-full"
              />
            </div>
            <div>
              <label className="admin-premium-label">Name</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Jane Smith"
                className="admin-premium-input w-full"
              />
            </div>
            <div>
              <label className="admin-premium-label">Temporary Password *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                  className="admin-premium-input flex-1"
                />
                <button type="button" onClick={() => setAddPassword(generatePwd())} className="px-3 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--accent-text)]">
                  Generate
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => { setAddUserOrg(null); setAddEmail(""); setAddName(""); setAddPassword(""); }} className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">
                Cancel
              </button>
              <button type="submit" disabled={addLoading} className="admin-btn admin-btn-sm admin-btn-primary flex-1">
                {addLoading ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </form>
        )}
      </ModalOverlay>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[16px] font-bold font-heading" style={color ? { color } : undefined}>{value}</span>
      <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)]">{label}</span>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
