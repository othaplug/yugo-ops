"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useToast } from "../components/Toast";
import { Icon } from "@/components/AppIcons";
import InviteUserModal from "./InviteUserModal";
import AddTeamMemberModal from "./AddTeamMemberModal";
import DeviceSetupCodes from "./DeviceSetupCodes";
import UserDetailModal from "./UserDetailModal";
import ModalOverlay from "../components/ModalOverlay";
import { useRouter } from "next/navigation";

const TABS = [
  { id: "pricing", label: "Pricing" },
  { id: "crews", label: "Teams" },
  { id: "devices", label: "Devices" },
  { id: "app", label: "App Settings" },
  { id: "partners", label: "Partners" },
  { id: "users", label: "Users" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const ALL_CREW = ["Marcus", "Devon", "James", "Olu", "Ryan", "Chris", "Specialist", "Michael T.", "Alex", "Jordan", "Sam", "Taylor"];

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

const RATES_KEY = "yugo-platform-rates";
const APP_TOGGLES_KEY = "yugo-platform-app-toggles";

interface Team {
  id: string;
  label: string;
  memberIds: string[];
  active: boolean;
}

interface PlatformSettingsClientProps {
  initialTeams?: Team[];
  currentUserId?: string;
  isSuperAdmin?: boolean;
}

export default function PlatformSettingsClient({ initialTeams = [], currentUserId, isSuperAdmin = false }: PlatformSettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const tabParam = searchParams.get("tab") || "pricing";
  const activeTab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "pricing";
  const [inviteUserOpen, setInviteUserOpen] = useState(false);
  const [users, setUsers] = useState<{ id: string; email: string; name: string | null; role: string; status: string; last_sign_in_at?: string | null }[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; name: string | null; role: string } | null>(null);
  const [crewTracking, setCrewTracking] = useState(true);
  const [partnerPortal, setPartnerPortal] = useState(false);
  const [autoInvoicing, setAutoInvoicing] = useState(true);
  const [rates, setRates] = useState([
    { tier: "Essentials", rate: "150" },
    { tier: "Premier", rate: "220" },
    { tier: "Estate", rate: "350" },
    { tier: "Office", rate: "3K-$25K" },
  ]);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [addTeamModalOpen, setAddTeamModalOpen] = useState(false);
  const [addTeamMemberOpen, setAddTeamMemberOpen] = useState(false);
  const [addTeamName, setAddTeamName] = useState("");
  const [addTeamMembers, setAddTeamMembers] = useState<string[]>([]);
  const [ratesSaving, setRatesSaving] = useState(false);
  const appTogglesLoadedRef = useRef(false);
  const appTogglesUserChangedRef = useRef(false);

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  // Load app toggles from localStorage so they persist across navigation
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(APP_TOGGLES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.crewTracking === "boolean") setCrewTracking(parsed.crewTracking);
        if (typeof parsed.partnerPortal === "boolean") setPartnerPortal(parsed.partnerPortal);
        if (typeof parsed.autoInvoicing === "boolean") setAutoInvoicing(parsed.autoInvoicing);
      }
      appTogglesLoadedRef.current = true;
    } catch (_) {
      appTogglesLoadedRef.current = true;
    }
  }, []);

  // Persist app toggles only when user has changed one (avoids overwriting saved values on load)
  useEffect(() => {
    if (typeof window === "undefined" || !appTogglesLoadedRef.current || !appTogglesUserChangedRef.current) return;
    try {
      localStorage.setItem(
        APP_TOGGLES_KEY,
        JSON.stringify({ crewTracking, partnerPortal, autoInvoicing })
      );
    } catch (_) {}
  }, [crewTracking, partnerPortal, autoInvoicing]);

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
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(RATES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) setRates(parsed);
      }
    } catch (_) {}
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
    const isCurrentlyIn = team.memberIds.some((id) => normalized(id) === normalized(member));
    const ids = isCurrentlyIn
      ? team.memberIds.filter((m) => normalized(m) !== normalized(member))
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

  const visibleTabs = TABS.filter((t) => t.id !== "users" || isSuperAdmin);

  return (
    <div className="space-y-6">
      {/* Tabbed navigation - clickable breadcrumb-style links */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-[var(--brd)] pb-3">
        {visibleTabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin/platform?tab=${t.id}`}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
              activeTab === t.id
                ? "bg-[var(--gold)] text-[#0D0D0D]"
                : "text-[var(--gold)] hover:bg-[var(--gold)]/10"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Pricing & Rates - editable */}
      {activeTab === "pricing" && (
      <div id="pricing" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4 min-w-0">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="dollar" className="w-[16px] h-[16px]" /> Pricing & Rates
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Service tiers and hourly rates — edit below</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          {rates.map((r, i) => (
            <div key={r.tier} className="flex items-center justify-between gap-3 py-2.5 px-4 bg-[var(--bg)] border border-[var(--brd)] rounded-lg min-w-0">
              <input
                value={r.tier}
                onChange={(e) => {
                  const next = [...rates];
                  next[i] = { ...next[i], tier: e.target.value };
                  setRates(next);
                }}
                className="flex-1 bg-transparent text-[13px] font-medium text-[var(--tx)] outline-none border-none"
              />
              <input
                value={r.rate}
                onChange={(e) => {
                  const next = [...rates];
                  next[i] = { ...next[i], rate: e.target.value };
                  setRates(next);
                }}
                className="w-24 px-2 py-1 bg-[var(--card)] border border-[var(--brd)] rounded text-[12px] font-semibold text-[var(--gold)] outline-none focus:border-[var(--gold)]"
              />
            </div>
          ))}
          <button
            onClick={async () => {
              if (typeof window === "undefined") {
                toast("Cannot save in this environment", "x");
                return;
              }
              setRatesSaving(true);
              try {
                const data = JSON.stringify(rates);
                localStorage.setItem(RATES_KEY, data);
                await new Promise((r) => setTimeout(r, 400));
                toast("Rates saved", "check");
              } catch (e: unknown) {
                const err = e as Error;
                const msg = err?.name === "QuotaExceededError"
                  ? "Storage full — clear some data"
                  : "Failed to save rates";
                toast(msg, "x");
              } finally {
                setRatesSaving(false);
              }
            }}
            disabled={ratesSaving}
            className="mt-2 px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
          >
            {ratesSaving ? "Saving…" : "Save Rates"}
          </button>
        </div>
      </div>
      )}

      {/* Teams - view & edit members */}
      {activeTab === "crews" && (
      <div id="crews" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex items-center justify-between">
          <div>
            <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="users" className="w-[16px] h-[16px]" /> Teams
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Click a team to view and edit members</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAddTeamModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
            >
              + Add Team
            </button>
            <button
              onClick={() => setAddTeamMemberOpen(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
            >
              + Add Member
            </button>
          </div>
        </div>
        <div className="px-5 py-5 space-y-3">
          {teams.map((team, i) => (
            <div key={team.id} className="border border-[var(--brd)] rounded-lg overflow-hidden">
              <div
                onClick={() => setEditingTeam(editingTeam === team.id ? null : team.id)}
                className="flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-[var(--bg)] transition-colors"
              >
                <div>
                  <div className="text-[13px] font-semibold text-[var(--tx)]">{team.label}</div>
                  <div className="text-[11px] text-[var(--tx3)] mt-0.5">{team.memberIds.join(", ") || "No members"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${team.active ? "bg-[var(--grdim)] text-[var(--grn)]" : "bg-[var(--brd)] text-[var(--tx3)]"}`}>
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
                <div className="px-4 py-3 border-t border-[var(--brd)] bg-[var(--bg)]">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Select team members</div>
                  <div className="flex flex-wrap gap-3 max-h-32 overflow-y-auto p-1">
                    {ALL_CREW.map((m) => {
                      const currentTeam = teams[i];
                      const norm = (s: string) => String(s).trim().toLowerCase();
                      const isChecked = currentTeam?.memberIds?.some((id) => norm(id) === norm(m)) ?? false;
                      return (
                        <label key={m} className="flex items-center gap-1.5 cursor-pointer group py-1.5 px-2 rounded-lg hover:bg-[var(--card)]/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleMember(i, m)}
                            className="checkbox-elegant"
                          />
                          <span className="text-[12px] text-[var(--tx)]">{m}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* iPad Setup Codes */}
      {activeTab === "devices" && <DeviceSetupCodes />}

      {/* App toggles - Notifications, Auto-Invoice, etc */}
      {activeTab === "app" && (
      <>
      <div id="app" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="settings" className="w-[16px] h-[16px]" /> App
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Platform-wide settings</p>
        </div>
        <div className="px-5 py-5 space-y-4">
          {[
            { label: "Crew GPS Tracking", desc: "Enable real-time crew location tracking", state: crewTracking, set: setCrewTracking },
            { label: "Partner Portal Access", desc: "Allow partners to view their deliveries", state: partnerPortal, set: setPartnerPortal },
            { label: "Auto-Invoicing", desc: "Generate invoices automatically on delivery", state: autoInvoicing, set: setAutoInvoicing },
          ].map((item) => {
            const isPartnerPortal = item.label === "Partner Portal Access";
            const handleToggle = () => {
              if (isPartnerPortal) {
                setPartnerPortal((prev) => {
                  const next = !prev;
                  if (next === false) {
                    const confirmed = window.confirm("Warning: Disabling Partner Portal Access will prevent all partners from viewing their deliveries. Are you sure you want to continue?");
                    if (!confirmed) return prev;
                  }
                  appTogglesUserChangedRef.current = true;
                  try {
                    localStorage.setItem(APP_TOGGLES_KEY, JSON.stringify({ crewTracking, partnerPortal: next, autoInvoicing }));
                  } catch (_) {}
                  return next;
                });
              } else {
                const next = !item.state;
                appTogglesUserChangedRef.current = true;
                item.set(next);
                try {
                  const nextToggles = {
                    crewTracking: item.label === "Crew GPS Tracking" ? next : crewTracking,
                    partnerPortal,
                    autoInvoicing: item.label === "Auto-Invoicing" ? next : autoInvoicing,
                  };
                  localStorage.setItem(APP_TOGGLES_KEY, JSON.stringify(nextToggles));
                } catch (_) {}
              }
            };
            const isOn = isPartnerPortal ? partnerPortal : item.state;
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
        </div>
      </div>

      {/* Danger Zone - in App Settings */}
      <div className="bg-[var(--card)] border border-[var(--red)]/20 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--red)]/10 bg-[rgba(209,67,67,0.04)]">
          <h2 className="font-heading text-[16px] font-bold text-[var(--red)] flex items-center gap-2">
            <Icon name="alertTriangle" className="w-[16px] h-[16px] text-[var(--red)]" /> Danger Zone
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Irreversible platform actions</p>
        </div>
        <div className="px-5 py-5 space-y-3">
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
      </div>
      </>
      )}

      {/* Partners Management */}
      {activeTab === "partners" && (
      <div id="partners" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex items-center justify-between">
          <div>
            <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="handshake" className="w-[16px] h-[16px]" /> Partners Management
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Retail, designers, hospitality, galleries</p>
          </div>
          <Link
            href="/admin/partners/retail"
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all inline-block"
          >
            Manage Partners →
          </Link>
        </div>
        <div className="px-5 py-5 space-y-2">
          {[
            { label: "Retail", slug: "retail" },
            { label: "Designers", slug: "designers" },
            { label: "Hospitality", slug: "hospitality" },
            { label: "Galleries", slug: "gallery" },
            { label: "Realtors", slug: "realtors" },
          ].map(({ label, slug }) => (
            <div key={slug} className="flex items-center justify-between py-2.5 border-b border-[var(--brd)] last:border-0">
              <div className="text-[13px] font-medium text-[var(--tx)]">{label}</div>
              <Link href={`/admin/partners/${slug}`} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
                Manage →
              </Link>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* User Management - Superadmin only */}
      {activeTab === "users" && isSuperAdmin && (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="lock" className="w-[16px] h-[16px]" /> User Management
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Roles, permissions, and access control</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/users"
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
            >
              View All Users
            </Link>
            <button
              onClick={() => setInviteUserOpen(true)}
              className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all shrink-0"
            >
              + Invite Team Member
            </button>
          </div>
        </div>
        <div className="px-5 py-5">
          {usersLoading ? (
            <div className="py-8 text-center text-[13px] text-[var(--tx3)]">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--gdim)] border border-[rgba(201,169,98,0.25)] mb-4">
                <Icon name="users" className="w-6 h-6 text-[var(--gold)]" />
              </div>
              <p className="text-[14px] font-medium text-[var(--tx)] mb-1">No users yet</p>
              <p className="text-[12px] text-[var(--tx3)] mb-5 max-w-[260px] mx-auto">Invite team members to give them access to the platform. They&apos;ll receive an email to sign in and get started.</p>
              <button
                onClick={() => setInviteUserOpen(true)}
                className="px-6 py-3 rounded-lg text-[13px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
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
                      {u.role === "admin" ? "Admin" : u.role === "manager" ? "Manager" : u.role === "coordinator" ? "Coordinator" : u.role === "viewer" ? "Viewer" : "Dispatcher"}
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
      </div>
      )}

      {/* Add Team Modal - uses GlobalModal via ModalOverlay */}
      <ModalOverlay open={addTeamModalOpen} onClose={() => setAddTeamModalOpen(false)} title="Add Team" maxWidth="md">
        <div className="p-5 space-y-5">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Team name</label>
            <input
              value={addTeamName}
              onChange={(e) => setAddTeamName(e.target.value)}
              placeholder="e.g. Team A"
              className="w-full px-4 py-2.5 rounded-lg text-[13px] bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] focus:border-[var(--gold)] outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">Team members</label>
            <div className="flex flex-wrap gap-3 max-h-44 overflow-y-auto p-1 -m-1">
              {ALL_CREW.map((m) => (
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
            className="w-full px-4 py-3 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
      />
    </div>
  );
}
