"use client";

import { useMemo, useState } from "react";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";
import { normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { Icon } from "@/components/AppIcons";

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
  const phoneInput = usePhoneInput(phone, setPhone);
  const [pin, setPin] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState<"lead" | "specialist" | "driver">("specialist");
  const [saving, setSaving] = useState(false);
  /** Server said phone exists but client list did not include it — offer update flow */
  const [staleDuplicate, setStaleDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [createdMember, setCreatedMember] = useState<{ name: string; phone: string; email?: string } | null>(null);
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  const roster = [...new Set(teams.flatMap((t) => t.memberIds || []).filter(Boolean))];
  const hasPortalAccess = (n: string) => crewPortalMembers.some((m) => nameMatches(m.name, n));
  const availableForPortal = roster.filter((n) => !hasPortalAccess(n)).sort((a, b) => a.localeCompare(b));

  const handleClose = () => {
    setName("");
    setPhone("");
    setPin("");
    setTeamId("");
    setRole("specialist");
    setStaleDuplicate(null);
    setCreatedMember(null);
    setSmsSent(false);
    onClose();
  };

  /** Same 10-digit key as API — if this phone already has portal access, we update instead of insert */
  const phoneOwner = useMemo(() => {
    const np = normalizePhone(phone);
    if (np.length < 10) return null;
    return crewPortalMembers.find((m) => normalizePhone(m.phone) === np) ?? null;
  }, [phone, crewPortalMembers]);

  const existingMemberId = phoneOwner?.id ?? staleDuplicate?.id;

  const handleSendSetupSms = async () => {
    if (!createdMember?.phone) return;
    setSmsSending(true);
    try {
      const loginUrl = `${window.location.origin}/crew/login`;
      const message = `Welcome to Yugo! Access your crew portal here: ${loginUrl}. Login with your phone: ${createdMember.phone} and your PIN.`;
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: createdMember.phone,
          message,
          type: "crew_setup_link",
          recipient_name: createdMember.name,
        }),
      });
      if (res.ok) {
        setSmsSent(true);
        toast("Setup link sent via SMS", "check");
      } else {
        const d = await res.json().catch(() => ({}));
        toast(d.error || "Failed to send SMS", "x");
      }
    } finally {
      setSmsSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = normalizePhone(phone);
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
      const body: Record<string, unknown> = {
        name: trimmedName,
        phone: trimmedPhone ? "+1" + trimmedPhone : "",
        pin,
        role,
        team_id: teamId,
      };
      if (existingMemberId) {
        body.existing_member_id = existingMemberId;
      }
      const r = await fetch("/api/admin/crew-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 409 && data?.code === "DUPLICATE_PHONE" && data?.existingMember?.id) {
        setStaleDuplicate({ id: data.existingMember.id, name: data.existingMember.name });
        toast("This phone already has portal access — confirm update below.", "x");
        return;
      }
      if (!r.ok) {
        toast(data.error || "Failed to add portal access", "x");
        return;
      }
      setStaleDuplicate(null);
      if (existingMemberId) {
        toast("Portal access updated. They can log in with this phone and PIN.", "check");
      } else {
        toast("Portal access added. They can log in with this phone and PIN.", "check");
      }
      onAdded();
      // Store created member for SMS option before closing
      const normalizedPhone = trimmedPhone ? "+1" + trimmedPhone : "";
      setCreatedMember({ name: trimmedName, phone: normalizedPhone });
      setName("");
      setPin("");
      setTeamId("");
      setRole("specialist");
      setPhone("");
    } finally {
      setSaving(false);
    }
  };

  const activeTeams = teams.filter((t) => t.active);

  if (createdMember) {
    return (
      <ModalOverlay open={open} onClose={handleClose} title="Portal Access Added" maxWidth="sm">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-[var(--grn)]/10 border border-[var(--grn)]/20 rounded-xl">
            <Icon name="check" className="w-4 h-4 text-[var(--grn)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-[var(--tx)]">{createdMember.name}</p>
              <p className="text-[11px] text-[var(--tx3)]">
                Portal access created. Login: {createdMember.phone}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[12px] text-[var(--tx2)] mb-3">
              Send the portal login link to their phone so they can access the crew portal on a tablet or phone.
            </p>
            <button
              type="button"
              onClick={handleSendSetupSms}
              disabled={smsSending || smsSent || !createdMember.phone}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50"
            >
              <Icon name="messageSquare" className="w-3.5 h-3.5" />
              {smsSent ? "Setup Link Sent" : smsSending ? "Sending…" : "Send Setup Link via SMS"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-full px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
          >
            Done
          </button>
        </div>
      </ModalOverlay>
    );
  }

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
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
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
            ref={phoneInput.ref}
            type="tel"
            value={phone}
            onChange={(ev) => {
              phoneInput.onChange(ev);
              setStaleDuplicate(null);
            }}
            placeholder={PHONE_PLACEHOLDER}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
          />
          {(phoneOwner || staleDuplicate) && (
            <p className="text-[11px] text-[var(--tx2)] mt-2 p-3 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/25">
              {phoneOwner ? (
                <>
                  This number is already linked to <span className="font-semibold text-[var(--tx)]">{phoneOwner.name}</span> for the crew portal.
                  Submitting will update their PIN, team, and role with what you entered above — not create a second login.
                </>
              ) : (
                <>
                  This number is already registered to <span className="font-semibold text-[var(--tx)]">{staleDuplicate?.name}</span>.
                  Submit again to update their PIN and team with the values above.
                </>
              )}
            </p>
          )}
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
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] font-mono text-[var(--tx)] focus:border-[var(--brd)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Team</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
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
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
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
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50">
            {saving ? (existingMemberId ? "Updating…" : "Adding…") : existingMemberId ? "Update portal access" : "Add access"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
