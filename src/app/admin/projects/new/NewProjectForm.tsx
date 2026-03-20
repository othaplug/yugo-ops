"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { formatCurrency } from "@/lib/format-currency";
import { Check, Plus, Trash as Trash2 } from "@phosphor-icons/react";

interface Partner {
  id: string;
  name: string;
  type: string;
  email?: string;
  contact_name?: string;
}

interface Phase {
  phase_name: string;
  description: string;
  scheduled_date: string;
  items_expected: string;
}

const fieldInput =
  "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none transition-colors";

const STEPS = ["Partner & Client", "Phases", "Estimate", "Review"];

export default function NewProjectForm({ partners, currentUserId, partnerFilter }: { partners: Partner[]; currentUserId: string | null; partnerFilter?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Partner & Client
  const [partnerId, setPartnerId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [endClientName, setEndClientName] = useState("");
  const [endClientContact, setEndClientContact] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");

  // Step 2: Phases
  const [phases, setPhases] = useState<Phase[]>([
    { phase_name: "", description: "", scheduled_date: "", items_expected: "" },
  ]);

  // Step 3: Budget
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [projectMgmtFee, setProjectMgmtFee] = useState("");

  const selectedPartner = partners.find((p) => p.id === partnerId);
  const subtotal = (parseFloat(estimatedBudget) || 0) + (parseFloat(projectMgmtFee) || 0);
  const hst = Math.round(subtotal * 0.13 * 100) / 100;
  const totalEstimated = subtotal + hst;

  const addPhase = () => setPhases([...phases, { phase_name: "", description: "", scheduled_date: "", items_expected: "" }]);
  const removePhase = (i: number) => setPhases(phases.filter((_, idx) => idx !== i));
  const updatePhase = (i: number, field: keyof Phase, val: string) => {
    const updated = [...phases];
    updated[i] = { ...updated[i], [field]: val };
    setPhases(updated);
  };

  const canNext = () => {
    if (step === 0) return partnerId && projectName;
    if (step === 1) return phases.some((p) => p.phase_name.trim());
    return true;
  };

  const handleSubmit = async (status: "draft" | "proposed") => {
    setLoading(true);
    setError("");
    try {
      const validPhases = phases.filter((p) => p.phase_name.trim());
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: partnerId,
          project_name: projectName,
          description: description || null,
          end_client_name: endClientName || null,
          end_client_contact: endClientContact || null,
          site_address: siteAddress || null,
          status,
          start_date: startDate || null,
          target_end_date: targetEndDate || null,
          estimated_budget: estimatedBudget ? parseFloat(estimatedBudget) : null,
          project_mgmt_fee: projectMgmtFee ? parseFloat(projectMgmtFee) : 0,
          project_lead: currentUserId,
          created_by: currentUserId,
          phases: validPhases.map((p) => ({
            phase_name: p.phase_name,
            description: p.items_expected ? `Items: ${p.items_expected}` : p.description || null,
            scheduled_date: p.scheduled_date || null,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to create project");
      }
      const project = await res.json();
      router.push(partnerFilter === "designer" ? `/admin/projects/${project.id}?from=designers` : `/admin/projects/${project.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-5 max-w-[720px] mx-auto">
      <BackButton label="Back" />

      <h1 className="font-heading text-[20px] font-bold text-[var(--tx)] mt-4 mb-6">New Project</h1>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                i === step
                  ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                  : i < step
                    ? "bg-emerald-500/10 text-emerald-500 cursor-pointer hover:bg-emerald-500/20"
                    : "bg-[var(--bg)] text-[var(--tx3)] border border-[var(--brd)]"
              }`}
            >
              {i < step ? (
                <Check weight="bold" size={12} className="text-current" aria-hidden />
              ) : (
                <span>{i + 1}</span>
              )}
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-[var(--brd)]" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[12px]">{error}</div>
      )}

      {/* Step 1: Partner & Client */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Partner *</label>
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={fieldInput}>
              <option value="">Select partner...</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Project Name *</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g., Chen Residence, Full Furnishing" className={fieldInput} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">End Client Name</label>
              <input value={endClientName} onChange={(e) => setEndClientName(e.target.value)} placeholder="Mr. & Mrs. Chen" className={fieldInput} />
            </div>
            <div>
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Client Contact</label>
              <input value={endClientContact} onChange={(e) => setEndClientContact(e.target.value)} placeholder="Phone or email" className={fieldInput} />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Site Address</label>
            <AddressAutocomplete value={siteAddress} onChange={(addr) => setSiteAddress(addr.fullAddress)} placeholder="Primary delivery location" className={fieldInput} />
          </div>

          <div>
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Complete home furnishing. 6 vendor shipments expected..." rows={3} className={fieldInput} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldInput} />
            </div>
            <div>
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Target End Date</label>
              <input type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} className={fieldInput} />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Phases */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-[12px] text-[var(--tx3)] mb-2">Define the major milestones for this project. Each phase groups related deliveries and items.</p>

          {phases.map((phase, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Phase {i + 1}</span>
                {phases.length > 1 && (
                  <button onClick={() => removePhase(i)} className="p-1 rounded hover:bg-red-500/10 text-[var(--tx3)] hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <input
                value={phase.phase_name}
                onChange={(e) => updatePhase(i, "phase_name", e.target.value)}
                placeholder="e.g., Phase 1: Living Room & Master Bedroom"
                className={fieldInput}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1 block">Target Date</label>
                  <input type="date" value={phase.scheduled_date} onChange={(e) => updatePhase(i, "scheduled_date", e.target.value)} className={fieldInput} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1 block">Items Expected</label>
                  <input value={phase.items_expected} onChange={(e) => updatePhase(i, "items_expected", e.target.value)} placeholder="Sofa, chairs, bed..." className={fieldInput} />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addPhase}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold border border-dashed border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors w-full justify-center"
          >
            <Plus size={14} />
            Add Phase
          </button>
        </div>
      )}

      {/* Step 3: Estimate */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 space-y-4">
            <div>
              <div className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Initial Estimate</div>
              <p className="text-[11px] text-[var(--tx3)] mt-1">This is a rough starting estimate. The actual project cost will update automatically as deliveries are created and priced.</p>
            </div>

            {selectedPartner && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--tx2)]">
                <span>Partner:</span>
                <span className="font-semibold text-[var(--tx)]">{selectedPartner.name}</span>
                <span className="text-[var(--tx3)] capitalize">({selectedPartner.type})</span>
              </div>
            )}

            <div>
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1 block">Estimated Delivery & Logistics Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--tx3)]">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={estimatedBudget}
                  onChange={(e) => setEstimatedBudget(e.target.value)}
                  placeholder="0.00"
                  className={`${fieldInput} pl-7`}
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1 block">Project Management Fee</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--tx3)]">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={projectMgmtFee}
                  onChange={(e) => setProjectMgmtFee(e.target.value)}
                  placeholder="0.00"
                  className={`${fieldInput} pl-7`}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--brd)] space-y-1.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-[var(--tx3)]">Subtotal</span>
                <span className="text-[var(--tx)]">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[var(--tx3)]">HST (13%)</span>
                <span className="text-[var(--tx)]">{formatCurrency(hst)}</span>
              </div>
              <div className="flex justify-between text-[13px] pt-1.5 border-t border-[var(--brd)]">
                <span className="text-[var(--tx2)] font-medium">Total Estimated</span>
                <span className="font-bold text-[var(--tx)]">{formatCurrency(totalEstimated)}</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[var(--tx3)]">
            {phases.filter((p) => p.phase_name.trim()).length} phase{phases.filter((p) => p.phase_name.trim()).length !== 1 ? "s" : ""} planned
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 space-y-3">
            <div className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)] mb-2">Summary</div>

            <Row label="Partner" value={selectedPartner?.name || "—"} />
            <Row label="Project Name" value={projectName} />
            {endClientName && <Row label="End Client" value={endClientName} />}
            {siteAddress && <Row label="Site Address" value={siteAddress} />}
            {description && <Row label="Description" value={description} />}
            <Row label="Dates" value={`${startDate || "TBD"} → ${targetEndDate || "TBD"}`} />

            <div className="border-t border-[var(--brd)] pt-3 mt-3">
              <div className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)] mb-2">Phases</div>
              {phases.filter((p) => p.phase_name.trim()).map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-[12px]">
                  <span className="text-[var(--tx)] font-medium">{p.phase_name}</span>
                  <span className="text-[var(--tx3)]">{p.scheduled_date ? new Date(p.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--brd)] pt-3 mt-3">
              <div className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)] mb-2">Initial Estimate</div>
              <Row label="Logistics Cost" value={estimatedBudget ? formatCurrency(parseFloat(estimatedBudget)) : "—"} />
              <Row label="Mgmt Fee" value={projectMgmtFee ? formatCurrency(parseFloat(projectMgmtFee)) : "$0"} />
              <Row label="HST (13%)" value={formatCurrency(hst)} />
              <div className="flex justify-between text-[13px] font-bold pt-2 border-t border-[var(--brd)] mt-2">
                <span className="text-[var(--tx)]">Total (incl. HST)</span>
                <span className="text-[var(--gold)]">{formatCurrency(totalEstimated)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-[var(--brd)]">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : router.back()}
          className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] transition-colors"
        >
          {step === 0 ? "Cancel" : "Back"}
        </button>

        <div className="flex gap-2">
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="px-5 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <>
              <button
                onClick={() => handleSubmit("draft")}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] transition-colors disabled:opacity-40"
              >
                {loading ? "Creating..." : "Create as Draft"}
              </button>
              <button
                onClick={() => handleSubmit("proposed")}
                disabled={loading}
                className="px-5 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors disabled:opacity-40"
              >
                {loading ? "Creating..." : "Create & Send Proposal"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[12px] py-0.5">
      <span className="text-[var(--tx3)]">{label}</span>
      <span className="text-[var(--tx)] font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
