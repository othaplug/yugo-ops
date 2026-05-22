"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/design-system/admin/lib/cn";
import AddressAutocomplete, { AddressResult } from "@/components/ui/AddressAutocomplete";
import { Plus, X, CaretLeft } from "@phosphor-icons/react";

interface Partner { id: string; name: string; type: string }
interface Room { room: string; notes: string }

const ACCESS_OPTIONS = [
  { value: "elevator", label: "Elevator" },
  { value: "ground_floor", label: "Ground Floor" },
  { value: "loading_dock", label: "Loading Dock" },
  { value: "stairs", label: "Stairs" },
];

const COMMON_ROOMS = [
  "Living Room", "Dining Room", "Kitchen", "Primary Bedroom",
  "Bedroom 2", "Bedroom 3", "Home Office", "Bathroom", "Entryway",
  "Outdoor / Terrace",
];

const label = "text-[11px] font-semibold text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-2 block";
const input = "w-full px-3 py-2.5 border border-[var(--yu3-line)] rounded-lg text-[13px] text-[var(--yu3-ink)] bg-[var(--yu3-bg-surface)] placeholder:text-[var(--yu3-ink-muted)] focus:outline-none focus:border-[#66143D]/40";

export default function NewDesignerProjectForm({
  partners,
  preselectedPartnerId,
}: {
  partners: Partner[];
  preselectedPartnerId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [partnerId, setPartnerId] = useState(preselectedPartnerId || "");
  const [projectName, setProjectName] = useState("");
  const [endClientName, setEndClientName] = useState("");
  const [endClientContact, setEndClientContact] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [installUnit, setInstallUnit] = useState("");
  const [installFloor, setInstallFloor] = useState("");
  const [installAccess, setInstallAccess] = useState("elevator");
  const [installAccessNotes, setInstallAccessNotes] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [coordinatorName, setCoordinatorName] = useState("");
  const [rooms, setRooms] = useState<Room[]>([{ room: "", notes: "" }]);
  const [notes, setNotes] = useState("");

  const addRoom = () => setRooms([...rooms, { room: "", notes: "" }]);
  const removeRoom = (i: number) => setRooms(rooms.filter((_, idx) => idx !== i));
  const updateRoom = (i: number, field: keyof Room, val: string) => {
    const updated = [...rooms];
    updated[i] = { ...updated[i], [field]: val };
    setRooms(updated);
  };

  const validRooms = rooms.filter((r) => r.room.trim());
  const canSubmit = partnerId && projectName.trim() && siteAddress.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/designer-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId,
          projectName: projectName.trim(),
          endClientName: endClientName.trim(),
          endClientContact: endClientContact.trim() || undefined,
          siteAddress: siteAddress.trim(),
          installUnit: installUnit.trim() || undefined,
          installFloor: installFloor.trim() || undefined,
          installAccess,
          installAccessNotes: installAccessNotes.trim() || undefined,
          targetEndDate: targetEndDate || undefined,
          estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : undefined,
          coordinatorName: coordinatorName.trim() || undefined,
          rooms: validRooms,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create project");
        return;
      }
      router.push(`/admin/b2b/designer-projects/${data.project.id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/b2b/designer-projects"
          className="inline-flex items-center gap-1 text-[12px] text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] mb-4"
        >
          <CaretLeft size={12} /> Designer Projects
        </Link>
        <h1 className="text-[18px] font-semibold text-[#2B0416]">New Designer Project</h1>
        <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1">
          Sets up a DP-prefixed coordination project for an interior design firm.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">
          {error}
        </div>
      )}

      {/* Design Firm */}
      <section className="mb-6">
        <label className={label}>Design Firm</label>
        <select
          value={partnerId}
          onChange={(e) => setPartnerId(e.target.value)}
          className={input}
        >
          <option value="">Select a design firm…</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {partners.length === 0 && (
          <p className="text-[11px] text-amber-600 mt-1">
            No interior designer partners found. Add one at{" "}
            <Link href="/admin/partners/new" className="underline">Partners → New</Link>.
          </p>
        )}
      </section>

      {/* Project info */}
      <section className="mb-6">
        <label className={label}>Project</label>
        <div className="space-y-3">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name (e.g. Grubner Suite 402 — Glenhill Condominium)"
            className={input}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={endClientName}
              onChange={(e) => setEndClientName(e.target.value)}
              placeholder="End client name (e.g. Grubner)"
              className={input}
            />
            <input
              value={endClientContact}
              onChange={(e) => setEndClientContact(e.target.value)}
              placeholder="Client phone / email (optional)"
              className={input}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[var(--yu3-ink-muted)] mb-1 block">
                Target install date
              </label>
              <input
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--yu3-ink-muted)] mb-1 block">
                Budget estimate ($)
              </label>
              <input
                type="number"
                value={estimatedBudget}
                onChange={(e) => setEstimatedBudget(e.target.value)}
                placeholder="e.g. 1200"
                className={input}
              />
            </div>
          </div>
          <input
            value={coordinatorName}
            onChange={(e) => setCoordinatorName(e.target.value)}
            placeholder="Coordinator name (optional)"
            className={input}
          />
        </div>
      </section>

      {/* Install address */}
      <section className="mb-6">
        <label className={label}>Install Address</label>
        <div className="space-y-3">
          <AddressAutocomplete
            value={siteAddress}
            onChange={(r: AddressResult) => setSiteAddress(r.fullAddress)}
            placeholder="Full street address"
            className={input}
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              value={installUnit}
              onChange={(e) => setInstallUnit(e.target.value)}
              placeholder="Unit / Suite"
              className={input}
            />
            <input
              value={installFloor}
              onChange={(e) => setInstallFloor(e.target.value)}
              placeholder="Floor"
              className={input}
            />
            <select
              value={installAccess}
              onChange={(e) => setInstallAccess(e.target.value)}
              className={input}
            >
              {ACCESS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={installAccessNotes}
            onChange={(e) => setInstallAccessNotes(e.target.value)}
            placeholder="Access notes (elevator booking, loading dock, concierge info…)"
            rows={2}
            className={cn(input, "resize-none")}
          />
        </div>
      </section>

      {/* Rooms */}
      <section className="mb-6">
        <label className={label}>Rooms Being Installed</label>
        <div className="space-y-2">
          {rooms.map((room, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  list="common-rooms"
                  value={room.room}
                  onChange={(e) => updateRoom(i, "room", e.target.value)}
                  placeholder="Room (e.g. Living Room)"
                  className={input}
                />
                <datalist id="common-rooms">
                  {COMMON_ROOMS.map((r) => <option key={r} value={r} />)}
                </datalist>
              </div>
              <div className="flex-1">
                <input
                  value={room.notes}
                  onChange={(e) => updateRoom(i, "notes", e.target.value)}
                  placeholder="Notes (optional)"
                  className={input}
                />
              </div>
              {rooms.length > 1 && (
                <button
                  onClick={() => removeRoom(i)}
                  className="mt-0.5 p-2 text-[var(--yu3-ink-muted)] hover:text-red-500 transition"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addRoom}
            className="flex items-center gap-1.5 text-[12px] text-[#66143D] font-medium mt-1 hover:opacity-80"
          >
            <Plus size={12} /> Add room
          </button>
        </div>
      </section>

      {/* Notes */}
      <section className="mb-8">
        <label className={label}>Internal Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any context or special considerations…"
          rows={3}
          className={cn(input, "resize-none")}
        />
      </section>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
        className={cn(
          "w-full py-3 rounded-xl text-[13px] font-semibold transition",
          canSubmit && !loading
            ? "bg-[#66143D] text-[#F9EDE4] hover:bg-[#4f0f2e]"
            : "bg-gray-200 text-gray-400 cursor-not-allowed",
        )}
      >
        {loading ? "Creating…" : "Create project"}
      </button>
    </div>
  );
}
