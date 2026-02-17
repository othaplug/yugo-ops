"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import { useToast } from "../../components/Toast";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { Plus, Trash2, FileText } from "lucide-react";

interface Org {
  id: string;
  name: string;
  type: string;
  email?: string;
  contact_name?: string;
  phone?: string;
  address?: string;
}

interface Crew {
  id: string;
  name: string;
  members?: string[];
}

const DEFAULT_ROOMS = ["Living Room", "Bedroom", "Kitchen", "Bathroom", "Office", "Other"];
const COMPLEXITY_PRESETS = ["White Glove", "Piano", "High Value Client", "Repeat Client", "Artwork", "Antiques", "Storage"];
const TIME_OPTIONS = (() => {
  const times: string[] = [];
  for (let h = 6; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      const h12 = h > 12 ? h - 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      times.push(`${h12}:${m.toString().padStart(2, "0")} ${ampm}`);
    }
  }
  return times;
})();

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const fieldInput =
  "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none transition-colors";

export default function CreateMoveForm({
  organizations,
  crews,
}: {
  organizations: Org[];
  crews: Crew[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [moveType, setMoveType] = useState<"residential" | "office">("residential");
  const [organizationId, setOrganizationId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [fromLat, setFromLat] = useState<number | null>(null);
  const [fromLng, setFromLng] = useState<number | null>(null);
  const [toLat, setToLat] = useState<number | null>(null);
  const [toLng, setToLng] = useState<number | null>(null);
  const [fromAccess, setFromAccess] = useState("");
  const [toAccess, setToAccess] = useState("");
  const [estimate, setEstimate] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [arrivalWindow, setArrivalWindow] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [complexityIndicators, setComplexityIndicators] = useState<string[]>([]);
  const [customComplexity, setCustomComplexity] = useState("");
  const [preferredContact, setPreferredContact] = useState("email");
  const [crewId, setCrewId] = useState("");
  const [inventory, setInventory] = useState<{ room: string; item_name: string }[]>([]);
  const [newRoom, setNewRoom] = useState(DEFAULT_ROOMS[0]);
  const [newItemName, setNewItemName] = useState("");
  const [teamMembers, setTeamMembers] = useState<Set<string>>(new Set());
  const selectedCrewMembers = crewId ? (crews.find((c) => c.id === crewId)?.members || []) : [];
  const [docFiles, setDocFiles] = useState<File[]>([]);

  // Auto-fill when client/partner selected
  useEffect(() => {
    if (organizationId) {
      const org = organizations.find((o) => o.id === organizationId);
      if (org) {
        setClientName(org.contact_name || org.name || "");
        setClientEmail(org.email || "");
        setClientPhone(org.phone || "");
      }
    }
  }, [organizationId, organizations]);

  const toggleTeamMember = (name: string) => {
    setTeamMembers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    if (crewId) {
      const members = crews.find((c) => c.id === crewId)?.members || [];
      setTeamMembers(new Set(members));
    } else {
      setTeamMembers(new Set());
    }
  }, [crewId, crews]);

  const addInventoryItem = () => {
    if (!newItemName.trim()) return;
    setInventory((prev) => [...prev, { room: newRoom, item_name: newItemName.trim() }]);
    setNewItemName("");
  };

  const removeInventoryItem = (idx: number) => {
    setInventory((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setDocFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeDoc = (idx: number) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clientName.trim()) {
      alert("Please fill in client name.");
      return;
    }
    if (!fromAddress.trim()) return;
    if (!toAddress.trim()) return;

    // If no client selected, check for duplicate before creating
    if (!organizationId) {
      const checkRes = await fetch("/api/admin/clients/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          client_phone: clientPhone.trim(),
        }),
      });
      const checkData = await checkRes.json();
      if (checkData.exists) {
        alert(`Client already exists: ${checkData.org?.name || "Existing client"}. Please select them from the dropdown.`);
        return;
      }
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("move_type", moveType);
      formData.append("organization_id", organizationId);
      formData.append("from_access", fromAccess);
      formData.append("to_access", toAccess);
      formData.append("client_name", clientName.trim());
      formData.append("client_email", clientEmail.trim());
      formData.append("client_phone", clientPhone.trim());
      formData.append("from_address", fromAddress.trim());
      formData.append("to_address", toAddress.trim());
      if (fromLat != null && fromLng != null) {
        formData.append("from_lat", String(fromLat));
        formData.append("from_lng", String(fromLng));
      }
      if (toLat != null && toLng != null) {
        formData.append("to_lat", String(toLat));
        formData.append("to_lng", String(toLng));
      }
      formData.append("estimate", estimate || "0");
      formData.append("scheduled_date", scheduledDate);
      formData.append("scheduled_time", scheduledTime);
      formData.append("arrival_window", arrivalWindow);
      formData.append("access_notes", accessNotes);
      formData.append("internal_notes", internalNotes);
      formData.append("complexity_indicators", JSON.stringify(complexityIndicators));
      formData.append("preferred_contact", preferredContact);
      formData.append("crew_id", crewId);
      formData.append("assigned_members", JSON.stringify(Array.from(teamMembers)));
      formData.append("inventory", JSON.stringify(inventory));
      docFiles.forEach((f) => formData.append("documents", f));

      const res = await fetch("/api/admin/moves/create", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; emailSent?: boolean; emailError?: string };
      if (!res.ok) throw new Error(data.error || `Failed to create move (${res.status})`);
      if (data.emailSent) {
        toast("Move created. Client notified by email.", "mail");
      } else if (data.emailError) {
        toast(`Move created. Email not sent: ${data.emailError}`, "x");
      } else {
        toast("Move created.", "check");
      }
      router.push(`/admin/moves/${data.id}`);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create move");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <BackButton label="Back" />
      </div>
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)]">
          <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">Create New Move</h1>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">
            Add a new residential or office move. Select a client to auto-fill, or enter details to create a new one.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Move type */}
          <div>
            <Field label="Move Type">
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="move_type"
                    checked={moveType === "residential"}
                    onChange={() => setMoveType("residential")}
                    className="accent-[var(--gold)]"
                  />
                  <span className="text-[12px]">Residential</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="move_type"
                    checked={moveType === "office"}
                    onChange={() => setMoveType("office")}
                    className="accent-[var(--gold)]"
                  />
                  <span className="text-[12px]">Office / Commercial</span>
                </label>
              </div>
            </Field>
          </div>

          {/* Client section */}
          <div className="space-y-4 p-4 rounded-lg bg-[var(--bg)]/50 border border-[var(--brd)]/50">
            <h3 className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">Client</h3>
            <Field label="Select to auto fill">
              <select
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className={fieldInput}
              >
                <option value="">Select to auto fill…</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.contact_name || o.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Client Name *">
                <input
                  name="client_name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Full name"
                  required
                  className={fieldInput}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  name="client_email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@example.com"
                  className={fieldInput}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  name="client_phone"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className={fieldInput}
                />
              </Field>
            </div>
            <Field label="Preferred Contact">
              <select
                value={preferredContact}
                onChange={(e) => setPreferredContact(e.target.value)}
                className={fieldInput}
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="both">Both</option>
              </select>
            </Field>
          </div>

          {/* Addresses */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">Addresses</h3>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-3 items-end">
                <div className="flex-1 min-w-0 w-full">
                  <AddressAutocomplete
                    value={fromAddress}
                    onRawChange={setFromAddress}
                    onChange={(r) => {
                      setFromAddress(r.fullAddress);
                      setFromLat(r.lat);
                      setFromLng(r.lng);
                    }}
                    placeholder="Origin address"
                    label="From Address"
                    required
                    className={fieldInput}
                  />
                </div>
                <div className="w-full sm:w-[140px]">
                  <Field label="Access">
                    <select
                    name="from_access"
                    value={fromAccess}
                    onChange={(e) => setFromAccess(e.target.value)}
                    className={fieldInput}
                  >
                    <option value="">Select…</option>
                    <option value="Elevator">Elevator</option>
                    <option value="Stairs">Stairs</option>
                    <option value="Loading dock">Loading dock</option>
                    <option value="Parking">Parking</option>
                    <option value="Gate / Buzz code">Gate / Buzz code</option>
                    <option value="Ground floor">Ground floor</option>
                    <option value="Building access required">Building access required</option>
                  </select>
                  </Field>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-3 items-end">
                <div className="flex-1 min-w-0 w-full">
                  <AddressAutocomplete
                    value={toAddress}
                    onRawChange={setToAddress}
                    onChange={(r) => {
                      setToAddress(r.fullAddress);
                      setToLat(r.lat);
                      setToLng(r.lng);
                    }}
                    placeholder="Destination address"
                    label="To Address"
                    required
                    className={fieldInput}
                  />
                </div>
                <div className="w-full sm:w-[140px]">
                  <Field label="Access">
                    <select
                    name="to_access"
                    value={toAccess}
                    onChange={(e) => setToAccess(e.target.value)}
                    className={fieldInput}
                  >
                    <option value="">Select…</option>
                    <option value="Elevator">Elevator</option>
                    <option value="Stairs">Stairs</option>
                    <option value="Loading dock">Loading dock</option>
                    <option value="Parking">Parking</option>
                    <option value="Gate / Buzz code">Gate / Buzz code</option>
                    <option value="Ground floor">Ground floor</option>
                    <option value="Building access required">Building access required</option>
                  </select>
                  </Field>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule & estimate */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Scheduled Date">
              <input
                type="date"
                name="scheduled_date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={fieldInput}
              />
            </Field>
            <Field label="Scheduled Time">
              <select
                name="scheduled_time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className={fieldInput}
              >
                <option value="">Select time…</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Arrival Window">
              <select
                name="arrival_window"
                value={arrivalWindow}
                onChange={(e) => setArrivalWindow(e.target.value)}
                className={fieldInput}
              >
                <option value="">Select window…</option>
                {TIME_WINDOW_OPTIONS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </Field>
            <Field label="Estimate ($)">
              <input
                type="number"
                name="estimate"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className={fieldInput}
              />
            </Field>
          </div>

          {/* Crew / team */}
          <div className="space-y-4 p-4 rounded-lg bg-[var(--bg)]/50 border border-[var(--brd)]/50">
            <h3 className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">Move Team</h3>
            <Field label="Crew">
              <select
                name="crew_id"
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                className={fieldInput}
              >
                <option value="">Select crew…</option>
                {crews.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Team Members">
              {selectedCrewMembers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedCrewMembers.map((m) => (
                    <label
                      key={m}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--brd)] cursor-pointer hover:border-[var(--gold)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={teamMembers.has(m)}
                        onChange={() => toggleTeamMember(m)}
                        className="accent-[var(--gold)]"
                      />
                      <span className="text-[11px]">{m}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-[var(--tx3)]">Select a crew above to see and assign members.</p>
              )}
            </Field>
          </div>

          {/* Inventory */}
          <div className="space-y-4 p-4 rounded-lg bg-[var(--bg)]/50 border border-[var(--brd)]/50">
            <h3 className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">
              Client Inventory (optional)
            </h3>
            <p className="text-[10px] text-[var(--tx3)]">Add items now or later from the move detail page.</p>
            {inventory.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {inventory.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)]"
                  >
                    <span className="text-[11px]">
                      <span className="text-[var(--tx3)]">{item.room}:</span> {item.item_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeInventoryItem(idx)}
                      className="p-1 rounded text-[var(--tx3)] hover:text-[var(--red)]"
                    >
                      <Trash2 className="w-[12px] h-[12px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="block text-[8px] text-[var(--tx3)] mb-0.5">Room</label>
                <select
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1.5 text-[var(--tx)]"
                >
                  {DEFAULT_ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[8px] text-[var(--tx3)] mb-0.5">Item</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInventoryItem())}
                  placeholder="e.g. Couch, Box 1"
                  className="w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1.5 text-[var(--tx)]"
                />
              </div>
              <button
                type="button"
                onClick={addInventoryItem}
                disabled={!newItemName.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] disabled:opacity-50"
              >
                <Plus className="w-[12px] h-[12px]" /> Add
              </button>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-4 p-4 rounded-lg bg-[var(--bg)]/50 border border-[var(--brd)]/50">
            <h3 className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">
              Documents & Invoices (optional)
            </h3>
            <p className="text-[10px] text-[var(--tx3)]">
              Upload PDFs now or add them later from the move detail page.
            </p>
            {docFiles.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {docFiles.map((f, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)]"
                  >
                    <FileText className="w-[12px] h-[12px] text-[var(--tx3)]" />
                    <span className="text-[11px] truncate flex-1">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeDoc(idx)}
                      className="p-1 rounded text-[var(--tx3)] hover:text-[var(--red)]"
                    >
                      <Trash2 className="w-[12px] h-[12px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <input
                id="move-doc-upload"
                type="file"
                accept=".pdf,image/*,application/pdf"
                onChange={handleDocChange}
                multiple
                className="hidden"
              />
              <label
                htmlFor="move-doc-upload"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] cursor-pointer hover:bg-[var(--gold2)]"
              >
                <Plus className="w-[12px] h-[12px]" />
                Upload PDF
              </label>
            </div>
          </div>

          {/* Complexity indicators */}
          <div className="space-y-4 p-4 rounded-lg bg-[var(--bg)]/50 border border-[var(--brd)]/50">
            <h3 className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">Complexity Indicators</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMPLEXITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setComplexityIndicators((prev) => (prev.includes(preset) ? prev.filter((p) => p !== preset) : [...prev, preset]))}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-colors ${complexityIndicators.includes(preset) ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]" : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--gold)]/40"}`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customComplexity}
                onChange={(e) => setCustomComplexity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customComplexity.trim()) {
                    e.preventDefault();
                    setComplexityIndicators((prev) => (prev.includes(customComplexity.trim()) ? prev : [...prev, customComplexity.trim()]));
                    setCustomComplexity("");
                  }
                }}
                placeholder="Add custom (press Enter)"
                className={`flex-1 ${fieldInput}`}
              />
              <button
                type="button"
                onClick={() => {
                  if (customComplexity.trim() && !complexityIndicators.includes(customComplexity.trim())) {
                    setComplexityIndicators((prev) => [...prev, customComplexity.trim()]);
                    setCustomComplexity("");
                  }
                }}
                className="px-3 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]"
              >
                Add
              </button>
            </div>
            {complexityIndicators.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {complexityIndicators.map((ind) => (
                  <span key={ind} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30">
                    {ind}
                    <button type="button" onClick={() => setComplexityIndicators((prev) => prev.filter((p) => p !== ind))} className="hover:text-[var(--red)]" aria-label={`Remove ${ind}`}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Access Notes">
              <textarea
                name="access_notes"
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                rows={4}
                placeholder="Elevator, parking, building access…"
                className={`${fieldInput} resize-none min-h-[88px]`}
              />
            </Field>
            <Field label="Internal Notes">
              <textarea
                name="internal_notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={4}
                placeholder="Internal notes…"
                className={`${fieldInput} resize-none min-h-[88px]`}
              />
            </Field>
          </div>

          <div className="flex gap-3 pt-4 border-t border-[var(--brd)]">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create Move"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
