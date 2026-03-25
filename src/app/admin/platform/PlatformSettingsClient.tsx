"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useToast } from "../components/Toast";
import { Icon } from "@/components/AppIcons";
import InviteUserModal from "./InviteUserModal";
import AddTeamMemberModal from "./AddTeamMemberModal";
import AddPortalAccessModal from "./AddPortalAccessModal";
import DeviceSetupCodes from "./DeviceSetupCodes";
import TruckAssignments from "./TruckAssignments";
import FleetVehiclesManager from "./FleetVehiclesManager";
import UserDetailModal from "./UserDetailModal";
import ModalOverlay from "../components/ModalOverlay";
import PartnersManagement from "./PartnersManagement";
import PricingControlPanel from "./PricingControlPanel";
import RateTemplatesPanel from "./RateTemplatesPanel";
import { useRouter } from "next/navigation";
import { PHONE_PLACEHOLDER } from "@/lib/phone";
import { House, Phone, EnvelopeSimple as Envelope, ShareNetwork, CaretDown, X, CurrencyDollar, ListBullets, UsersThree, DeviceMobile, Sliders, Handshake, UserCircleGear, ClipboardText, GasPump } from "@phosphor-icons/react";
import { DEFAULT_FUEL_PRICE_DIESEL, DEFAULT_FUEL_PRICE_GAS } from "@/lib/routing/fuel-config";

const TABS = [
  { id: "pricing",        label: "Pricing",        desc: "Rates & service fees",      Icon: CurrencyDollar },
  { id: "rate-templates", label: "Rate Templates",  desc: "Reusable rate cards",       Icon: ListBullets,   ownerOnly: true },
  { id: "crews",          label: "Teams",           desc: "Staff & crew groups",       Icon: UsersThree },
  { id: "devices",        label: "Devices",         desc: "Tablets, trucks & fleet",   Icon: DeviceMobile },
  { id: "app",            label: "App Settings",    desc: "Toggles & integrations",    Icon: Sliders },
  { id: "partners",       label: "Partners",        desc: "Partner access & perms",    Icon: Handshake },
  { id: "users",          label: "Users",           desc: "Roles & permissions",       Icon: UserCircleGear },
  { id: "audit",          label: "Audit Log",       desc: "Activity & access history", Icon: ClipboardText },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface StaffMember { id: string; name: string; role: string; phone?: string; email?: string; is_active: boolean; deactivated_at?: string | null; hourly_rate?: number; specialties?: string[]; hire_date?: string | null; }

function formatLastActive(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString();
}

function ReadinessChecklistSection() {
  const { toast } = useToast();
  const [items, setItems] = useState<{ label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    fetch("/api/admin/platform-settings/readiness")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setItems(d.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (items.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/platform-settings/readiness", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ items }),
      });
      const data = (await res.json().catch(() => ({}))) as { items?: { label: string }[]; error?: string };
      if (!res.ok) {
        toast(typeof data.error === "string" ? data.error : "Failed to save", "x");
        return;
      }
      setItems(data.items || items);
      toast("Readiness checklist updated", "check");
    } catch {
      toast("Failed to save", "x");
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    const label = newLabel.trim();
    if (!label) return;
    setItems((prev) => [...prev, { label }]);
    setNewLabel("");
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, label: string) => {
    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, label } : x)));
  };

  if (loading) return <div className="py-6"><p className="text-[12px] text-[var(--tx3)]">Loading…</p></div>;

  return (
    <section className="pt-6 border-t border-[var(--brd)]/30">
      <div className="mb-4">
        <h2 className="admin-section-h2 flex items-center gap-2">
          <Icon name="clipboard" className="w-[14px] h-[14px]" /> Readiness Checklist
        </h2>
        <p className="text-[11px] text-[var(--tx3)] mt-1">Configure items for crew pre-trip readiness check</p>
      </div>
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={item.label}
                onChange={(e) => updateItem(i, e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)]"
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="p-2 rounded-lg text-[var(--red)] hover:bg-[var(--rdim)]"
                aria-label="Remove"
              >
                <Icon name="x" className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
            placeholder="Add new item..."
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)]"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!newLabel.trim()}
            className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || items.length === 0}
          className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save checklist"}
        </button>
      </div>
    </section>
  );
}

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-[var(--gdim)] text-[var(--gold)]",
  admin: "bg-blue-500/15 text-blue-400",
  coordinator: "bg-green-500/15 text-green-400",
};
const ACTION_BADGE: Record<string, string> = {
  edit_pricing: "bg-amber-500/15 text-amber-400",
  access_denied: "bg-red-500/15 text-red-400",
  login: "bg-green-500/15 text-green-400",
  send_quote: "bg-blue-500/15 text-blue-400",
};

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "login",                  label: "Login" },
  { value: "config_change",          label: "Config Change" },
  { value: "edit_pricing",           label: "Edit Pricing" },
  { value: "edit_specialty_pricing", label: "Edit Specialty Pricing" },
  { value: "edit_b2b_surcharges",    label: "Edit B2B Surcharges" },
  { value: "send_quote",             label: "Send Quote" },
  { value: "quote_status_change",    label: "Quote Status Change" },
  { value: "access_denied",          label: "Access Denied" },
  { value: "edit_move",              label: "Edit Move" },
  { value: "move_status_change",     label: "Move Status Change" },
  { value: "create_move",            label: "Create Move" },
  { value: "update_move",            label: "Update Move" },
  { value: "create_quote",           label: "Create Quote" },
  { value: "update_quote",           label: "Update Quote" },
  { value: "invite_user",            label: "Invite User" },
  { value: "update_role",            label: "Update Role" },
];

function humanizeAction(action: string): string {
  if (!action) return "-";
  const match = ACTION_OPTIONS.find((o) => o.value === action);
  if (match) return match.label;
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function AuditLogSection() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ action: "", search: "" });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams();
    if (filters.action) params.set("action", filters.action);
    if (filters.search.trim()) params.set("search", filters.search.trim());
    fetch(`/api/admin/audit-log?${params}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setFetchError(typeof d.error === "string" ? d.error : "Failed to load audit log");
          setLogs([]);
          return;
        }
        setLogs(Array.isArray(d.logs) ? d.logs : []);
      })
      .catch(() => {
        setFetchError("Network error");
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, [filters.action, filters.search]);

  const filtered = logs;

  return (
    <section className="pt-6 border-t border-[var(--brd)]/30 first:border-t-0 first:pt-0">
      <div className="mb-4">
        <h2 className="admin-section-h2 flex items-center gap-2">
          <Icon name="clipboard" className="w-[14px] h-[14px]" /> Audit Log
        </h2>
        <p className="text-[11px] text-[var(--tx3)] mt-1">Platform activity and access history</p>
      </div>

      {/* Filter bar */}
      <div className="py-3 border-b border-[var(--brd)]/30 flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Action</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[11px] text-[var(--tx)] outline-none focus:border-[var(--brd)]"
          >
            <option value="">All</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Search</label>
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Filter by email or resource..."
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[11px] text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--brd)]"
          />
        </div>
      </div>

      <div className="py-4">
        {loading ? (
          <div className="py-8 text-center text-[12px] text-[var(--tx3)]">Loading audit log…</div>
        ) : fetchError ? (
          <div className="py-8 text-center text-[12px] text-[var(--red)]">{fetchError}</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-[12px] text-[var(--tx3)]">No entries found</p>
            <p className="text-[11px] text-[var(--tx3)]/70 max-w-md mx-auto">
              New rows are recorded when you sign in or perform actions (quotes, pricing, moves). If this stays empty, confirm the{" "}
              <code className="text-[10px] bg-[var(--bg)] px-1 rounded">audit_log</code> table exists in Supabase and{" "}
              <code className="text-[10px] bg-[var(--bg)] px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> is set on the server.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--brd)]">
                  {["Time", "User", "Role", "Action", "Resource", "Details"].map((h) => (
                    <th key={h} className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const roleKey = (log.user_role ?? log.role ?? "") as string;
                  const roleCls = ROLE_BADGE[roleKey] || "bg-[var(--brd)] text-[var(--tx3)]";
                  const actionCls = ACTION_BADGE[log.action] || "bg-[var(--brd)] text-[var(--tx3)]";
                  const isExpanded = expandedRow === log.id;
                  const hasDetails = log.details && Object.keys(log.details).length > 0;
                  return (
                    <tr key={log.id} className="border-b border-[var(--brd)] last:border-0">
                      <td className="text-[11px] text-[var(--tx)] py-2.5 pr-4 whitespace-nowrap">{formatAuditTime(log.created_at)}</td>
                      <td className="text-[11px] text-[var(--tx)] py-2.5 pr-4 max-w-[140px] truncate" title={log.user_email}>{log.user_email}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${roleCls}`}>{roleKey || "-"}</span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${actionCls}`}>{humanizeAction(log.action)}</span>
                      </td>
                      <td className="text-[11px] text-[var(--tx3)] py-2.5 pr-4 max-w-[120px] truncate" title={log.resource_id}>{log.resource_id || "-"}</td>
                      <td className="text-[11px] text-[var(--tx3)] py-2.5">
                        {hasDetails ? (
                          <button
                            type="button"
                            onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                            className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                          >
                            {isExpanded ? "Hide" : "View"}
                          </button>
                        ) : (
                          "-"
                        )}
                        {isExpanded && hasDetails && (
                          <pre className="mt-2 p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[10px] text-[var(--tx3)] whitespace-pre-wrap break-all max-w-[320px] overflow-auto max-h-[160px]">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

interface Team {
  id: string;
  label: string;
  memberIds: string[];
  active: boolean;
  phone?: string;
}

interface BlockingTeamJobMove {
  id: string;
  move_code: string | null;
  summary: string;
  status_label: string;
  can_reassign: boolean;
}

interface BlockingTeamJobDelivery {
  id: string;
  delivery_number: string | null;
  summary: string;
  status_label: string;
  can_reassign: boolean;
}

interface TeamDeleteBlockedState {
  teamId: string;
  teamLabel: string;
  moves: BlockingTeamJobMove[];
  deliveries: BlockingTeamJobDelivery[];
}

interface CrewPortalMember {
  id: string;
  name: string;
  phone: string;
  role: string;
  team_id: string;
  is_active: boolean;
}

interface AppToggles {
  crewTracking: boolean;
  partnerPortal: boolean;
  autoInvoicing: boolean;
}

interface ReviewConfig {
  autoReviewRequests: boolean;
  googleReviewUrl: string;
}

interface PlatformSettingsClientProps {
  initialTeams?: Team[];
  initialToggles?: AppToggles;
  initialReviewConfig?: ReviewConfig;
  currentUserId?: string;
  isSuperAdmin?: boolean;
}

const DEFAULT_TOGGLES: AppToggles = { crewTracking: true, partnerPortal: false, autoInvoicing: true };

function BusinessInfoSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/business-config")
      .then((r) => r.json())
      .then((d) => { if (d && typeof d === "object" && !d.error) setConfig(d); })
      .catch((err) => console.error("[BusinessInfo] fetch failed", err))
      .finally(() => setLoading(false));
  }, []);

  const ALL_KEYS = [
    "company_name", "company_legal_name", "company_phone", "company_email",
    "company_address", "company_hst_number", "business_hours", "after_hours_contact",
    "company_website", "dispatch_phone",
    "notifications_from_email", "admin_notification_email",
    "company_social_instagram", "company_social_facebook",
    "company_social_twitter", "company_social_linkedin",
    "company_review_url",
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const k of ALL_KEYS) {
        if (config[k] !== undefined) payload[k] = config[k];
      }
      const res = await fetch("/api/admin/business-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(typeof (errBody as { error?: string }).error === "string" ? (errBody as { error: string }).error : "Failed to save", "x");
        return;
      }
      toast("Business info saved", "check");
    } catch { toast("Failed to save", "x"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-6"><p className="text-[12px] text-[var(--tx3)]">Loading...</p></div>;

  const inputCls = "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none";
  const labelCls = "block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5";
  const subheadCls = "text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]/60 mb-3 flex items-center gap-1.5";

  const inp = (key: string, label: string, placeholder: string, type = "text") => (
    <div key={key}>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        value={config[key] || ""}
        onChange={(e) => setConfig((prev) => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );

  return (
    <section className="pt-6 border-t border-[var(--brd)]/30">
      <div className="mb-4">
        <h2 className="admin-section-h2 flex items-center gap-2">
          <Icon name="building" className="w-[14px] h-[14px]" /> Business Information
        </h2>
        <p className="text-[11px] text-[var(--tx3)] mt-1">Company details used across quotes, invoices, emails, and customer-facing pages. Update here instead of in code.</p>
      </div>
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-6">

        {/* Core company details */}
        <div>
          <div className={subheadCls}>
            <House size={12} className="shrink-0 text-current" />
            Company Details
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {inp("company_name", "Company Name", "HelloYugo")}
            {inp("company_legal_name", "Legal Name", "HelloYugo Inc.")}
            {inp("company_address", "Address", "50 Carroll St, Toronto, ON")}
            {inp("company_hst_number", "HST / Tax Number", "123456789RT0001")}
            {inp("company_website", "Website", "https://helloyugo.com", "url")}
          </div>
        </div>

        {/* Contact info */}
        <div className="pt-4 border-t border-[var(--brd)]/30">
          <div className={subheadCls}>
            <Phone size={12} className="shrink-0 text-current" />
            Contact &amp; Hours
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {inp("company_phone", "Main Phone", PHONE_PLACEHOLDER, "tel")}
            {inp("dispatch_phone", "Dispatch Phone", PHONE_PLACEHOLDER, "tel")}
            {inp("company_email", "Company Email", "info@helloyugo.com", "email")}
            {inp("after_hours_contact", "After-Hours Contact", "Emergency phone or email")}
            {inp("business_hours", "Business Hours", "Mon-Sat 7:00 AM - 8:00 PM")}
          </div>
        </div>

        {/* Notification emails */}
        <div className="pt-4 border-t border-[var(--brd)]/30">
          <div className={subheadCls}>
            <Envelope size={12} className="shrink-0 text-current" />
            Email Configuration
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {inp("notifications_from_email", "Notifications 'From' Email", "notifications@opsplus.co", "email")}
            {inp("admin_notification_email", "Admin Notification Email", "admin@helloyugo.com", "email")}
          </div>
          <p className="text-[10px] text-[var(--tx3)] mt-2">The &quot;From&quot; email must be verified in your email provider (Resend). Admin notification email receives payment failures, tips, etc.</p>
        </div>

        {/* Social media & reviews */}
        <div className="pt-4 border-t border-[var(--brd)]/30">
          <div className={subheadCls}>
            <ShareNetwork size={12} className="shrink-0 text-current" />
            Social &amp; Reviews
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {inp("company_review_url", "Google Review URL", "https://g.page/r/your-review-link", "url")}
            {inp("company_social_instagram", "Instagram URL", "https://instagram.com/yourpage", "url")}
            {inp("company_social_facebook", "Facebook URL", "https://facebook.com/yourpage", "url")}
            {inp("company_social_twitter", "X (Twitter) URL", "https://x.com/yourpage", "url")}
            {inp("company_social_linkedin", "LinkedIn URL", "https://linkedin.com/company/yourco", "url")}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50">
          {saving ? "Saving..." : "Save Business Info"}
        </button>
      </div>
    </section>
  );
}

function FuelPricingSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gas, setGas] = useState(String(DEFAULT_FUEL_PRICE_GAS));
  const [diesel, setDiesel] = useState(String(DEFAULT_FUEL_PRICE_DIESEL));
  const [fuelType, setFuelType] = useState<"gas" | "diesel">("gas");

  useEffect(() => {
    fetch("/api/admin/overhead-config", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { config?: Record<string, string> }) => {
        const c = d.config;
        if (!c || typeof c !== "object") return;
        if (c.fuel_price_gas_cad_per_litre) setGas(c.fuel_price_gas_cad_per_litre);
        if (c.fuel_price_diesel_cad_per_litre) setDiesel(c.fuel_price_diesel_cad_per_litre);
        setFuelType(c.navigation_fuel_type?.toLowerCase().trim() === "diesel" ? "diesel" : "gas");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/overhead-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          fuel_price_gas_cad_per_litre: gas,
          fuel_price_diesel_cad_per_litre: diesel,
          navigation_fuel_type: fuelType,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(typeof body.error === "string" ? body.error : "Failed to save", "x");
        return;
      }
      toast("Fuel settings saved", "check");
    } catch {
      toast("Failed to save", "x");
    } finally {
      setSaving(false);
    }
  };

  const activePrice = fuelType === "diesel" ? diesel : gas;

  if (loading) {
    return (
      <section className="pt-6 border-t border-[var(--brd)]/30">
        <p className="text-[12px] text-[var(--tx3)] py-4">Loading…</p>
      </section>
    );
  }

  return (
    <section className="pt-6 border-t border-[var(--brd)]/30">
      <div className="mb-4">
        <h2 className="admin-section-h2 flex items-center gap-2">
          <GasPump className="w-[16px] h-[16px]" weight="duotone" aria-hidden /> Fuel pricing (CAD/L)
        </h2>
        <p className="text-[11px] text-[var(--tx3)] mt-1">
          Used for crew navigation fuel estimates, dispatch map route comparisons, and logged fuel cost on moves when navigation completes. Set both gasoline and diesel prices, then choose which fuel the fleet is running for estimates.
        </p>
      </div>
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Gasoline ($/L)</label>
            <input
              type="number"
              min={0.01}
              max={50}
              step={0.01}
              value={gas}
              onChange={(e) => setGas(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Diesel ($/L)</label>
            <input
              type="number"
              min={0.01}
              max={50}
              step={0.01}
              value={diesel}
              onChange={(e) => setDiesel(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Active fuel for estimates</label>
          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value === "diesel" ? "diesel" : "gas")}
            className="w-full sm:max-w-xs px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
          >
            <option value="gas">Gasoline</option>
            <option value="diesel">Diesel</option>
          </select>
          <p className="text-[10px] text-[var(--tx3)] mt-1.5">
            Currently using <span className="text-[var(--tx2)] font-medium">{fuelType === "diesel" ? "diesel" : "gasoline"}</span> at{" "}
            <span className="text-[var(--gold)] font-semibold">${activePrice}</span>/L for navigation and fuel logging.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save fuel settings"}
        </button>
      </div>
    </section>
  );
}

function QuotingDefaultsSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/business-config")
      .then((r) => r.json())
      .then((d) => { if (d && typeof d === "object" && !d.error) setConfig(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/business-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          quote_expiry_days: config.quote_expiry_days,
          default_deposit_pct: config.default_deposit_pct,
          minimum_deposit: config.minimum_deposit,
          quote_id_prefix: config.quote_id_prefix,
          auto_followup_enabled: config.auto_followup_enabled,
          followup_max_attempts: config.followup_max_attempts,
          change_request_enabled: config.change_request_enabled,
          change_request_per_score_rate: config.change_request_per_score_rate,
          change_request_min_hours_before_move: config.change_request_min_hours_before_move,
          change_request_max_items_per_request: config.change_request_max_items_per_request,
        }),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(typeof (errBody as { error?: string }).error === "string" ? (errBody as { error: string }).error : "Failed to save", "x");
        return;
      }
      toast("Quoting defaults saved", "check");
    } catch { toast("Failed to save", "x"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-6"><p className="text-[12px] text-[var(--tx3)]">Loading...</p></div>;

  return (
    <section className="pt-6 border-t border-[var(--brd)]/30">
      <div className="mb-4">
        <h2 className="admin-section-h2 flex items-center gap-2">
          <Icon name="fileText" className="w-[14px] h-[14px]" /> Quoting Defaults
        </h2>
        <p className="text-[11px] text-[var(--tx3)] mt-1">Default settings for quote generation</p>
      </div>
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Quote Expiry (days)</label>
            <input type="number" value={config.quote_expiry_days || "7"} onChange={(e) => setConfig((p) => ({ ...p, quote_expiry_days: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Default Deposit %</label>
            <input type="number" value={config.default_deposit_pct || "25"} onChange={(e) => setConfig((p) => ({ ...p, default_deposit_pct: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Minimum Deposit ($)</label>
            <input type="number" value={config.minimum_deposit || "100"} onChange={(e) => setConfig((p) => ({ ...p, minimum_deposit: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Quote ID Prefix</label>
            <input type="text" value={config.quote_id_prefix || "YG-"} onChange={(e) => setConfig((p) => ({ ...p, quote_id_prefix: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Follow-up Max Attempts</label>
            <input type="number" value={config.followup_max_attempts || "3"} onChange={(e) => setConfig((p) => ({ ...p, followup_max_attempts: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx)]">
              <input type="checkbox" checked={config.auto_followup_enabled === "true"} onChange={(e) => setConfig((p) => ({ ...p, auto_followup_enabled: e.target.checked ? "true" : "false" }))} className="accent-[var(--gold)]" />
              Auto-send follow-up
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--brd)]/40">
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">Client inventory changes (pre-move)</div>
          <p className="text-[11px] text-[var(--tx3)] mb-3">
            Lets clients add/remove catalog items from the move tracking page before move day (with coordinator review).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx)]">
              <input
                type="checkbox"
                checked={config.change_request_enabled === "true"}
                onChange={(e) => setConfig((p) => ({ ...p, change_request_enabled: e.target.checked ? "true" : "false" }))}
                className="accent-[var(--gold)]"
              />
              Enable inventory change requests
            </label>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">$ per weight-score unit</label>
              <input
                type="number"
                value={config.change_request_per_score_rate || "35"}
                onChange={(e) => setConfig((p) => ({ ...p, change_request_per_score_rate: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Min hours before move</label>
              <input
                type="number"
                value={config.change_request_min_hours_before_move || "48"}
                onChange={(e) => setConfig((p) => ({ ...p, change_request_min_hours_before_move: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Max lines per request</label>
              <input
                type="number"
                value={config.change_request_max_items_per_request || "10"}
                onChange={(e) => setConfig((p) => ({ ...p, change_request_max_items_per_request: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none"
              />
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50">
          {saving ? "Saving..." : "Save Quoting Defaults"}
        </button>
      </div>
    </section>
  );
}

function FeatureTogglesSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Record<string, string>>({});
  const savedToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/business-config")
      .then((r) => r.json())
      .then((d) => { if (d && typeof d === "object" && !d.error) setConfig(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleFeature = async (key: string) => {
    const current = config[key] === "true";
    const next = !current;
    setConfig((prev) => ({ ...prev, [key]: next ? "true" : "false" }));
    try {
      const res = await fetch("/api/admin/business-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next ? "true" : "false" }),
      });
      if (!res.ok) {
        toast("Failed to save", "x");
        setConfig((prev) => ({ ...prev, [key]: current ? "true" : "false" }));
        return;
      }
      if (savedToastRef.current) clearTimeout(savedToastRef.current);
      savedToastRef.current = setTimeout(() => {
        toast("Feature setting saved", "check");
        savedToastRef.current = null;
      }, 350);
    } catch {
      setConfig((prev) => ({ ...prev, [key]: current ? "true" : "false" }));
      toast("Failed to save", "x");
    }
  };

  const [embedCopied, setEmbedCopied] = useState(false);

  if (loading) return <div className="py-6"><p className="text-[12px] text-[var(--tx3)]">Loading...</p></div>;

  const features = [
    { key: "tipping_enabled", label: "Tipping System", desc: "Allow clients to tip crew after move completion" },
    { key: "quote_engagement_tracking", label: "Quote Engagement Tracking", desc: "Track client behaviour on the quote page" },
    { key: "instant_quote_widget", label: "Instant Quote Widget", desc: "Enable public quote calculator on website" },
    { key: "valuation_upgrades", label: "Valuation Upgrades", desc: "Show protection upgrade options on client quotes" },
    { key: "sms_eta_enabled", label: "SMS ETA Updates", desc: "Send SMS updates with crew ETA on move/delivery day (departure, 15-min, arrived, completed)" },
    { key: "quote_sms_enabled", label: "Quote link SMS", desc: "Text clients the quote link when a quote is sent or re-sent (requires Twilio)" },
  ];

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const widgetEnabled = config["instant_quote_widget"] === "true";

  const embedCode = `<!-- Yugo+ Instant Quote Widget -->
<div id="yugo-quote-widget"></div>
<script>
(function() {
  var d = document, s = d.createElement('script');
  s.src = '${appUrl}/widget/quote.js';
  s.async = true;
  s.setAttribute('data-origin', '${appUrl}');
  d.getElementById('yugo-quote-widget').appendChild(s);
})();
</script>
<!-- End Yugo+ Widget -->`;

  const iframeCode = `<!-- Yugo+ Instant Quote (iframe) -->
<iframe
  src="${appUrl}/widget/quote"
  width="100%"
  height="720"
  frameborder="0"
  style="border:none;border-radius:12px;"
  title="Get a Quote - Yugo+"
></iframe>`;

  const copyEmbed = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setEmbedCopied(true);
      toast("Copied to clipboard", "check");
      setTimeout(() => setEmbedCopied(false), 2000);
    });
  };

  return (
    <section className="pt-5 border-t border-[var(--brd)]/30">
      <div className="mb-3">
        <h2 className="admin-section-h2 flex items-center gap-2">
          <Icon name="toggleRight" className="w-[14px] h-[14px]" /> Feature Toggles
        </h2>
        <p className="text-[11px] text-[var(--tx3)] mt-0.5">Enable or disable platform features</p>
      </div>
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
      <div className="px-4 py-4 space-y-0">
        {features.map((f) => {
          const isOn = config[f.key] === "true";
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between py-3 border-b border-[var(--brd)] last:border-0">
                <div>
                  <div className="text-[13px] font-semibold text-[var(--tx)]">{f.label}</div>
                  <div className="text-[11px] text-[var(--tx3)] mt-0.5">{f.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFeature(f.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${isOn ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOn ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Embed code panel for Instant Quote Widget */}
              {f.key === "instant_quote_widget" && isOn && (
                <div className="py-4 px-1 border-b border-[var(--brd)] space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-bold text-[var(--tx2)]">Embed Code (JavaScript)</div>
                      <button type="button" onClick={() => copyEmbed(embedCode)} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
                        {embedCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--tx3)] mb-2">
                      Paste this into your website HTML where you want the quote calculator to appear. It loads asynchronously and matches your brand styling.
                    </p>
                    <pre className="text-[10px] leading-relaxed bg-[var(--bg)] border border-[var(--brd)] rounded-lg p-3 overflow-x-auto text-[var(--tx2)] font-mono whitespace-pre-wrap break-all select-all">
                      {embedCode}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-bold text-[var(--tx2)]">Embed Code (iframe)</div>
                      <button type="button" onClick={() => copyEmbed(iframeCode)} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
                        Copy
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--tx3)] mb-2">
                      Simpler option: embeds the quote form in an iframe. No JavaScript required.
                    </p>
                    <pre className="text-[10px] leading-relaxed bg-[var(--bg)] border border-[var(--brd)] rounded-lg p-3 overflow-x-auto text-[var(--tx2)] font-mono whitespace-pre-wrap break-all select-all">
                      {iframeCode}
                    </pre>
                  </div>

                  <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2.5">
                    <div className="text-[10px] font-semibold text-[var(--tx2)] mb-0.5">Tip</div>
                    <div className="text-[10px] text-[var(--tx3)] leading-relaxed">
                      The widget loads <span className="font-mono text-[var(--tx2)]">/widget/quote</span> on this app. Use the same site origin in <span className="font-mono">data-origin</span> as your public marketing domain if they differ.
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
}

function EmailTemplatesSection() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/email-templates")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setTemplates(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const SLUG_LABELS: Record<string, string> = {
    quote_email: "Quote Email",
    booking_confirmation: "Booking Confirmation",
    follow_up_reminder: "Follow-Up Reminder",
    move_day_details: "Move Day Details",
    completion_review: "Completion + Review",
    invoice: "Invoice",
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, subject: editSubject, body_html: editBody }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed", "x"); return; }
      setTemplates((prev) => prev.map((t) => (t.id === editing.id ? data : t)));
      setEditing(null);
      toast("Template saved", "check");
    } catch { toast("Failed to save", "x"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-6"><p className="text-[12px] text-[var(--tx3)]">Loading...</p></div>;

  const previewTpl = templates.find((t) => t.template_slug === previewSlug);

  return (
    <>
    <section className="pt-6 border-t border-[var(--brd)]/30">
      <div className="mb-4">
        <h2 className="admin-section-h2 flex items-center gap-2">
          <Icon name="mail" className="w-[14px] h-[14px]" /> Email Templates
        </h2>
        <p className="text-[11px] text-[var(--tx3)] mt-1">Customize client-facing emails. Use merge variables like {"{{client_name}}"}, {"{{move_date}}"}, {"{{quote_link}}"}</p>
      </div>
      <div className="space-y-2">
        {templates.length === 0 ? (
          <p className="text-[12px] text-[var(--tx3)] py-4 text-center">No email templates configured yet. Run the migration to seed defaults.</p>
        ) : templates.map((tpl) => (
          <div key={tpl.id} className="flex items-center gap-3 justify-between py-2.5 px-3 rounded-lg border border-[var(--brd)] hover:border-[var(--gold)]/30 transition-colors">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-[var(--tx)] truncate">{SLUG_LABELS[tpl.template_slug] || tpl.template_slug}</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate">{tpl.subject}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={() => setPreviewSlug(tpl.template_slug)} className="px-2.5 py-1 rounded text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--gold)] hover:border-[var(--gold)]">Preview</button>
              <button type="button" onClick={() => { setEditing(tpl); setEditSubject(tpl.subject); setEditBody(tpl.body_html); }} className="px-2.5 py-1 rounded text-[10px] font-semibold border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* Edit Template Modal */}
    {editing && (
      <ModalOverlay open onClose={() => setEditing(null)} title={`Edit: ${SLUG_LABELS[editing.template_slug] || editing.template_slug}`} maxWidth="md">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Subject Line</label>
            <input type="text" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Body (HTML)</label>
            <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={8} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] text-[var(--tx)] font-mono focus:border-[var(--brd)] outline-none resize-y" />
          </div>
          {editing.merge_variables?.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Available Variables</label>
              <div className="flex flex-wrap gap-1.5">
                {editing.merge_variables.map((v: string) => (
                  <span key={v} className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--brd)] text-[var(--gold)] font-mono">{`{{${v}}}`}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setEditing(null)} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50">{saving ? "Saving..." : "Save Template"}</button>
          </div>
        </div>
      </ModalOverlay>
    )}

    {/* Preview Template Modal */}
    {previewTpl && (
      <ModalOverlay open onClose={() => setPreviewSlug(null)} title={`Preview: ${SLUG_LABELS[previewTpl.template_slug] || previewTpl.template_slug}`} maxWidth="md">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Subject</label>
            <div className="px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)]">{previewTpl.subject.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => ({ client_name: "John Smith", company_name: "Yugo", move_date: "March 15, 2026", quote_link: "https://app.helloyugo.com/quote/abc123", total_price: "$1,250.00", crew_names: "Marcus, Devon", company_phone: "(647) 370-4525", move_address: "123 Queen St W" }[key] || `{{${key}}}`) )}</div>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Body Preview</label>
            <div className="px-4 py-3 bg-[var(--card)] rounded-lg text-[13px] text-[var(--tx)]" dangerouslySetInnerHTML={{ __html: previewTpl.body_html.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => ({ client_name: "John Smith", company_name: "Yugo", move_date: "March 15, 2026", quote_link: "https://app.helloyugo.com/quote/abc123", total_price: "$1,250.00", crew_names: "Marcus, Devon", company_phone: "(647) 370-4525", move_address: "123 Queen St W" }[key] || `{{${key}}}`) )} } />
          </div>
          <button type="button" onClick={() => setPreviewSlug(null)} className="w-full px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]">Close</button>
        </div>
      </ModalOverlay>
    )}
    </>
  );
}

const DEFAULT_REVIEW_CONFIG: ReviewConfig = { autoReviewRequests: true, googleReviewUrl: "https://g.page/r/CU67iDN6TgMIEB0/review/" };

export default function PlatformSettingsClient({ initialTeams = [], initialToggles = DEFAULT_TOGGLES, initialReviewConfig = DEFAULT_REVIEW_CONFIG, currentUserId, isSuperAdmin = false }: PlatformSettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const tabParam = searchParams.get("tab") || "pricing";
  const activeTab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "pricing";
  const [inviteUserOpen, setInviteUserOpen] = useState(false);
  const [users, setUsers] = useState<{ id: string; email: string; name: string | null; role: string; status: string; last_sign_in_at?: string | null; phone?: string | null }[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; name: string | null; role: string; phone?: string | null } | null>(null);
  const [crewTracking, setCrewTracking] = useState(initialToggles.crewTracking);
  const [partnerPortal, setPartnerPortal] = useState(initialToggles.partnerPortal);
  const [autoInvoicing, setAutoInvoicing] = useState(initialToggles.autoInvoicing);
  const [togglesSaving, setTogglesSaving] = useState(false);
  const [autoReviewRequests, setAutoReviewRequests] = useState(initialReviewConfig.autoReviewRequests);
  const [googleReviewUrl, setGoogleReviewUrl] = useState(initialReviewConfig.googleReviewUrl);
  const [reviewConfigSaving, setReviewConfigSaving] = useState(false);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [addTeamModalOpen, setAddTeamModalOpen] = useState(false);
  const [addTeamMemberOpen, setAddTeamMemberOpen] = useState(false);
  const [addTeamName, setAddTeamName] = useState("");
  const [addTeamMembers, setAddTeamMembers] = useState<string[]>([]);
  const [crewPortalMembers, setCrewPortalMembers] = useState<CrewPortalMember[]>([]);
  const [crewPortalLoading, setCrewPortalLoading] = useState(false);
  const [resetPinMember, setResetPinMember] = useState<CrewPortalMember | null>(null);
  const [resetPinValue, setResetPinValue] = useState("");
  const [resetPinSaving, setResetPinSaving] = useState(false);
  const [addPortalOpen, setAddPortalOpen] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [teamDeleteBlocked, setTeamDeleteBlocked] = useState<TeamDeleteBlockedState | null>(null);
  const [reassignPick, setReassignPick] = useState<Record<string, string>>({});
  const [reassignSubmitting, setReassignSubmitting] = useState<string | null>(null);
  const [confirmPartnerPortalOff, setConfirmPartnerPortalOff] = useState(false);
  const [confirmCrewTrackingOff, setConfirmCrewTrackingOff] = useState(false);
  const [staffRoster, setStaffRoster] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showInactiveStaff, setShowInactiveStaff] = useState(false);
  const [showAllActiveStaff, setShowAllActiveStaff] = useState(false);
  const [addStaffName, setAddStaffName] = useState("");
  const [addStaffRole, setAddStaffRole] = useState("mover");
  const [addStaffSaving, setAddStaffSaving] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editStaffName, setEditStaffName] = useState("");
  const [editStaffRole, setEditStaffRole] = useState("");
  const [editStaffPhone, setEditStaffPhone] = useState("");
  const [editStaffEmail, setEditStaffEmail] = useState("");
  const [editStaffSaving, setEditStaffSaving] = useState(false);
  const [confirmDeleteStaff, setConfirmDeleteStaff] = useState<StaffMember | null>(null);
  const [deleteStaffSaving, setDeleteStaffSaving] = useState(false);

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  useEffect(() => {
    if (activeTab !== "crews") return;
    let cancelled = false;
    setCrewPortalLoading(true);
    setStaffLoading(true);
    Promise.all([
      fetch("/api/admin/crew-members").then((r) => r.json()),
      fetch("/api/admin/staff-roster").then((r) => r.json()),
    ]).then(([crewData, staffData]) => {
      if (cancelled) return;
      if (Array.isArray(crewData)) setCrewPortalMembers(crewData);
      if (Array.isArray(staffData)) setStaffRoster(staffData);
    }).catch(() => {
      if (!cancelled) { setCrewPortalMembers([]); setStaffRoster([]); }
    }).finally(() => {
      if (!cancelled) { setCrewPortalLoading(false); setStaffLoading(false); }
    });
    return () => { cancelled = true; };
  }, [activeTab]);

  const activeStaffNames = staffRoster.filter((s) => s.is_active).map((s) => s.name);
  const inactiveStaff = staffRoster.filter((s) => !s.is_active);

  const handleAddStaff = async () => {
    const name = addStaffName.trim();
    if (!name) return;
    setAddStaffSaving(true);
    try {
      const res = await fetch("/api/admin/staff-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role: addStaffRole }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed to add", "x"); return; }
      setStaffRoster((prev) => [...prev, data]);
      setAddStaffName("");
      setAddStaffRole("mover");
      toast(`${name} added to staff roster`, "check");
    } catch { toast("Failed to add", "x"); }
    finally { setAddStaffSaving(false); }
  };

  const handleDeactivateStaff = async (staff: StaffMember) => {
    if (!window.confirm(`Remove ${staff.name} from the active roster? They will be moved to the inactive list and removed from all teams.`)) return;
    try {
      const res = await fetch("/api/admin/staff-roster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: staff.id, is_active: false }),
      });
      if (!res.ok) { toast("Failed to deactivate", "x"); return; }
      setStaffRoster((prev) => prev.map((s) => s.id === staff.id ? { ...s, is_active: false, deactivated_at: new Date().toISOString() } : s));
      for (let i = 0; i < teams.length; i++) {
        const norm = (s: string) => s.trim().toLowerCase();
        if (teams[i].memberIds.some((id) => norm(id) === norm(staff.name))) {
          const newMembers = teams[i].memberIds.filter((id) => norm(id) !== norm(staff.name));
          setTeams((prev) => { const n = [...prev]; n[i] = { ...n[i], memberIds: newMembers }; return n; });
          fetch("/api/crews/update-members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crewId: teams[i].id, members: newMembers }) });
        }
      }
      toast(`${staff.name} removed from active roster`, "check");
    } catch { toast("Failed to deactivate", "x"); }
  };

  const handleEditStaff = async () => {
    if (!editingStaff) return;
    const name = editStaffName.trim();
    if (!name) { toast("Name is required", "x"); return; }
    setEditStaffSaving(true);
    try {
      const res = await fetch("/api/admin/staff-roster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingStaff.id,
          name,
          role: editStaffRole,
          phone: editStaffPhone || null,
          email: editStaffEmail || null,
          hourly_rate: editingStaff.hourly_rate ?? 25,
          specialties: editingStaff.specialties ?? [],
        }),
      });
      if (!res.ok) { toast("Failed to update", "x"); return; }
      const data = await res.json();
      const oldName = editingStaff.name;
      setStaffRoster((prev) => prev.map((s) => s.id === editingStaff.id ? data : s));
      if (oldName !== name) {
        setTeams((prev) => prev.map((t) => ({
          ...t,
          memberIds: t.memberIds.map((id) => id.trim().toLowerCase() === oldName.trim().toLowerCase() ? name : id),
        })));
      }
      toast(`${name} updated`, "check");
      setEditingStaff(null);
    } catch { toast("Failed to update", "x"); }
    finally { setEditStaffSaving(false); }
  };

  const handlePermanentDeleteStaff = async (staff: StaffMember) => {
    setDeleteStaffSaving(true);
    try {
      const res = await fetch("/api/admin/staff-roster", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: staff.id }),
      });
      if (!res.ok) { toast("Failed to delete", "x"); return; }
      setStaffRoster((prev) => prev.filter((s) => s.id !== staff.id));
      toast(`${staff.name} permanently removed`, "check");
      setConfirmDeleteStaff(null);
    } catch { toast("Failed to delete", "x"); }
    finally { setDeleteStaffSaving(false); }
  };

  const handleReactivateStaff = async (staff: StaffMember) => {
    try {
      const res = await fetch("/api/admin/staff-roster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: staff.id, is_active: true }),
      });
      if (!res.ok) { toast("Failed to reactivate", "x"); return; }
      setStaffRoster((prev) => prev.map((s) => s.id === staff.id ? { ...s, is_active: true, deactivated_at: null } : s));
      toast(`${staff.name} reactivated`, "check");
    } catch { toast("Failed to reactivate", "x"); }
  };

  const handleRemoveFromTeam = async (teamIdx: number, memberName: string) => {
    const team = teams[teamIdx];
    const norm = (s: string) => s.trim().toLowerCase();
    const newMembers = team.memberIds.filter((id) => norm(id) !== norm(memberName));
    setTeams((prev) => { const n = [...prev]; n[teamIdx] = { ...n[teamIdx], memberIds: newMembers }; return n; });
    const res = await fetch("/api/crews/update-members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crewId: team.id, members: newMembers }) });
    if (!res.ok) {
      toast("Failed to remove", "x");
      setTeams((prev) => { const n = [...prev]; n[teamIdx] = { ...n[teamIdx], memberIds: team.memberIds }; return n; });
    } else {
      toast(`${memberName} removed from ${team.label}`, "check");
    }
  };

  const persistToggles = async (next: AppToggles) => {
    setTogglesSaving(true);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(next),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        crewTracking?: boolean;
        partnerPortal?: boolean;
        autoInvoicing?: boolean;
      };
      if (!res.ok) {
        toast(typeof data.error === "string" ? data.error : "Failed to save", "x");
        return false;
      }
      setCrewTracking(data.crewTracking ?? next.crewTracking);
      setPartnerPortal(data.partnerPortal ?? next.partnerPortal);
      setAutoInvoicing(data.autoInvoicing ?? next.autoInvoicing);
      toast("App settings saved", "check");
      return true;
    } catch {
      toast("Failed to save settings", "x");
      return false;
    } finally {
      setTogglesSaving(false);
    }
  };

  const persistReviewConfig = async (next: { autoReviewRequests: boolean; googleReviewUrl: string }) => {
    setReviewConfigSaving(true);
    try {
      const res = await fetch("/api/admin/business-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          auto_review_requests: next.autoReviewRequests ? "true" : "false",
          google_review_url: next.googleReviewUrl || "",
        }),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(
          typeof (errBody as { error?: string }).error === "string"
            ? (errBody as { error: string }).error
            : "Failed to save review settings",
          "x",
        );
        return false;
      }
      setAutoReviewRequests(next.autoReviewRequests);
      setGoogleReviewUrl(next.googleReviewUrl);
      toast("Review settings saved", "check");
      return true;
    } catch {
      toast("Failed to save review settings", "x");
      return false;
    } finally {
      setReviewConfigSaving(false);
    }
  };

  const fetchUsers = () => {
    setUsersLoading(true);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);


  useEffect(() => {
    if (!addTeamModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [addTeamModalOpen]);

  const toggleMember = async (teamIdx: number, member: string) => {
    const team = teams[teamIdx];
    const normalized = (s: string) => String(s).trim().toLowerCase();
    const memberMatches = (id: string) => {
      const nId = normalized(id);
      const nM = normalized(member);
      return nId === nM || nId.startsWith(nM + " ") || nM.startsWith(nId + " ");
    };
    const isCurrentlyIn = team.memberIds.some(memberMatches);
    const ids = isCurrentlyIn
      ? team.memberIds.filter((id) => !memberMatches(id))
      : [...team.memberIds, member];
    const prevMemberIds = team.memberIds;
    setTeams((prev) => {
      const next = [...prev];
      next[teamIdx] = { ...next[teamIdx], memberIds: ids };
      return next;
    });

    const res = await fetch("/api/crews/update-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crewId: team.id, members: ids }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast(data.error || "Failed to update", "x");
      setTeams((prev) => {
        const reverted = [...prev];
        reverted[teamIdx] = { ...reverted[teamIdx], memberIds: prevMemberIds };
        return reverted;
      });
    } else {
      router.refresh();
    }
  };

  const addTeam = async () => {
    const name = addTeamName.trim();
    if (!name) return;
    const res = await fetch("/api/crews/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Failed to add team", "x");
      return;
    }
    const newId = data.id || String(Date.now());
    if (addTeamMembers.length > 0) {
      await fetch("/api/crews/update-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crewId: newId, members: addTeamMembers }),
      });
    }
    setTeams([...teams, { id: newId, label: name, memberIds: addTeamMembers, active: true }]);
    setAddTeamModalOpen(false);
    setAddTeamName("");
    setAddTeamMembers([]);
    toast("Team added", "check");
    router.refresh();
  };

  const visibleTabs = TABS.filter((t) => {
    if ((t.id === "users" || t.id === "audit") && !isSuperAdmin) return false;
    if ("ownerOnly" in t && t.ownerOnly && !isSuperAdmin) return false;
    return true;
  });

  return (
    <div className="flex flex-col sm:flex-row gap-6 lg:gap-8 sm:items-start min-h-0">
      {/* ── Vertical tab sidebar ── */}
      <nav className="hidden sm:flex flex-col gap-0.5 w-[168px] shrink-0 sticky top-[4.5rem]">
        {visibleTabs.map((t) => {
          const TabIcon = t.Icon;
          const active = activeTab === t.id;
          return (
            <Link
              key={t.id}
              id={`tab-${t.id}`}
              href={`/admin/platform?tab=${t.id}`}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                active
                  ? "bg-[var(--gdim)] text-[var(--gold)]"
                  : "text-[var(--tx3)] hover:bg-[var(--gdim)]/50 hover:text-[var(--tx)]"
              }`}
            >
              <TabIcon
                size={16}
                weight={active ? "fill" : "regular"}
                className={`shrink-0 transition-colors ${active ? "text-[var(--gold)]" : "text-[var(--tx3)] group-hover:text-[var(--tx2)]"}`}
              />
              <div className="min-w-0">
                <div className={`text-[12px] font-semibold leading-tight truncate ${active ? "text-[var(--gold)]" : ""}`}>
                  {t.label}
                </div>
                <div className="text-[10px] text-[var(--tx3)] leading-tight truncate mt-0.5 hidden lg:block">
                  {"desc" in t ? t.desc : ""}
                </div>
              </div>
              {active && <span className="ml-auto w-1 h-1 rounded-full bg-[var(--gold)] shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Mobile: horizontal scrollable tabs ── */}
      <div className="sm:hidden flex overflow-x-auto gap-1 pb-1 mb-4 -mx-1 px-1 scrollbar-hide w-full shrink-0">
        {visibleTabs.map((t) => {
          const TabIcon = t.Icon;
          const active = activeTab === t.id;
          return (
            <Link
              key={t.id}
              href={`/admin/platform?tab=${t.id}`}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 ${
                active
                  ? "bg-[var(--gdim)] text-[var(--gold)] border border-[var(--gold)]/30"
                  : "text-[var(--tx3)] border border-transparent hover:bg-[var(--gdim)]/50"
              }`}
            >
              <TabIcon size={13} weight={active ? "fill" : "regular"} />
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* ── Content panel ── */}
      <div className="flex-1 min-w-0 space-y-6">

      {/* Pricing Control Panel */}
      {activeTab === "pricing" && (
        <div key="pricing" className="tab-content">
          <PricingControlPanel isSuperAdmin={isSuperAdmin} />
        </div>
      )}
      {activeTab === "rate-templates" && <div key="rate-templates" className="tab-content"><RateTemplatesPanel /></div>}

      {/* Teams tab, reorganized: Staff Roster first, Teams second, Portal Access third */}
      {activeTab === "crews" && (
      <div key="crews" id="crews" className="space-y-0 tab-content">
        {/* ═══ SECTION 1: STAFF ROSTER ═══ */}
        <section className="pt-6 border-t border-[var(--brd)]/30 first:border-t-0 first:pt-0 scroll-mt-4">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[10px] font-bold shrink-0">1</span>
              <h2 className="admin-section-h2 flex items-center gap-2">
                <Icon name="users" className="w-[14px] h-[14px]" /> Staff Roster
              </h2>
            </div>
            <p className="text-[11px] text-[var(--tx3)] ml-7">Everyone who works at Yugo. Add new hires here first, then assign them to teams below.</p>
          </div>
          <div className="space-y-4">
            {/* Add new staff */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Full Name</label>
                <input
                  type="text"
                  value={addStaffName}
                  onChange={(e) => setAddStaffName(e.target.value)}
                  placeholder="e.g. Marcus Johnson"
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--brd)]/50"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddStaff(); }}
                />
              </div>
              <div className="min-w-[100px]">
                <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Role</label>
                <select
                  value={addStaffRole}
                  onChange={(e) => setAddStaffRole(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] text-[var(--tx)] outline-none focus:border-[var(--brd)]/50"
                >
                  <option value="mover">Mover</option>
                  <option value="driver">Driver</option>
                  <option value="lead">Lead</option>
                  <option value="specialist">Specialist</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddStaff}
                disabled={!addStaffName.trim() || addStaffSaving}
                className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
              >
                {addStaffSaving ? "Adding..." : "+ Add Employee"}
              </button>
            </div>

            {/* Active staff list */}
            <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brd)] bg-[var(--bg)]/40">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">Active Employees</span>
                {!staffLoading && (
                  <span className="text-[10px] font-semibold text-[var(--tx3)] tabular-nums">{staffRoster.filter((s) => s.is_active).length}</span>
                )}
              </div>
              {staffLoading ? (
                <div className="px-4 py-6 text-center text-[12px] text-[var(--tx3)]">Loading staff roster…</div>
              ) : staffRoster.filter((s) => s.is_active).length === 0 ? (
                <div className="px-4 py-8 text-center"><p className="text-[13px] text-[var(--tx3)]">No staff yet. Add your first employee above.</p></div>
              ) : (
                <>
                  <div className="divide-y divide-[var(--brd)]/60">
                    {(showAllActiveStaff ? staffRoster.filter((s) => s.is_active) : staffRoster.filter((s) => s.is_active).slice(0, 8)).map((s) => {
                      const memberOfTeams = teams.filter((t) => t.memberIds.some((id) => id.trim().toLowerCase() === s.name.trim().toLowerCase()));
                      return (
                        <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--bg)]/30 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-[12px] font-semibold text-[var(--tx)]">{s.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--gdim)] text-[var(--gold)] font-semibold capitalize shrink-0">{s.role}</span>
                            {s.hourly_rate != null && <span className="text-[9px] text-[var(--tx3)] shrink-0">${s.hourly_rate}/hr</span>}
                            {memberOfTeams.length > 0 ? (
                              <span className="text-[9px] text-[var(--grn)] shrink-0">{memberOfTeams.map((t) => t.label).join(", ")}</span>
                            ) : (
                              <span className="text-[9px] text-[var(--tx3)] italic shrink-0">Not on a team</span>
                            )}
                            {s.specialties && s.specialties.length > 0 && (
                              <span className="flex items-center gap-1 flex-wrap">
                                {s.specialties.map((sp) => (
                                  <span key={sp} className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium capitalize shrink-0">{sp.replace(/_/g, " ")}</span>
                                ))}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => { setEditingStaff(s); setEditStaffName(s.name); setEditStaffRole(s.role); setEditStaffPhone(s.phone || ""); setEditStaffEmail(s.email || ""); }}
                              className="px-2.5 py-1 rounded text-[10px] font-medium border border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-all"
                            >Edit</button>
                            <button
                              type="button"
                              onClick={() => handleDeactivateStaff(s)}
                              className="px-2.5 py-1 rounded text-[10px] font-medium border border-[var(--brd)] text-[var(--tx3)] hover:text-red-400 hover:border-red-400 transition-all"
                            >Remove</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {staffRoster.filter((s) => s.is_active).length > 8 && (
                    <button
                      type="button"
                      onClick={() => setShowAllActiveStaff((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)] border-t border-[var(--brd)]/60 hover:bg-[var(--bg)]/30 transition-all group"
                    >
                      <span>{showAllActiveStaff ? "Show fewer" : `Show all ${staffRoster.filter((s) => s.is_active).length} employees`}</span>
                      <CaretDown size={13} weight="bold" className={`transition-transform duration-200 ${showAllActiveStaff ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Inactive / former staff */}
            {inactiveStaff.length > 0 && (
              <div className="border-t border-[var(--brd)]/50 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInactiveStaff(!showInactiveStaff)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
                >
                  <CaretDown size={12} weight="regular" className={`shrink-0 transition-transform text-current ${showInactiveStaff ? "rotate-180" : ""}`} />
                  Former / Inactive ({inactiveStaff.length})
                </button>
                {showInactiveStaff && (
                  <div className="space-y-1.5 mt-2">
                    {inactiveStaff.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] opacity-70">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[12px] text-[var(--tx3)] line-through">{s.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold">Inactive</span>
                          {s.deactivated_at && (
                            <span className="text-[9px] text-[var(--tx3)]">since {new Date(s.deactivated_at).toLocaleDateString()}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button" onClick={() => handleReactivateStaff(s)} className="px-2 py-1 rounded text-[10px] font-semibold text-[var(--gold)] hover:bg-[var(--gdim)] transition-all">Rehire</button>
                          <button type="button" onClick={() => setConfirmDeleteStaff(s)} className="px-2 py-1 rounded text-[10px] font-semibold text-red-400 hover:bg-red-500/10 transition-all">Delete forever</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ═══ SECTION 2: TEAMS ═══ */}
        <section className="pt-6 border-t border-[var(--brd)]/30">
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[10px] font-bold shrink-0">2</span>
                <h2 className="admin-section-h2">Teams</h2>
              </div>
              <div className="flex flex-nowrap items-center gap-2 sm:ml-auto">
                <button
                  onClick={() => setAddTeamModalOpen(true)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all"
                >
                  + Create Team
                </button>
                <button
                  onClick={() => setAddTeamMemberOpen(true)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
                >
                  + Assign to Team
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[var(--tx3)] mt-2 ml-7">Group staff into moving crews. Click a team to add/remove members, set leads, or delete.</p>
          </div>
          <div className="rounded-xl border border-[var(--brd)] overflow-hidden">
            {teams.length === 0 ? (
              <div className="py-8 text-center"><p className="text-[13px] text-[var(--tx3)]">No teams yet. Create your first team above.</p></div>
            ) : null}
          {teams.map((team, i) => (
            <div key={team.id} className={`overflow-hidden ${i > 0 ? "border-t border-[var(--brd)]" : ""}`}>
              <div
                onClick={() => setEditingTeam(editingTeam === team.id ? null : team.id)}
                className="flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-[var(--bg)] transition-colors"
              >
                <div>
                  <div className="text-[13px] font-semibold text-[var(--tx)]">{team.label}</div>
                  <div className="text-[11px] text-[var(--tx3)] mt-0.5">
                    {team.memberIds.length > 0 ? team.memberIds.join(", ") : "No members, click to add"}
                    {(() => {
                      const memberStaff = staffRoster.filter((s) => s.is_active && team.memberIds.some((id) => id.trim().toLowerCase() === s.name.trim().toLowerCase()));
                      if (memberStaff.length > 0) {
                        const rates = memberStaff.filter((s) => s.hourly_rate != null).map((s) => s.hourly_rate!);
                        if (rates.length > 0) {
                          const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
                          return <span className="ml-2 text-[9px] text-[var(--gold)]">Avg ${avg.toFixed(2)}/hr</span>;
                        }
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="flex flex-nowrap items-center gap-2 shrink-0">
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded shrink-0 ${team.active ? "bg-[var(--grdim)] text-[var(--grn)]" : "bg-[var(--brd)] text-[var(--tx3)]"}`}>
                    {team.active ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const next = !team.active;
                      setTeams((prev) => {
                        const updated = [...prev];
                        updated[i] = { ...updated[i], active: next };
                        return updated;
                      });
                      try {
                        const r = await fetch("/api/crews/update-active", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ crewId: team.id, active: next }),
                        });
                        if (!r.ok) {
                          const data = await r.json().catch(() => ({}));
                          toast(data.error || "Failed to update", "x");
                          setTeams((prev) => {
                            const reverted = [...prev];
                            reverted[i] = { ...reverted[i], active: !next };
                            return reverted;
                          });
                        }
                      } catch {
                        toast("Failed to update", "x");
                        setTeams((prev) => {
                          const reverted = [...prev];
                          reverted[i] = { ...reverted[i], active: !next };
                          return reverted;
                        });
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${team.active ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${team.active ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
              {editingTeam === team.id && (
                <div className="px-4 py-3 border-t border-[var(--brd)] bg-[var(--bg)] space-y-4">
                  <div>
                    <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Current Members</div>
                    {(team.memberIds ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(team.memberIds ?? []).map((member) => (
                          <span key={member} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--card)] border border-[var(--brd)] text-[var(--tx)]">
                            {member}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRemoveFromTeam(i, member); }}
                              className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-red-500/20 text-[var(--tx3)] hover:text-red-400 transition-colors"
                              title={`Remove ${member} from team`}
                            >
                              <X size={10} weight="regular" className="text-current" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--tx3)] mb-3">No members assigned.</p>
                    )}
                    <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Available Staff (click to add)</div>
                    <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-1">
                      {activeStaffNames.filter((m) => {
                        const norm = (s: string) => s.trim().toLowerCase();
                        return !(team.memberIds ?? []).some((id) => norm(id) === norm(m));
                      }).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleMember(i, m)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium border border-dashed border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
                        >
                          + {m}
                        </button>
                      ))}
                      {activeStaffNames.length === 0 && (
                        <p className="text-[10px] text-[var(--tx3)]">No staff in roster yet. Add employees in the Staff Roster section above first.</p>
                      )}
                      {activeStaffNames.length > 0 && activeStaffNames.filter((m) => {
                        const norm = (s: string) => s.trim().toLowerCase();
                        return !(team.memberIds ?? []).some((id) => norm(id) === norm(m));
                      }).length === 0 && (
                        <p className="text-[10px] text-[var(--tx3)]">All active staff are assigned to this team.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Portal Access (who can log in on tablet)</div>
                    {crewPortalMembers.filter((m) => m.team_id === team.id && m.is_active).length === 0 ? (
                      <p className="text-[11px] text-[var(--tx3)]">No one with portal access on this team. Use “+ Add Portal Access” above.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {crewPortalMembers
                          .filter((m) => m.team_id === team.id && m.is_active)
                          .map((m) => (
                            <li key={m.id} className="flex flex-nowrap items-center justify-between gap-2 py-1.5 px-2 rounded bg-[var(--card)] border border-[var(--brd)]">
                              <span className="text-[12px] text-[var(--tx)] min-w-0 truncate">{m.name}</span>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--gdim)] text-[var(--gold)] shrink-0">{m.role === "lead" ? "Lead" : m.role}</span>
                              {m.role !== "lead" && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const r = await fetch(`/api/admin/crew-members/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "lead" }) });
                                    if (r.ok) {
                                      toast(`${m.name} set as team lead`, "check");
                                      const list = await fetch("/api/admin/crew-members").then((res) => res.json());
                                      if (Array.isArray(list)) setCrewPortalMembers(list);
                                    } else {
                                      const d = await r.json().catch(() => ({}));
                                      toast(d.error || "Failed", "x");
                                    }
                                  }}
                                  className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                                >
                                  Set as lead
                                </button>
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                  {/* Tablet phone, linked to the crew's registered device */}
                  <div>
                    <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Tablet Phone (customer-facing)</div>
                    <p className="text-[10px] text-[var(--tx3)] mb-2">
                      The phone number is linked to this team&apos;s registered tablet. Customers on the live tracking page call this number directly.
                      {" "}<button type="button" onClick={() => { const el = document.getElementById("tab-devices"); if (el) el.click(); }} className="text-[var(--gold)] font-semibold hover:underline">Manage in Devices tab &rarr;</button>
                    </p>
                    {team.phone ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg">
                        <Phone size={14} className="shrink-0 text-[var(--gold)]" />
                        <span className="text-[13px] font-medium text-[var(--tx)]">{team.phone}</span>
                        <span className="text-[9px] text-[var(--tx3)] ml-auto">from tablet</span>
                      </div>
                    ) : (
                      <div className="px-3 py-2 bg-[var(--bg)] border border-dashed border-[var(--brd)] rounded-lg text-[11px] text-[var(--tx3)]">
                        No tablet phone set - customers will see &quot;Call Dispatch&quot; instead.
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-[var(--brd)]">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Delete “${team.label}”? Crew members with portal access on this team will lose access. This cannot be undone.`)) return;
                        setDeletingTeamId(team.id);
                        try {
                          const r = await fetch("/api/crews/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crewId: team.id }) });
                          const data = (await r.json().catch(() => ({}))) as {
                            error?: string;
                            blocking_moves?: BlockingTeamJobMove[];
                            blocking_deliveries?: BlockingTeamJobDelivery[];
                          };
                          if (!r.ok) {
                            const bm = data.blocking_moves;
                            const bd = data.blocking_deliveries;
                            if (Array.isArray(bm) || Array.isArray(bd)) {
                              setTeamDeleteBlocked({
                                teamId: team.id,
                                teamLabel: team.label,
                                moves: Array.isArray(bm) ? bm : [],
                                deliveries: Array.isArray(bd) ? bd : [],
                              });
                              setReassignPick({});
                              return;
                            }
                            toast(typeof data.error === "string" ? data.error : "Failed to delete", "x");
                            return;
                          }
                          setTeams((prev) => prev.filter((t) => t.id !== team.id));
                          setEditingTeam(null);
                          setTeamDeleteBlocked(null);
                          toast("Team deleted", "check");
                          router.refresh();
                        } finally {
                          setDeletingTeamId(null);
                        }
                      }}
                      disabled={!!deletingTeamId}
                      className="px-3 py-1 rounded text-[11px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {deletingTeamId === team.id ? "Deleting…" : "Delete team"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          </div>
        </section>

        {/* ═══ SECTION 3: CREW PORTAL ACCESS ═══ */}
        <section className="pt-6 border-t border-[var(--brd)]/30">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[10px] font-bold shrink-0">3</span>
                <h3 className="admin-section-h2">Crew Portal Access</h3>
              </div>
              <p className="text-[11px] text-[var(--tx3)] ml-7">People who can log in on the tablet with a PIN. Each person needs portal access to use the Crew app.</p>
            </div>
            <button
              onClick={() => setAddPortalOpen(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all"
            >
              + Add portal access
            </button>
          </div>
          <div className="rounded-xl border border-[var(--brd)] overflow-hidden">
            {crewPortalLoading ? (
              <div className="px-4 py-6 text-center text-[12px] text-[var(--tx3)]">Loading…</div>
            ) : crewPortalMembers.filter((m) => m.is_active).length === 0 ? (
              <div className="px-4 py-8 text-center"><p className="text-[13px] text-[var(--tx3)]">No portal access set up yet.</p><p className="text-[11px] text-[var(--tx3)] mt-1">Click &quot;+ Add Portal Access&quot; to give someone a PIN.</p></div>
            ) : (
              <ul className="divide-y divide-[var(--brd)]/60">
                {crewPortalMembers
                  .filter((m) => m.is_active)
                  .map((m) => {
                    const teamLabel = teams.find((t) => t.id === m.team_id)?.label ?? "-";
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3 py-3 px-4 hover:bg-[var(--bg)]/30 transition-colors flex-wrap">
                        <div>
                          <span className="text-[13px] font-medium text-[var(--tx)]">{m.name}</span>
                          <span className="text-[10px] text-[var(--tx3)] ml-2">({teamLabel})</span>
                          <span className="text-[9px] font-semibold ml-1.5 px-1.5 py-0.5 rounded bg-[var(--gdim)] text-[var(--gold)]">{m.role === "lead" ? "Lead" : m.role}</span>
                          <div className="text-[11px] text-[var(--tx3)] mt-0.5">{m.phone ? "••••" + m.phone.replace(/\D/g, "").slice(-4) : "-"}</div>
                        </div>
                        <div className="flex flex-nowrap items-center gap-2 shrink-0">
                          {m.role !== "lead" && (
                            <button
                              type="button"
                              onClick={async () => {
                                const r = await fetch(`/api/admin/crew-members/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "lead" }) });
                                if (r.ok) {
                                  toast(`${m.name} set as team lead`, "check");
                                  const list = await fetch("/api/admin/crew-members").then((res) => res.json());
                                  if (Array.isArray(list)) setCrewPortalMembers(list);
                                } else {
                                  const d = await r.json().catch(() => ({}));
                                  toast(d.error || "Failed", "x");
                                }
                              }}
                              className="shrink-0 px-2.5 py-1 rounded text-[10px] font-semibold border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10"
                            >
                              Set as lead
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { setResetPinMember(m); setResetPinValue(""); }}
                            className="shrink-0 px-2.5 py-1 rounded text-[10px] font-semibold border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10"
                          >
                            Reset PIN
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Revoke portal access for ${m.name}? They will no longer be able to log in.`)) return;
                              const r = await fetch(`/api/admin/crew-members/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: false }) });
                              if (r.ok) {
                                setCrewPortalMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_active: false } : x)));
                                toast("Access revoked", "check");
                              } else {
                                const d = await r.json().catch(() => ({}));
                                toast(d.error || "Failed", "x");
                              }
                            }}
                            className="shrink-0 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all"
                          >
                            Revoke
                          </button>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </section>
      </div>
      )}

      {/* Devices: Fleet Vehicles, iPad Setup Codes, Truck Assignments */}
      {activeTab === "devices" && (
        <div className="space-y-6">
          <FleetVehiclesManager />
          <DeviceSetupCodes />
          <TruckAssignments />
        </div>
      )}

      {/* App toggles - Notifications, Auto-Invoice, etc */}
      {activeTab === "app" && (
      <div id="app" className="space-y-5 scroll-mt-4">
      <section className="pt-0 first:pt-0">
        <div className="mb-3">
          <h2 className="admin-section-h2 flex items-center gap-2">
            <Icon name="settings" className="w-[14px] h-[14px]" /> App
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Platform-wide settings</p>
        </div>
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
        <div className="px-4 py-4 space-y-3">
          {[
            {
              label: "Crew GPS Tracking",
              desc: "Live map & GPS pings. Crew can still start jobs and advance checkpoints when off.",
              state: crewTracking,
              set: setCrewTracking,
            },
            { label: "Partner Portal Access", desc: "Allow partners to view their deliveries", state: partnerPortal, set: setPartnerPortal },
            { label: "Auto-Invoicing", desc: "Generate invoices automatically on delivery", state: autoInvoicing, set: setAutoInvoicing },
            { label: "Automated Review Requests", desc: "Send Google review request emails 2 hours after moves complete", state: autoReviewRequests, set: setAutoReviewRequests },
          ].map((item) => {
            const isPartnerPortal = item.label === "Partner Portal Access";
            const isCrewTracking = item.label === "Crew GPS Tracking";
            const isReviewRequests = item.label === "Automated Review Requests";
            const handleToggle = async () => {
              if (isPartnerPortal) {
                if (partnerPortal) {
                  setConfirmPartnerPortalOff(true);
                  return;
                }
                const ok = await persistToggles({ crewTracking, partnerPortal: true, autoInvoicing });
                if (ok) setPartnerPortal(true);
              } else if (isCrewTracking) {
                if (crewTracking) {
                  setConfirmCrewTrackingOff(true);
                  return;
                }
                const ok = await persistToggles({ crewTracking: true, partnerPortal, autoInvoicing });
                if (ok) setCrewTracking(true);
              } else if (isReviewRequests) {
                const next = !autoReviewRequests;
                const ok = await persistReviewConfig({ autoReviewRequests: next, googleReviewUrl });
                if (ok) setAutoReviewRequests(next);
              } else {
                const next = !item.state;
                const nextToggles = {
                  crewTracking: item.label === "Crew GPS Tracking" ? next : crewTracking,
                  partnerPortal,
                  autoInvoicing: item.label === "Auto-Invoicing" ? next : autoInvoicing,
                };
                const ok = await persistToggles(nextToggles);
                if (ok) {
                  item.set(next);
                }
              }
            };
            const isOn = isPartnerPortal ? partnerPortal : isCrewTracking ? crewTracking : isReviewRequests ? autoReviewRequests : item.state;
            return (
              <div key={item.label} className="flex items-center justify-between py-3 border-b border-[var(--brd)] last:border-0">
                <div>
                  <div className="text-[13px] font-semibold text-[var(--tx)]">{item.label}</div>
                  <div className="text-[11px] text-[var(--tx3)] mt-0.5">{item.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={handleToggle}
                  aria-label={isOn ? `Turn off ${item.label}` : `Turn on ${item.label}`}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isOn ? "bg-[var(--gold)]" : "bg-[var(--brd)]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isOn ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            );
          })}
          <div className="pt-4 mt-4 border-t border-[var(--brd)]">
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Google Review URL</label>
            <p className="text-[11px] text-[var(--tx3)] mb-2">Link customers are redirected to when they click the review button in emails</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
                placeholder="https://g.page/r/CU67iDN6TgMIEB0/review/"
                className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none"
              />
              <button
                type="button"
                onClick={() => persistReviewConfig({ autoReviewRequests, googleReviewUrl })}
                disabled={reviewConfigSaving}
                className="px-4 py-2 rounded-lg bg-[var(--gold)] text-[var(--bg)] text-[12px] font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {reviewConfigSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Business Information */}
      <BusinessInfoSection />

      {/* Quoting Defaults */}
      <QuotingDefaultsSection />

      {/* Fuel prices — gas/diesel $/L for navigation & move fuel logging */}
      <FuelPricingSection />

      {/* Feature Toggles */}
      <FeatureTogglesSection />

      {/* Email Templates */}
      <EmailTemplatesSection />

      {/* Readiness Checklist - configurable items for crew pre-trip check */}
      <ReadinessChecklistSection />

      {/* Danger Zone - in App Settings */}
      <section className="pt-6 border-t border-[var(--brd)]/30">
        <div className="mb-4">
          <h2 className="admin-section-h2 flex items-center gap-2">
            <Icon name="alertTriangle" className="w-[14px] h-[14px] text-[var(--red)]" /> Danger Zone
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-1">Irreversible platform actions</p>
        </div>
        <div className="rounded-xl border border-[var(--red)]/20 bg-[rgba(209,67,67,0.04)] p-5 space-y-3">
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-[13px] font-semibold text-[var(--tx)]">Reset All Settings</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5">Restore platform defaults</div>
            </div>
            <button onClick={() => toast("Reset requires confirmation", "alertTriangle")} className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--org)]/40 text-[var(--org)] hover:bg-[var(--ordim)] transition-all">
              Reset
            </button>
          </div>
        </div>
      </section>
      </div>
      )}

      {/* Partners Management */}
      {activeTab === "partners" && (
        <PartnersManagement />
      )}

      {/* User Management - Superadmin only */}
      {activeTab === "users" && isSuperAdmin && (
      <section className="pt-6 border-t border-[var(--brd)]/30 first:border-t-0 first:pt-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="admin-section-h2 flex items-center gap-2">
              <Icon name="lock" className="w-[14px] h-[14px]" /> User Management
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-1">Roles, permissions, and access control</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/admin/users"
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
            >
              View All Users
            </Link>
            <button
              onClick={() => setInviteUserOpen(true)}
              className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all shrink-0"
            >
              + Invite Team Member
            </button>
          </div>
        </div>
        <div>
          {usersLoading ? (
            <div className="py-8 text-center text-[13px] text-[var(--tx3)]">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--gdim)] border border-[rgba(201,169,98,0.25)] mb-4">
                <Icon name="users" className="w-6 h-6 text-[var(--gold)]" />
              </div>
              <p className="text-[var(--text-base)] font-medium text-[var(--tx)] mb-1">No users yet</p>
              <p className="text-[12px] text-[var(--tx3)] mb-5 max-w-[260px] mx-auto">Invite team members to give them access to the platform. They&apos;ll receive an email to sign in and get started.</p>
              <button
                onClick={() => setInviteUserOpen(true)}
                className="px-6 py-3 rounded-lg text-[13px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all"
              >
                Invite your first user
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUser(u)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[var(--brd)] hover:border-[var(--gold)] bg-[var(--bg)] hover:bg-[var(--card)] transition-all text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[var(--tx)] truncate">{u.name || u.email}</div>
                    <div className="text-[11px] text-[var(--tx3)] truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.status === "activated" ? "bg-[rgba(45,159,90,0.15)] text-[var(--grn)]" : u.status === "pending" ? "bg-[rgba(201,169,98,0.15)] text-[var(--gold)]" : "bg-[var(--brd)] text-[var(--tx3)]"}`}>
                      {u.status === "activated" ? "Active" : u.status === "pending" ? "Pending" : "Inactive"}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--gdim)] text-[var(--gold)]">
                      {u.role === "owner" ? "Owner" : u.role === "admin" ? "Admin" : u.role === "manager" ? "Manager" : u.role === "coordinator" ? "Coordinator" : u.role === "viewer" ? "Viewer" : u.role === "sales" ? "Sales" : "Dispatcher"}
                    </span>
                    {u.last_sign_in_at && (
                      <span className="text-[9px] text-[var(--tx3)]">
                        {formatLastActive(u.last_sign_in_at)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {/* Audit Log */}
      {activeTab === "audit" && <AuditLogSection />}

      {/* Add Team Modal - uses GlobalModal via ModalOverlay */}
      <ModalOverlay open={addTeamModalOpen} onClose={() => setAddTeamModalOpen(false)} title="Add Team" maxWidth="md">
        <div className="p-5 space-y-5">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Team name</label>
            <input
              value={addTeamName}
              onChange={(e) => setAddTeamName(e.target.value)}
              placeholder="e.g. Team A"
              className="w-full px-4 py-2.5 rounded-lg text-[13px] bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] focus:border-[var(--brd)] outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">Team members</label>
            <div className="flex flex-wrap gap-3 max-h-44 overflow-y-auto p-1 -m-1">
              {activeStaffNames.map((m) => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer group py-1.5 px-2 rounded-lg hover:bg-[var(--bg)]/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={addTeamMembers.includes(m)}
                    onChange={() => setAddTeamMembers((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])}
                    className="checkbox-elegant"
                  />
                  <span className="text-[12px] text-[var(--tx)] group-hover:text-[var(--tx)]">{m}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={addTeam}
            disabled={!addTeamName.trim()}
            className="w-full px-4 py-3 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Team
          </button>
        </div>
      </ModalOverlay>

      <InviteUserModal open={inviteUserOpen} onClose={() => { setInviteUserOpen(false); fetchUsers(); }} />
      {selectedUser && (
        <UserDetailModal
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          user={selectedUser}
          currentUserId={currentUserId}
          onSaved={(updates) => {
            setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, ...updates } : u)));
            setSelectedUser((u) => (u ? { ...u, ...updates } : null));
          }}
          onDeleted={(id) => { setUsers((prev) => prev.filter((u) => u.id !== id)); setSelectedUser(null); }}
        />
      )}
      <AddTeamMemberModal
        open={addTeamMemberOpen}
        onClose={() => setAddTeamMemberOpen(false)}
        teams={teams}
        onTeamsChange={setTeams}
        staffNames={activeStaffNames}
      />
      <AddPortalAccessModal
        open={addPortalOpen}
        onClose={() => setAddPortalOpen(false)}
        teams={teams}
        crewPortalMembers={crewPortalMembers}
        onAdded={() => {
          fetch("/api/admin/crew-members").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setCrewPortalMembers(data); });
        }}
      />

      <ModalOverlay
        open={confirmPartnerPortalOff}
        onClose={() => setConfirmPartnerPortalOff(false)}
        title="Disable Partner Portal?"
        maxWidth="sm"
      >
        <div className="p-5 space-y-4">
          <p className="text-[13px] text-[var(--tx2)]">
            Disabling Partner Portal Access will prevent all partners from viewing their deliveries. Are you sure you want to continue?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmPartnerPortalOff(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={togglesSaving}
              onClick={async () => {
                const ok = await persistToggles({ crewTracking, partnerPortal: false, autoInvoicing });
                if (ok) {
                  setPartnerPortal(false);
                  setConfirmPartnerPortalOff(false);
                }
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[#c53030] text-white hover:opacity-90 transition-all disabled:opacity-50"
            >
              Disable access
            </button>
          </div>
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={confirmCrewTrackingOff}
        onClose={() => setConfirmCrewTrackingOff(false)}
        title="Disable Crew GPS Tracking?"
        maxWidth="sm"
      >
        <div className="p-5 space-y-4">
          <p className="text-[13px] text-[var(--tx2)]">
            Disabling Crew GPS Tracking stops live map pings and location ingestion. Crews can still start jobs and record
            checkpoints. Continue?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmCrewTrackingOff(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={togglesSaving}
              onClick={async () => {
                const ok = await persistToggles({ crewTracking: false, partnerPortal, autoInvoicing });
                if (ok) {
                  setCrewTracking(false);
                  setConfirmCrewTrackingOff(false);
                }
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[#c53030] text-white hover:opacity-90 transition-all disabled:opacity-50"
            >
              Disable tracking
            </button>
          </div>
        </div>
      </ModalOverlay>

      {/* Edit Staff Modal */}
      <ModalOverlay
        open={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        title={`Edit ${editingStaff?.name ?? "Staff Member"}`}
        maxWidth="sm"
      >
        {editingStaff && (
          <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); handleEditStaff(); }}>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Name</label>
              <input
                type="text"
                value={editStaffName}
                onChange={(e) => setEditStaffName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Role</label>
              <select
                value={editStaffRole}
                onChange={(e) => setEditStaffRole(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
              >
                <option value="mover">Mover</option>
                <option value="driver">Driver</option>
                <option value="lead">Lead</option>
                <option value="specialist">Specialist</option>
                <option value="coordinator">Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Phone</label>
              <input
                type="tel"
                value={editStaffPhone}
                onChange={(e) => setEditStaffPhone(e.target.value)}
                placeholder="Optional"
                className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Email</label>
              <input
                type="email"
                value={editStaffEmail}
                onChange={(e) => setEditStaffEmail(e.target.value)}
                placeholder="Optional"
                className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Hourly Rate ($)</label>
              <input
                type="number"
                step="0.50"
                value={editingStaff?.hourly_rate ?? 25}
                onChange={(e) => {
                  if (editingStaff) setEditingStaff({ ...editingStaff, hourly_rate: parseFloat(e.target.value) || 0 });
                }}
                className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Specialties</label>
              <div className="flex flex-wrap gap-1.5">
                {["Piano", "Art Handling", "Heavy Lift", "Fragile Items", "Electronics", "Disassembly", "Packing", "Office Moves"].map((sp) => {
                  const slug = sp.toLowerCase().replace(/\s+/g, "_");
                  const selected = (editingStaff?.specialties || []).includes(slug);
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => {
                        if (!editingStaff) return;
                        const current = editingStaff.specialties || [];
                        const next = selected ? current.filter((s) => s !== slug) : [...current, slug];
                        setEditingStaff({ ...editingStaff, specialties: next });
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                        selected
                          ? "bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]"
                          : "border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
                      }`}
                    >
                      {sp}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!editStaffName.trim() || editStaffSaving}
                className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
              >
                {editStaffSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
            <div className="pt-2 border-t border-[var(--brd)]">
              <button
                type="button"
                onClick={() => { setEditingStaff(null); handleDeactivateStaff(editingStaff); }}
                className="w-full px-4 py-1.5 rounded text-[11px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all"
              >
                Remove from Active Roster
              </button>
            </div>
          </form>
        )}
      </ModalOverlay>

      {/* Confirm Permanent Delete */}
      <ModalOverlay
        open={!!confirmDeleteStaff}
        onClose={() => setConfirmDeleteStaff(null)}
        title="Permanently Delete Staff Member?"
        maxWidth="sm"
      >
        {confirmDeleteStaff && (
          <div className="p-5 space-y-4">
            <p className="text-[13px] text-[var(--tx2)]">
              This will permanently remove <strong>{confirmDeleteStaff.name}</strong> from the system. This cannot be undone. All historical data will remain, but they will no longer appear in any roster or reports.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteStaff(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteStaffSaving}
                onClick={() => handlePermanentDeleteStaff(confirmDeleteStaff)}
                className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[#c53030] text-white hover:opacity-90 transition-all disabled:opacity-50"
              >
                {deleteStaffSaving ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>

      <ModalOverlay
        open={!!resetPinMember}
        onClose={() => { setResetPinMember(null); setResetPinValue(""); }}
        title="Reset crew portal PIN"
        maxWidth="sm"
      >
        {resetPinMember && (
          <form
            className="p-5 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const pin = resetPinValue.trim();
              if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
                toast("PIN must be 6 digits", "x");
                return;
              }
              setResetPinSaving(true);
              try {
                const r = await fetch(`/api/admin/crew-members/${resetPinMember.id}/reset-pin`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pin }),
                });
                const data = await r.json().catch(() => ({}));
                if (!r.ok) {
                  toast(data.error || "Failed to reset PIN", "x");
                  return;
                }
                toast("PIN updated. They can log in with the new PIN.", "check");
                setResetPinMember(null);
                setResetPinValue("");
              } finally {
                setResetPinSaving(false);
              }
            }}
          >
            <p className="text-[12px] text-[var(--tx2)]">
              Set a new 6-digit PIN for <strong>{resetPinMember.name}</strong>. They will use it to log in to the Crew Portal.
            </p>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">New PIN (6 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={resetPinValue}
                onChange={(e) => setResetPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none font-mono"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setResetPinMember(null); setResetPinValue(""); }}
                className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetPinValue.length !== 6 || resetPinSaving}
                className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
              >
                {resetPinSaving ? "Saving…" : "Set new PIN"}
              </button>
            </div>
          </form>
        )}
      </ModalOverlay>

      <ModalOverlay
        open={!!teamDeleteBlocked}
        onClose={() => {
          setTeamDeleteBlocked(null);
          setReassignPick({});
        }}
        title="Team still has active jobs"
        maxWidth="xl"
      >
        {teamDeleteBlocked && (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <p className="text-[12px] text-[var(--tx2)]">
              This team is assigned to the jobs below. Reassign each one to another team, or open the job in admin to complete or cancel it. Jobs that are already in progress cannot be reassigned until the crew has finished.
            </p>
            {teamDeleteBlocked.moves.length > 0 && (
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Moves</div>
                <ul className="space-y-3">
                  {teamDeleteBlocked.moves.map((job) => {
                    const key = `m-${job.id}`;
                    const otherTeams = teams.filter((t) => t.id !== teamDeleteBlocked.teamId);
                    const pick = reassignPick[key] ?? otherTeams[0]?.id ?? "";
                    return (
                      <li key={job.id} className="rounded-lg border border-[var(--brd)] bg-[var(--card)] p-3 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-[var(--tx)]">{job.summary}</p>
                            <p className="text-[10px] text-[var(--tx3)] mt-0.5">{job.status_label}</p>
                          </div>
                          <Link
                            href={`/admin/moves/${job.id}`}
                            className="shrink-0 text-[11px] font-semibold text-[var(--gold)] hover:underline"
                          >
                            Open move
                          </Link>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {job.can_reassign && otherTeams.length > 0 ? (
                            <>
                              <span className="text-[10px] text-[var(--tx3)]">Reassign to</span>
                              <select
                                value={pick}
                                onChange={(e) => setReassignPick((p) => ({ ...p, [key]: e.target.value }))}
                                className="text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] min-w-[140px]"
                              >
                                {otherTeams.map((t) => (
                                  <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!pick || reassignSubmitting === key}
                                onClick={async () => {
                                  setReassignSubmitting(key);
                                  try {
                                    const r = await fetch("/api/dispatch/assign", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ jobId: job.id, jobType: "move", crewId: pick }),
                                    });
                                    const d = await r.json().catch(() => ({}));
                                    if (!r.ok) {
                                      toast(typeof d.error === "string" ? d.error : "Failed to reassign", "x");
                                      return;
                                    }
                                    toast("Move reassigned", "check");
                                    router.refresh();
                                    setTeamDeleteBlocked((prev) => {
                                      if (!prev) return prev;
                                      const moves = prev.moves.filter((m) => m.id !== job.id);
                                      if (moves.length === 0 && prev.deliveries.length === 0) return null;
                                      return { ...prev, moves };
                                    });
                                  } finally {
                                    setReassignSubmitting(null);
                                  }
                                }}
                                className="px-3 py-1 rounded text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50"
                              >
                                {reassignSubmitting === key ? "Reassigning…" : "Reassign"}
                              </button>
                            </>
                          ) : !job.can_reassign ? (
                            <p className="text-[11px] text-[var(--tx3)]">In progress — open the move to finish or wait until the crew is done before reassigning.</p>
                          ) : (
                            <p className="text-[11px] text-[var(--tx3)]">Create another team first, then you can reassign.</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {teamDeleteBlocked.deliveries.length > 0 && (
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Deliveries</div>
                <ul className="space-y-3">
                  {teamDeleteBlocked.deliveries.map((job) => {
                    const key = `d-${job.id}`;
                    const otherTeams = teams.filter((t) => t.id !== teamDeleteBlocked.teamId);
                    const pick = reassignPick[key] ?? otherTeams[0]?.id ?? "";
                    return (
                      <li key={job.id} className="rounded-lg border border-[var(--brd)] bg-[var(--card)] p-3 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-[var(--tx)]">{job.summary}</p>
                            <p className="text-[10px] text-[var(--tx3)] mt-0.5">{job.status_label}</p>
                          </div>
                          <Link
                            href={`/admin/deliveries/${job.id}`}
                            className="shrink-0 text-[11px] font-semibold text-[var(--gold)] hover:underline"
                          >
                            Open delivery
                          </Link>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {job.can_reassign && otherTeams.length > 0 ? (
                            <>
                              <span className="text-[10px] text-[var(--tx3)]">Reassign to</span>
                              <select
                                value={pick}
                                onChange={(e) => setReassignPick((p) => ({ ...p, [key]: e.target.value }))}
                                className="text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] min-w-[140px]"
                              >
                                {otherTeams.map((t) => (
                                  <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!pick || reassignSubmitting === key}
                                onClick={async () => {
                                  setReassignSubmitting(key);
                                  try {
                                    const r = await fetch("/api/dispatch/assign", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ jobId: job.id, jobType: "delivery", crewId: pick }),
                                    });
                                    const d = await r.json().catch(() => ({}));
                                    if (!r.ok) {
                                      toast(typeof d.error === "string" ? d.error : "Failed to reassign", "x");
                                      return;
                                    }
                                    toast("Delivery reassigned", "check");
                                    router.refresh();
                                    setTeamDeleteBlocked((prev) => {
                                      if (!prev) return prev;
                                      const deliveries = prev.deliveries.filter((x) => x.id !== job.id);
                                      if (prev.moves.length === 0 && deliveries.length === 0) return null;
                                      return { ...prev, deliveries };
                                    });
                                  } finally {
                                    setReassignSubmitting(null);
                                  }
                                }}
                                className="px-3 py-1 rounded text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50"
                              >
                                {reassignSubmitting === key ? "Reassigning…" : "Reassign"}
                              </button>
                            </>
                          ) : !job.can_reassign ? (
                            <p className="text-[11px] text-[var(--tx3)]">In progress — open the delivery to finish or wait until the crew is done before reassigning.</p>
                          ) : (
                            <p className="text-[11px] text-[var(--tx3)]">Create another team first, then you can reassign.</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--brd)]">
              <button
                type="button"
                onClick={() => {
                  setTeamDeleteBlocked(null);
                  setReassignPick({});
                }}
                className="px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!teamDeleteBlocked) return;
                  if (!window.confirm(`Delete “${teamDeleteBlocked.teamLabel}”? Crew members with portal access on this team will lose access. This cannot be undone.`)) return;
                  setDeletingTeamId(teamDeleteBlocked.teamId);
                  try {
                    const rx = await fetch("/api/crews/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ crewId: teamDeleteBlocked.teamId }),
                    });
                    const d = (await rx.json().catch(() => ({}))) as {
                      error?: string;
                      blocking_moves?: BlockingTeamJobMove[];
                      blocking_deliveries?: BlockingTeamJobDelivery[];
                    };
                    if (!rx.ok) {
                      const bm = d.blocking_moves;
                      const bd = d.blocking_deliveries;
                      if (Array.isArray(bm) || Array.isArray(bd)) {
                        setTeamDeleteBlocked({
                          teamId: teamDeleteBlocked.teamId,
                          teamLabel: teamDeleteBlocked.teamLabel,
                          moves: Array.isArray(bm) ? bm : [],
                          deliveries: Array.isArray(bd) ? bd : [],
                        });
                        setReassignPick({});
                        return;
                      }
                      toast(typeof d.error === "string" ? d.error : "Failed to delete", "x");
                      return;
                    }
                    setTeams((prev) => prev.filter((t) => t.id !== teamDeleteBlocked.teamId));
                    setEditingTeam(null);
                    setTeamDeleteBlocked(null);
                    setReassignPick({});
                    toast("Team deleted", "check");
                    router.refresh();
                  } finally {
                    setDeletingTeamId(null);
                  }
                }}
                disabled={!!deletingTeamId}
                className="px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--red)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {deletingTeamId === teamDeleteBlocked.teamId ? "Deleting…" : "Delete team"}
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>
      </div>{/* end content panel */}
    </div>
  );
}
