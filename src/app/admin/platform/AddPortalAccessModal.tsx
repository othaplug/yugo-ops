"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";

interface Team {
  id: string;
  label: string;
  memberIds: string[];
  active: boolean;
}

interface CrewPortalMember {
  id: string;
  name: string;
  phone: string;
  team_id: string;
  is_active: boolean;
}

interface AddPortalAccessModalProps {
  open: boolean;
  onClose: () => void;
  teams: Team[];
  crewPortalMembers: CrewPortalMember[];
  onAdded: () => void;
}

function norm(s: string) {
  return String(s).trim().toLowerCase();
}
function nameMatches(a: string, b: string) {
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.startsWith(nb + " ") || nb.startsWith(na + " ");
}

export default function AddPortalAccessModal({ open, onClose, teams, crewPortalMembers, onAdded }: AddPortalAccessModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState<"lead" | "specialist" | "driver">("specialist");
  const [saving, setSaving] = useState(false);

  const roster = [...new Set(teams.flatMap((t) => t.memberIds || []).filter(Boolean))];
  const hasPortalAccess = (n: string) => crewPortalMembers.some((m) => nameMatches(m.name, n));
  const availableForPortal = roster.filter((n) => !hasPortalAccess(n)).sort((a, b) => a.localeCompare(b));

  const handleClose = () => {
    setName("");
    setPhone("");
    setPin("");
    setTeamId("");
    setRole("specialist");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.replace(/\D/g, "");
    if (!trimmedName || trimmedPhone.length < 10) {
      toast("Name and a valid phone number (10+ digits) are required", "x");
      return;
    }
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      toast("PIN must be exactly 6 digits", "x");
      return;
    }
    if (!teamId) {
      toast("Select a team", "x");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/crew-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone.length === 10 ? "+1" + trimmedPhone : trimmedPhone,
          pin,
          role,
          team_id: teamId,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(data.error || "Failed to add portal access", "x");
        return;
      }
      toast("Portal access added. They can log in with this phone and PIN.", "check");
      onAdded();
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const activeTeams = teams.filter((t) => t.active);

  return (
    <ModalOverlay open={open} onClose={handleClose} title="Add portal access" maxWidth="sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <p className="text-[11px] text-[var(--tx3)]">
          This person will be able to log in to the Crew Portal (tablet/phone) with their phone and PIN. Select from roster members who don&apos;t yet have access.
        </p>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Team member</label>
          <select
            value={name}
            onChange={(e) => {
              const v = e.target.value;
              setName(v);
              const team = activeTeams.find((t) => (t.memberIds || []).some((m) => nameMatches(m, v)));
              if (team) setTeamId(team.id);
            }}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            <option value="">Choose team member…</option>
            {availableForPortal.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {availableForPortal.length === 0 && (
            <p className="text-[11px] text-[var(--tx3)] mt-1">Add members to team rosters first, or they already have portal access.</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Phone (for login)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="6475550123"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">PIN (6 digits)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] font-mono text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Team</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            <option value="">Choose team…</option>
            {activeTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "lead" | "specialist" | "driver")}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            <option value="lead">Lead (shown first on tablet)</option>
            <option value="specialist">Specialist</option>
            <option value="driver">Driver</option>
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={handleClose} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50">
            {saving ? "Adding…" : "Add access"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
