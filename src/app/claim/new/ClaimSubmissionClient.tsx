"use client";

import { useState, useCallback } from "react";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { Check } from "@phosphor-icons/react";

const VALUATION_INFO: Record<string, { label: string; desc: string }> = {
  released: {
    label: "Released Value Protection",
    desc: "Coverage: $0.60/lb per item. Included with Curated package.",
  },
  enhanced: {
    label: "Enhanced Value Protection",
    desc: "Coverage: $5.00/lb per item, max $2,500/item. Included with Signature package.",
  },
  full_replacement: {
    label: "Full Replacement Value Protection",
    desc: "Full current replacement value. Items over $5,000 must have been declared separately.",
  },
};

interface ClaimedItem {
  id: string;
  name: string;
  description: string;
  damage_description: string;
  declared_value: number;
  weight_lbs: number;
  photo_urls: string[];
}

interface MoveInfo {
  id: string;
  move_code: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  valuation_tier: string;
  was_upgraded: boolean;
}

function newItem(): ClaimedItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    damage_description: "",
    declared_value: 0,
    weight_lbs: 0,
    photo_urls: [],
  };
}

export default function ClaimSubmissionClient() {
  const [step, setStep] = useState(0);
  const [lookupValue, setLookupValue] = useState("");
  const [lookupType, setLookupType] = useState<"code" | "email">("code");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [moveInfo, setMoveInfo] = useState<MoveInfo | null>(null);
  const [items, setItems] = useState<ClaimedItem[]>([newItem()]);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const phoneInput = usePhoneInput(clientPhone, setClientPhone);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [claimNumber, setClaimNumber] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const handleLookup = useCallback(async () => {
    if (!lookupValue.trim()) return;
    setLookupLoading(true);
    setLookupError("");
    try {
      const params = new URLSearchParams();
      if (lookupType === "code") params.set("code", lookupValue.trim().toUpperCase());
      else params.set("email", lookupValue.trim().toLowerCase());

      const res = await fetch(`/api/claims/lookup?${params}`);
      const data = await res.json();
      if (data.error) {
        setLookupError(data.error);
      } else if (data.move) {
        setMoveInfo(data.move);
        setClientName(data.move.client_name || "");
        setClientEmail(data.move.client_email || "");
        setClientPhone(data.move.client_phone ? formatPhone(data.move.client_phone) : "");
        setStep(1);
      }
    } catch {
      setLookupError("Something went wrong. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  }, [lookupValue, lookupType]);

  const updateItem = useCallback((id: string, field: keyof ClaimedItem, value: string | number | string[]) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, newItem()]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }, []);

  const handlePhotoUpload = useCallback(
    async (itemId: string, files: FileList | null) => {
      if (!files) return;
      setUploading((prev) => ({ ...prev, [itemId]: true }));
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("claimId", "temp");
        formData.append("photoType", "damage");
        formData.append("uploadedBy", "client");
        const objectUrl = URL.createObjectURL(file);
        urls.push(objectUrl);
      }
      updateItem(itemId, "photo_urls", [
        ...(items.find((i) => i.id === itemId)?.photo_urls || []),
        ...urls,
      ]);
      setUploading((prev) => ({ ...prev, [itemId]: false }));
    },
    [items, updateItem]
  );

  const totalClaimed = items.reduce((s, i) => s + (i.declared_value || 0), 0);

  const handleSubmit = useCallback(async () => {
    if (!confirmed || !moveInfo) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/claims/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveId: moveInfo.id,
          clientName,
          clientEmail,
          clientPhone: clientPhone.trim() ? normalizePhone(clientPhone) : "",
          valuationTier: moveInfo.valuation_tier || "released",
          wasUpgraded: moveInfo.was_upgraded || false,
          items: items.map((i) => ({
            name: i.name,
            description: i.description,
            damage_description: i.damage_description,
            declared_value: i.declared_value,
            weight_lbs: i.weight_lbs,
            photo_urls: i.photo_urls,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setClaimNumber(data.claimNumber);
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  }, [confirmed, moveInfo, clientName, clientEmail, clientPhone, items]);

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#f0fdf4" }}>
          <Check weight="bold" size={32} color="#16a34a" aria-hidden />
        </div>
        <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-2">Claim Submitted</h2>
        <p className="text-[var(--text-base)] text-[#555] leading-relaxed mb-4">
          Your claim <strong>{claimNumber}</strong> has been submitted. We&rsquo;ll review it within 3 business days and contact you with next steps.
        </p>
        <div className="rounded-xl p-4 inline-block" style={{ backgroundColor: "#FAF7F2" }}>
          <p className="text-[13px] text-[#888]">Reference: <strong>{claimNumber}</strong></p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {["Identify Move", "Damaged Items", "Contact Info", "Review"].map((label, idx) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all"
              style={{
                backgroundColor: idx <= step ? "#722F37" : "#e8e0d8",
                color: idx <= step ? "#fff" : "#888",
              }}
            >
              {idx + 1}
            </div>
            {idx < 3 && <div className="w-8 h-px" style={{ backgroundColor: idx < step ? "#722F37" : "#e8e0d8" }} />}
          </div>
        ))}
      </div>

      {/* Step 0: Identify Move */}
      {step === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-4">Identify Your Move</h2>
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setLookupType("code")}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold border-2 transition-all"
              style={{
                borderColor: lookupType === "code" ? "#722F37" : "#e8e0d8",
                backgroundColor: lookupType === "code" ? "#722F3710" : "transparent",
                color: lookupType === "code" ? "#722F37" : "#555",
              }}
            >
              Move ID / Reference
            </button>
            <button
              onClick={() => setLookupType("email")}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold border-2 transition-all"
              style={{
                borderColor: lookupType === "email" ? "#722F37" : "#e8e0d8",
                backgroundColor: lookupType === "email" ? "#722F3710" : "transparent",
                color: lookupType === "email" ? "#722F37" : "#555",
              }}
            >
              Email Address
            </button>
          </div>
          <input
            type={lookupType === "email" ? "email" : "text"}
            value={lookupValue}
            onChange={(e) => setLookupValue(e.target.value)}
            placeholder={lookupType === "code" ? "MV-0034 or MV0034" : "your@email.com"}
            className="w-full px-4 py-3 rounded-xl border-2 text-[15px] outline-none mb-4 bg-white"
            style={{ borderColor: "#e8e0d8", color: "#1a1a1a" }}
            onFocus={(e) => (e.target.style.borderColor = "#722F37")}
            onBlur={(e) => (e.target.style.borderColor = "#e8e0d8")}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          />
          {lookupError && (
            <p className="text-[13px] text-red-600 mb-3">{lookupError}</p>
          )}
          <button
            onClick={handleLookup}
            disabled={lookupLoading || !lookupValue.trim()}
            className="w-full py-3 rounded-xl text-[var(--text-base)] font-bold text-white transition-all disabled:opacity-40"
            style={{ backgroundColor: "#722F37" }}
          >
            {lookupLoading ? "Looking up..." : "Find My Move"}
          </button>
        </div>
      )}

      {/* Step 1: Damaged Items */}
      {step === 1 && moveInfo && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[var(--text-base)] font-bold text-[#1a1a1a]">Move: {moveInfo.move_code}</h3>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: "#722F3715", color: "#722F37" }}>
                {VALUATION_INFO[moveInfo.valuation_tier]?.label || moveInfo.valuation_tier}
              </span>
            </div>
            <p className="text-[13px] text-[#888]">
              {VALUATION_INFO[moveInfo.valuation_tier]?.desc || "Standard coverage applies."}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-4">What Was Damaged?</h2>
            {items.map((item, idx) => (
              <div key={item.id} className="mb-6 pb-6 border-b border-[#f0ebe5] last:border-0 last:mb-0 last:pb-0">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[var(--text-base)] font-bold text-[#555]">Item {idx + 1}</h4>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} className="text-[12px] text-red-500 font-medium hover:underline">
                      Remove
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#666] mb-1 uppercase tracking-wide">Item Name</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      placeholder="e.g. Dining table"
                      className="w-full px-3.5 py-2.5 rounded-xl border-2 text-[var(--text-base)] outline-none bg-white"
                      style={{ borderColor: "#e8e0d8" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#666] mb-1 uppercase tracking-wide">Description</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="e.g. Solid oak, 6-seater"
                      className="w-full px-3.5 py-2.5 rounded-xl border-2 text-[var(--text-base)] outline-none bg-white"
                      style={{ borderColor: "#e8e0d8" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#666] mb-1 uppercase tracking-wide">What Happened</label>
                    <textarea
                      value={item.damage_description}
                      onChange={(e) => updateItem(item.id, "damage_description", e.target.value)}
                      placeholder="Describe the damage..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl border-2 text-[var(--text-base)] outline-none bg-white resize-none"
                      style={{ borderColor: "#e8e0d8" }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#666] mb-1 uppercase tracking-wide">Estimated Value ($)</label>
                      <input
                        type="number"
                        value={item.declared_value || ""}
                        onChange={(e) => updateItem(item.id, "declared_value", parseFloat(e.target.value) || 0)}
                        placeholder="2500"
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 text-[var(--text-base)] outline-none bg-white"
                        style={{ borderColor: "#e8e0d8" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#666] mb-1 uppercase tracking-wide">Weight (lbs)</label>
                      <input
                        type="number"
                        value={item.weight_lbs || ""}
                        onChange={(e) => updateItem(item.id, "weight_lbs", parseFloat(e.target.value) || 0)}
                        placeholder="80"
                        className="w-full px-3.5 py-2.5 rounded-xl border-2 text-[var(--text-base)] outline-none bg-white"
                        style={{ borderColor: "#e8e0d8" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#666] mb-1 uppercase tracking-wide">
                      Photos (up to 5)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handlePhotoUpload(item.id, e.target.files)}
                      className="w-full text-[13px] text-[#555]"
                    />
                    {uploading[item.id] && <p className="text-[12px] text-[#888] mt-1">Uploading...</p>}
                    {item.photo_urls.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {item.photo_urls.map((url, pi) => (
                          <div key={pi} className="w-16 h-16 rounded-lg bg-[#f5f0ea] overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`Photo ${pi + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addItem}
              className="w-full py-2.5 rounded-xl border-2 border-dashed text-[13px] font-semibold transition-colors"
              style={{ borderColor: "#d4ccc2", color: "#888" }}
            >
              + Add Another Item
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(0)}
              className="px-6 py-3 rounded-xl text-[var(--text-base)] font-semibold border-2"
              style={{ borderColor: "#e8e0d8", color: "#555" }}
            >
              Back
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={items.every((i) => !i.name.trim())}
              className="flex-1 py-3 rounded-xl text-[var(--text-base)] font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: "#722F37" }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Contact Info */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-4">Confirm Your Info</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#666] mb-1 uppercase tracking-wide">Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 text-[var(--text-base)] outline-none bg-white"
                style={{ borderColor: "#e8e0d8" }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#666] mb-1 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 text-[var(--text-base)] outline-none bg-white"
                style={{ borderColor: "#e8e0d8" }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#666] mb-1 uppercase tracking-wide">Phone</label>
              <input
                ref={phoneInput.ref}
                type="tel"
                value={clientPhone}
                onChange={phoneInput.onChange}
                placeholder={PHONE_PLACEHOLDER}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 text-[var(--text-base)] outline-none bg-white"
                style={{ borderColor: "#e8e0d8" }}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-xl text-[var(--text-base)] font-semibold border-2"
              style={{ borderColor: "#e8e0d8", color: "#555" }}
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!clientName.trim() || !clientEmail.trim()}
              className="flex-1 py-3 rounded-xl text-[var(--text-base)] font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: "#722F37" }}
            >
              Review Claim
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && moveInfo && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-4">Review Your Claim</h2>
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "#FAF7F2" }}>
              <p className="text-[13px] text-[#888]">Move: <strong>{moveInfo.move_code}</strong></p>
              <p className="text-[13px] text-[#888]">Claimant: <strong>{clientName}</strong> ({clientEmail})</p>
              <p className="text-[13px] text-[#888]">Valuation: <strong>{VALUATION_INFO[moveInfo.valuation_tier]?.label || moveInfo.valuation_tier}</strong></p>
            </div>

            <h3 className="text-[var(--text-base)] font-bold text-[#555] mb-3">Items ({items.filter((i) => i.name.trim()).length})</h3>
            {items.filter((i) => i.name.trim()).map((item, idx) => (
              <div key={item.id} className="rounded-xl p-4 mb-3 border" style={{ borderColor: "#e8e0d8" }}>
                <p className="text-[var(--text-base)] font-bold text-[#1a1a1a]">{idx + 1}. {item.name}</p>
                {item.description && <p className="text-[13px] text-[#888]">{item.description}</p>}
                <p className="text-[13px] text-[#555] mt-1">{item.damage_description}</p>
                <div className="flex gap-4 mt-2 text-[12px] text-[#888]">
                  <span>Value: ${item.declared_value.toLocaleString()}</span>
                  {item.weight_lbs > 0 && <span>Weight: {item.weight_lbs} lbs</span>}
                  {item.photo_urls.length > 0 && <span>{item.photo_urls.length} photo(s)</span>}
                </div>
              </div>
            ))}

            <div className="rounded-xl p-4 mt-4" style={{ backgroundColor: "#722F3710" }}>
              <p className="text-[var(--text-base)] font-bold" style={{ color: "#722F37" }}>
                Total Claimed: ${totalClaimed.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4.5 h-4.5 rounded accent-[#722F37]"
              />
              <span className="text-[13px] text-[#555] leading-relaxed">
                By submitting this claim, I confirm the information is accurate and the damage occurred during my Yugo move.
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 rounded-xl text-[var(--text-base)] font-semibold border-2"
              style={{ borderColor: "#e8e0d8", color: "#555" }}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!confirmed || submitting}
              className="flex-1 py-3 rounded-xl text-[var(--text-base)] font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: "#722F37" }}
            >
              {submitting ? "Submitting..." : "Submit Claim"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
