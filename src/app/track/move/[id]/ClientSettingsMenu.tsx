"use client";

import { useState, useRef, useEffect } from "react";
import { FOREST, GOLD, CREAM } from "@/lib/client-theme";
import { SafeText } from "@/components/SafeText";
import {
  GearSix,
  FileText,
  Clock,
  X,
  Check,
  Plus,
  CircleNotch,
} from "@phosphor-icons/react";

const CLIENT_SETTINGS_KEY = "yugo-client-settings";
const CLIENT_THEME_KEY = "yugo-client-theme";

type ClientSettings = {
  reduceMotion?: boolean;
};

type ExistingClaim = {
  id: string;
  claim_number: string;
  status: string;
};

type ClaimItem = {
  name: string;
  damage_description: string;
  declared_value: string;
};

function getSettings(): ClientSettings {
  if (typeof window === "undefined") return {};
  try {
    const s = localStorage.getItem(CLIENT_SETTINGS_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function saveSettings(s: ClientSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLIENT_SETTINGS_KEY, JSON.stringify(s));
    document.documentElement.setAttribute("data-reduce-motion", s.reduceMotion ? "true" : "false");
  } catch {}
}

function getTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem(CLIENT_THEME_KEY) as "light" | "dark") || "light";
}

const EMPTY_ITEM: ClaimItem = { name: "", damage_description: "", declared_value: "" };

export default function ClientSettingsMenu({
  moveId,
  clientName = "",
  clientEmail = "",
  clientPhone = "",
  valuationTier = "released",
}: {
  moveId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  valuationTier?: string;
}) {
  const [open, setOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimStatusOpen, setClaimStatusOpen] = useState(false);
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [settings, setSettingsState] = useState<ClientSettings>({});
  const ref = useRef<HTMLDivElement>(null);

  // Claim form state
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([{ ...EMPTY_ITEM }]);
  const [claimPhotos, setClaimPhotos] = useState<File[]>([]);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [submittedClaimNumber, setSubmittedClaimNumber] = useState("");

  const [existingClaim, setExistingClaim] = useState<ExistingClaim | null>(null);

  useEffect(() => {
    const s = getSettings();
    setSettingsState(s);
    setThemeState(getTheme());
    document.documentElement.setAttribute("data-reduce-motion", s.reduceMotion ? "true" : "false");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/claims/status?moveId=${encodeURIComponent(moveId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.claim) setExistingClaim(data.claim);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [moveId, claimSubmitted]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const updateSetting = <K extends keyof ClientSettings>(key: K, val: ClientSettings[K]) => {
    const next = { ...settings, [key]: val };
    setSettingsState(next);
    saveSettings(next);
  };

  const setItem = (index: number, field: keyof ClaimItem, value: string) => {
    setClaimItems((prev) => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  };

  const addItem = () => setClaimItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (index: number) => setClaimItems((prev) => prev.filter((_, i) => i !== index));

  const handleClaimPhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setClaimPhotos((prev) => [...prev, ...Array.from(files)].slice(0, 5));
    e.target.value = "";
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError("");

    const validItems = claimItems.filter((it) => it.name.trim());
    if (validItems.length === 0) {
      setClaimError("Please describe at least one damaged item.");
      return;
    }

    setClaimSubmitting(true);
    try {
      const res = await fetch("/api/claims/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveId,
          clientName: clientName || "Client",
          clientEmail: clientEmail || "",
          clientPhone: clientPhone || null,
          valuationTier: valuationTier || "released",
          wasUpgraded: false,
          items: validItems.map((it) => ({
            name: it.name.trim(),
            damage_description: it.damage_description.trim(),
            declared_value: it.declared_value ? Number(it.declared_value) : 0,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      const claimId: string = data.claimId;
      setSubmittedClaimNumber(data.claimNumber || "");

      // Upload photos if any
      if (claimPhotos.length > 0) {
        await Promise.allSettled(
          claimPhotos.map((file) => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("claimId", claimId);
            fd.append("photoType", "damage");
            fd.append("uploadedBy", "client");
            return fetch("/api/claims/photos", { method: "POST", body: fd });
          })
        );
      }

      setClaimSubmitted(true);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setClaimSubmitting(false);
    }
  };

  const resetClaimForm = () => {
    setClaimItems([{ ...EMPTY_ITEM }]);
    setClaimPhotos([]);
    setClaimSubmitted(false);
    setClaimError("");
    setSubmittedClaimNumber("");
  };

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: `${GOLD}90` }}
          onMouseEnter={(e) => (e.currentTarget.style.color = GOLD)}
          onMouseLeave={(e) => (e.currentTarget.style.color = `${GOLD}90`)}
          aria-label="Settings"
        >
          <GearSix size={17} className="text-current" />
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-2 w-[260px] rounded-2xl shadow-2xl overflow-hidden z-50"
            style={{
              backgroundColor: theme === "dark" ? "#1A1A1A" : "#FFFFFF",
              border: `1px solid ${theme === "dark" ? "#333" : "#E7E5E4"}`,
            }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: theme === "dark" ? "#333" : "#E7E5E4" }}>
              <h3 className="text-[12px] font-bold" style={{ color: theme === "dark" ? "#F5F5F3" : FOREST }}>
                Settings
              </h3>
            </div>

            <div className="py-2">
              {/* Reduce motion */}
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: theme === "dark" ? "#CCC" : FOREST }}>
                  Reduce motion
                </span>
                <button
                  onClick={() => updateSetting("reduceMotion", !settings.reduceMotion)}
                  className="relative w-9 h-5 rounded-full transition-colors"
                  style={{ backgroundColor: settings.reduceMotion ? GOLD : (theme === "dark" ? "#444" : "#D4D4D4") }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ left: settings.reduceMotion ? "18px" : "2px" }}
                  />
                </button>
              </div>

              {/* Divider */}
              <div className="my-1 mx-4 h-px" style={{ backgroundColor: theme === "dark" ? "#333" : "#E7E5E4" }} />

              {/* Submit a claim */}
              <button
                onClick={() => { setOpen(false); setClaimOpen(true); }}
                className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme === "dark" ? "#222" : "#F8F7F4")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <FileText size={14} color={theme === "dark" ? "#888" : "#999"} />
                <span className="text-[11px] font-medium" style={{ color: theme === "dark" ? "#999" : "#888" }}>
                  Submit a claim
                </span>
              </button>

              {/* View claim status, only when a claim exists */}
              {existingClaim && (
                <button
                  onClick={() => { setOpen(false); setClaimStatusOpen(true); }}
                  className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme === "dark" ? "#222" : "#F8F7F4")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Clock size={14} color={GOLD} />
                  <span className="text-[11px] font-semibold" style={{ color: GOLD }}>
                    View claim status
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Claim Submission Modal ── */}
      {claimOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex min-h-0 items-center justify-center p-4 sm:p-5 z-[99990]"
          onClick={(e) => { if (e.target === e.currentTarget) { setClaimOpen(false); resetClaimForm(); } }}
        >
          <div
            className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[460px] shadow-2xl overflow-hidden"
            style={{ maxHeight: "min(92dvh, 92vh)", overflowY: "auto", backgroundColor: theme === "dark" ? "#1A1A1A" : "#FFFFFF", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: theme === "dark" ? "#333" : "#E7E5E4" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-bold" style={{ color: theme === "dark" ? "#F5F5F3" : FOREST }}>
                    Submit a Claim
                  </h3>
                  <p className="text-[11px] mt-1" style={{ color: theme === "dark" ? "#888" : "#999" }}>
                    Report damages or missing items from your move
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setClaimOpen(false); resetClaimForm(); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ backgroundColor: theme === "dark" ? "#333" : "#F5F5F3", color: theme === "dark" ? "#999" : "#666" }}
                >
                  <X size={12} weight="regular" className="text-current" />
                </button>
              </div>
            </div>

            {claimSubmitted ? (
              /* ── Success state ── */
              <div className="px-6 py-10 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${GOLD}18` }}>
                  <Check size={24} color={GOLD} weight="bold" />
                </div>
                <h4 className="text-[15px] font-bold mb-1" style={{ color: theme === "dark" ? "#F5F5F3" : FOREST }}>
                  Claim Submitted
                </h4>
                {submittedClaimNumber && (
                  <p className="text-[11px] font-mono font-semibold mb-2" style={{ color: GOLD }}>
                    {submittedClaimNumber}
                  </p>
                )}
                <p className="text-[12px] max-w-[280px] mx-auto leading-relaxed" style={{ color: theme === "dark" ? "#888" : "#999" }}>
                  We&apos;ve received your claim and will follow up by email within 3 business days.
                </p>
                <button
                  type="button"
                  onClick={() => { setClaimOpen(false); resetClaimForm(); }}
                  className="mt-6 px-6 py-2.5 rounded-xl text-[12px] font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: GOLD, color: CREAM }}
                >
                  Done
                </button>
              </div>
            ) : (
              /* ── Form ── */
              <form onSubmit={handleClaimSubmit} className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>
                      Damaged Item(s) *
                    </label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-[10px] font-semibold flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                      style={{ color: FOREST }}
                    >
                      <Plus size={10} weight="regular" className="text-current" />
                      Add item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {claimItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border p-3.5 space-y-2.5"
                        style={{ borderColor: theme === "dark" ? "#333" : "#E7E5E4", backgroundColor: theme === "dark" ? "#111" : "#FAFAF8" }}
                      >
                        {claimItems.length > 1 && (
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold opacity-40" style={{ color: FOREST }}>Item {idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-[10px] opacity-40 hover:opacity-80"
                              style={{ color: "#EF4444" }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        <input
                          value={item.name}
                          onChange={(e) => setItem(idx, "name", e.target.value)}
                          placeholder="Item name (e.g. Sofa, TV, Glass table)"
                          required={idx === 0}
                          className="w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none"
                          style={{ borderColor: theme === "dark" ? "#444" : "#E7E5E4", backgroundColor: theme === "dark" ? "#222" : "#FFF", color: theme === "dark" ? "#E8E5E0" : "#1A1A1A" }}
                        />
                        <textarea
                          value={item.damage_description}
                          onChange={(e) => setItem(idx, "damage_description", e.target.value)}
                          placeholder="Describe the damage..."
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none resize-none"
                          style={{ borderColor: theme === "dark" ? "#444" : "#E7E5E4", backgroundColor: theme === "dark" ? "#222" : "#FFF", color: theme === "dark" ? "#E8E5E0" : "#1A1A1A" }}
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium opacity-60" style={{ color: FOREST }}>$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.declared_value}
                            onChange={(e) => setItem(idx, "declared_value", e.target.value)}
                            placeholder="Declared value"
                            className="flex-1 px-3 py-2 rounded-lg border text-[12px] focus:outline-none"
                            style={{ borderColor: theme === "dark" ? "#444" : "#E7E5E4", backgroundColor: theme === "dark" ? "#222" : "#FFF", color: theme === "dark" ? "#E8E5E0" : "#1A1A1A" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Photos */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: GOLD }}>
                    Photos (optional, max 5)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {claimPhotos.map((f, i) => (
                      <div
                        key={i}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border"
                        style={{ borderColor: theme === "dark" ? "#444" : "#E7E5E4" }}
                      >
                        <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setClaimPhotos((p) => p.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                        >
                          <X size={8} weight="regular" className="text-current" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {claimPhotos.length < 5 && (
                    <label
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed text-[11px] font-semibold cursor-pointer transition-colors"
                      style={{ borderColor: theme === "dark" ? "#555" : "#D4D0C8", color: theme === "dark" ? "#888" : "#888" }}
                    >
                      <Plus size={11} weight="regular" className="text-current" />
                      Add photo
                      <input type="file" accept="image/*" onChange={handleClaimPhotoAdd} className="hidden" />
                    </label>
                  )}
                </div>

                {/* Error */}
                {claimError && (
                  <p className="text-[11px] font-medium text-red-500">
                    <SafeText fallback="Something went wrong. Please try again or email us.">{claimError}</SafeText>
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => { setClaimOpen(false); resetClaimForm(); }}
                    className="flex-1 py-2.5 rounded-xl border text-[12px] font-semibold transition-colors"
                    style={{ borderColor: theme === "dark" ? "#444" : "#E7E5E4", color: theme === "dark" ? "#999" : "#555" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={claimSubmitting || !claimItems.some((it) => it.name.trim())}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
                  >
                    {claimSubmitting ? (
                      <>
                        <CircleNotch size={13} className="animate-spin text-current" />
                        Submitting…
                      </>
                    ) : "Submit claim"}
                  </button>
                </div>

                <p className="text-[10px] text-center leading-relaxed" style={{ color: theme === "dark" ? "#666" : "#AAA" }}>
                  Claims must be submitted within 48 hours of move completion.
                  Photos help us process your claim faster.
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Claim Status Modal ── */}
      {claimStatusOpen && existingClaim && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex min-h-0 items-center justify-center p-4 sm:p-5 z-[99990]"
          onClick={(e) => { if (e.target === e.currentTarget) setClaimStatusOpen(false); }}
        >
          <div
            className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[400px] shadow-2xl overflow-hidden"
            style={{ backgroundColor: theme === "dark" ? "#1A1A1A" : "#FFFFFF", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div
              className="px-6 pt-6 pb-4 border-b flex items-center justify-between"
              style={{ borderColor: theme === "dark" ? "#333" : "#E7E5E4" }}
            >
              <div>
                <h3 className="text-[16px] font-bold" style={{ color: theme === "dark" ? "#F5F5F3" : FOREST }}>
                  Claim Status
                </h3>
                <p className="text-[11px] mt-0.5 font-mono font-semibold" style={{ color: GOLD }}>
                  {existingClaim.claim_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClaimStatusOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: theme === "dark" ? "#333" : "#F5F5F3", color: theme === "dark" ? "#999" : "#666" }}
              >
              <X size={12} weight="regular" className="text-current" />
            </button>
          </div>

          <div className="px-6 py-6">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: claimStatusColor(existingClaim.status).bg }}
                >
                  {existingClaim.status === "resolved" || existingClaim.status === "settled" || existingClaim.status === "approved" ? (
                    <Check size={18} color={claimStatusColor(existingClaim.status).fg} weight="bold" />
                  ) : existingClaim.status === "denied" ? (
                    <X size={18} weight="regular" color={claimStatusColor(existingClaim.status).fg} />
                  ) : (
                    <Clock size={18} color={claimStatusColor(existingClaim.status).fg} />
                  )}
                </div>
                <div>
                  <div className="text-[13px] font-bold" style={{ color: theme === "dark" ? "#F5F5F3" : FOREST }}>
                    {claimStatusLabel(existingClaim.status)}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: theme === "dark" ? "#888" : "#999" }}>
                    {claimStatusDescription(existingClaim.status)}
                  </div>
                </div>
              </div>

              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: theme === "dark" ? "#222" : "#FAF7F2" }}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: GOLD }}>
                  What happens next
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: theme === "dark" ? "#AAA" : "#666" }}>
                  {existingClaim.status === "resolved" || existingClaim.status === "settled" || existingClaim.status === "approved"
                    ? "Your claim has been resolved. If you have any questions, please contact us."
                    : existingClaim.status === "denied"
                    ? "Your claim was reviewed and could not be approved. Contact us if you have questions."
                    : "Our team is reviewing your claim. You'll receive an email update once a decision is made, typically within 3 business days."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setClaimStatusOpen(false)}
                className="w-full mt-5 py-2.5 rounded-xl text-[12px] font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: GOLD, color: CREAM }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function claimStatusColor(status: string) {
  switch (status) {
    case "resolved": case "settled": case "approved": return { bg: "#22C55E18", fg: "#22C55E" };
    case "denied": return { bg: "#EF444418", fg: "#EF4444" };
    case "in_review": case "investigating": case "under_review": return { bg: `${GOLD}18`, fg: GOLD };
    default: return { bg: `${GOLD}12`, fg: GOLD };
  }
}

function claimStatusLabel(status: string) {
  switch (status) {
    case "submitted": return "Claim Submitted";
    case "in_review": case "under_review": return "Under Review";
    case "investigating": return "Being Investigated";
    case "approved": return "Approved";
    case "partially_approved": return "Partially Approved";
    case "resolved": case "settled": return "Resolved";
    case "denied": return "Denied";
    default: return "In Progress";
  }
}

function claimStatusDescription(status: string) {
  switch (status) {
    case "submitted": return "Your claim has been received and is awaiting review.";
    case "in_review": case "under_review": return "Our team is currently reviewing your claim.";
    case "investigating": return "We're investigating the details of your claim.";
    case "approved": return "Your claim has been approved.";
    case "partially_approved": return "Your claim has been partially approved.";
    case "resolved": case "settled": return "Your claim has been resolved.";
    case "denied": return "Your claim was not approved after review.";
    default: return "Your claim is being processed.";
  }
}
