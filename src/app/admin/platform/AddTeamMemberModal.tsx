"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";

const ALL_CREW = ["Marcus", "Devon", "James", "Olu", "Ryan", "Chris", "Specialist", "Michael T.", "Alex", "Jordan", "Sam", "Taylor"];

interface Team {
  id: string;
  label: string;
  memberIds: string[];
  active: boolean;
}

interface AddTeamMemberModalProps {
  open: boolean;
  onClose: () => void;
  teams: Team[];
  onTeamsChange: (teams: Team[]) => void;
}

export default function AddTeamMemberModal({ open, onClose, teams, onTeamsChange }: AddTeamMemberModalProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  const filteredCrew = search.trim()
    ? ALL_CREW.filter((m) => m.toLowerCase().includes(search.toLowerCase()))
    : ALL_CREW;

  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!selectedMember || !selectedTeamId) {
      toast("Select a member and team", "x");
      return;
    }
    const teamIdx = teams.findIndex((t) => t.id === selectedTeamId);
    if (teamIdx === -1) return;
    const team = teams[teamIdx];
    if (team.memberIds.includes(selectedMember)) {
      toast(`${selectedMember} is already in ${team.label}`, "x");
      return;
    }
    const newMembers = [...team.memberIds, selectedMember];
    const next = [...teams];
    next[teamIdx] = { ...next[teamIdx], memberIds: newMembers };
    onTeamsChange(next);

    setSaving(true);
    const res = await fetch("/api/crews/update-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crewId: team.id, members: newMembers }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      toast(data.error || "Failed to add member", "x");
      onTeamsChange(teams);
      return;
    }
    toast(`${selectedMember} added to ${team.label}`, "check");
    setSelectedMember(null);
    setSelectedTeamId("");
    setSearch("");
    onClose();
  };

  const handleClose = () => {
    setSelectedMember(null);
    setSelectedTeamId("");
    setSearch("");
    onClose();
  };

  return (
    <ModalOverlay open={open} onClose={handleClose} title="Add Team Member" maxWidth="sm">
      <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Search crew member</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type name to search…"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Select member</label>
          <div className="max-h-32 overflow-y-auto flex flex-wrap gap-2 p-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg">
            {filteredCrew.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMember(selectedMember === m ? null : m)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  selectedMember === m
                    ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                    : "bg-[var(--card)] border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Assign to team</label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            <option value="">Choose team…</option>
            {teams.filter((t) => t.active).map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedMember || !selectedTeamId || saving}
            className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add to Team"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
