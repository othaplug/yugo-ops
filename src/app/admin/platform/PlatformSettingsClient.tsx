"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "../components/Toast";
import { Icon } from "@/components/AppIcons";
import InviteUserModal from "./InviteUserModal";
import InvitePartnerModal from "./InvitePartnerModal";
import AddTeamMemberModal from "./AddTeamMemberModal";
import { useRouter } from "next/navigation";

const ALL_CREW = ["Marcus", "Devon", "James", "Olu", "Ryan", "Chris", "Specialist", "Michael T.", "Alex", "Jordan", "Sam", "Taylor"];

const RATES_KEY = "yugo-platform-rates";

interface Team {
  id: string;
  label: string;
  memberIds: string[];
  active: boolean;
}

interface PlatformSettingsClientProps {
  initialTeams?: Team[];
}

export default function PlatformSettingsClient({ initialTeams = [] }: PlatformSettingsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [inviteUserOpen, setInviteUserOpen] = useState(false);
  const [invitePartnerOpen, setInvitePartnerOpen] = useState(false);
  const [addTeamMemberOpen, setAddTeamMemberOpen] = useState(false);
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
  const [memberSearch, setMemberSearch] = useState("");
  const [ratesSaving, setRatesSaving] = useState(false);

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

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

  const filteredCrew = memberSearch.trim()
    ? ALL_CREW.filter((m) => m.toLowerCase().includes(memberSearch.toLowerCase()))
    : ALL_CREW;

  const toggleMember = async (teamIdx: number, member: string) => {
    const team = teams[teamIdx];
    const ids = team.memberIds.includes(member)
      ? team.memberIds.filter((m) => m !== member)
      : [...team.memberIds, member];
    const next = [...teams];
    next[teamIdx] = { ...next[teamIdx], memberIds: ids };
    setTeams(next);

    const res = await fetch("/api/crews/update-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crewId: team.id, members: ids }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast(data.error || "Failed to update", "x");
      setTeams(teams);
    }
  };

  const addTeam = async () => {
    if (!newTeamName.trim()) return;
    const name = newTeamName.trim();
    setNewTeamName("");
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
    setTeams([...teams, { id: data.id || String(Date.now()), label: name, memberIds: [], active: true }]);
    toast("Team added", "check");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Pricing & Rates - editable */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="dollar" className="w-[16px] h-[16px]" /> Pricing & Rates
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Service tiers and hourly rates — edit below</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          {rates.map((r, i) => (
            <div key={r.tier} className="flex items-center justify-between gap-3 py-2.5 px-4 bg-[var(--bg)] border border-[var(--brd)] rounded-lg">
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

      {/* Crews & Teams - view & edit members */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex items-center justify-between">
          <div>
            <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="users" className="w-[16px] h-[16px]" /> Crews & Teams
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Click a team to view and edit members</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="New team name"
              className="px-3 py-1.5 rounded-lg text-[11px] bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] w-32"
            />
            <button onClick={addTeam} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all">
              + Add Team
            </button>
            <button onClick={() => setAddTeamMemberOpen(true)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all">
              + Add Team Member
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
                    onClick={(e) => { e.stopPropagation(); const next = [...teams]; next[i] = { ...next[i], active: !next[i].active }; setTeams(next); }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${team.active ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${team.active ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
              {editingTeam === team.id && (
                <div className="px-4 py-3 border-t border-[var(--brd)] bg-[var(--bg)]">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Add team member</div>
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search name…"
                    className="w-full mb-2 px-3 py-2 rounded-lg text-[11px] bg-[var(--card)] border border-[var(--brd)] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                  />
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {filteredCrew.map((m) => (
                      <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={team.memberIds.includes(m)}
                          onChange={() => toggleMember(i, m)}
                          className="rounded border-[var(--brd)]"
                        />
                        <span className="text-[11px] text-[var(--tx)]">{m}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* App toggles - Notifications, Auto-Invoice, etc */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
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
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3 border-b border-[var(--brd)] last:border-0">
              <div>
                <div className="text-[13px] font-semibold text-[var(--tx)]">{item.label}</div>
                <div className="text-[11px] text-[var(--tx3)] mt-0.5">{item.desc}</div>
              </div>
              <button
                onClick={() => item.set(!item.state)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  item.state ? "bg-[var(--gold)]" : "bg-[var(--brd)]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    item.state ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Partners Management */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex items-center justify-between">
          <div>
            <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="handshake" className="w-[16px] h-[16px]" /> Partners Management
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Retail, designers, hospitality, galleries</p>
          </div>
          <button
            onClick={() => setInvitePartnerOpen(true)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
          >
            Invite Partner
          </button>
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

      {/* User Management */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="lock" className="w-[16px] h-[16px]" /> User Management
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Roles, permissions, and access control</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-[var(--brd)]">
            <div>
              <div className="text-[13px] font-semibold text-[var(--tx)]">Administrator</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5">Full access to all features</div>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--gdim)] text-[var(--gold)]">Admin</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-[13px] font-semibold text-[var(--tx)]">Dispatcher</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5">Manage deliveries and crew</div>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--bldim)] text-[var(--blue)]">Dispatcher</span>
          </div>
          <button
            onClick={() => setInviteUserOpen(true)}
            className="mt-2 px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
          >
            + Invite User
          </button>
        </div>
      </div>

      <InviteUserModal open={inviteUserOpen} onClose={() => setInviteUserOpen(false)} />
      <InvitePartnerModal open={invitePartnerOpen} onClose={() => setInvitePartnerOpen(false)} />
      <AddTeamMemberModal
        open={addTeamMemberOpen}
        onClose={() => setAddTeamMemberOpen(false)}
        teams={teams}
        onTeamsChange={setTeams}
      />

      {/* Danger Zone */}
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
    </div>
  );
}
