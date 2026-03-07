"use client";

import { useState, useRef, useEffect } from "react";
import { FOREST, GOLD } from "@/lib/client-theme";

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

export default function ClientSettingsMenu({ moveId }: { moveId: string }) {
  const [open, setOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimStatusOpen, setClaimStatusOpen] = useState(false);
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [settings, setSettingsState] = useState<ClientSettings>({});
  const ref = useRef<HTMLDivElement>(null);

  const [claimDesc, setClaimDesc] = useState("");
  const [claimDate, setClaimDate] = useState("");
  const [claimPhotos, setClaimPhotos] = useState<File[]>([]);
  const [claimSubmitted, setClaimSubmitted] = useState(false);

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

  const handleClaimPhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setClaimPhotos((prev) => [...prev, ...Array.from(files)].slice(0, 5));
    e.target.value = "";
  };

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClaimSubmitted(true);
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme === "dark" ? "#888" : "#999"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span className="text-[11px] font-medium" style={{ color: theme === "dark" ? "#999" : "#888" }}>
                  Submit a claim
                </span>
              </button>

              {/* View claim status — only when a claim exists */}
              {existingClaim && (
                <>
                  <button
                    onClick={() => { setOpen(false); setClaimStatusOpen(true); }}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme === "dark" ? "#222" : "#F8F7F4")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="text-[11px] font-semibold" style={{ color: GOLD }}>
                      View claim status
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Claim Submission Modal */}
      {claimOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto"
          style={{ minHeight: "100dvh" }}
          onClick={(e) => { if (e.target === e.currentTarget) setClaimOpen(false); }}
        >
          <div
            className="rounded-2xl w-full max-w-[440px] shadow-2xl overflow-hidden my-auto"
            style={{ backgroundColor: theme === "dark" ? "#1A1A1A" : "#FFFFFF" }}
          >
            {/* Header */}
            <div
              className="px-6 pt-6 pb-4 border-b"
              style={{ borderColor: theme === "dark" ? "#333" : "#E7E5E4" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-bold" style={{ color: theme === "dark" ? "#F5F5F3" : FOREST }}>
                    Submit a Claim
                  </h3>
                  <p className="text-[11px] mt-1" style={{ color: theme === "dark" ? "#888" : "#999" }}>
                    Report any damages or issues from your move
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setClaimOpen(false); setClaimSubmitted(false); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: theme === "dark" ? "#333" : "#F5F5F3",
                    color: theme === "dark" ? "#999" : "#666",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {claimSubmitted ? (
              <div className="px-6 py-10 text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: `${GOLD}18` }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h4 className="text-[15px] font-bold mb-2" style={{ color: theme === "dark" ? "#F5F5F3" : FOREST }}>
                  Claim Submitted
                </h4>
                <p className="text-[12px] max-w-[280px] mx-auto leading-relaxed" style={{ color: theme === "dark" ? "#888" : "#999" }}>
                  We&apos;ve received your claim. Our team will review it and contact you within 48 hours.
                </p>
                <button
                  type="button"
                  onClick={() => { setClaimOpen(false); setClaimSubmitted(false); setClaimDesc(""); setClaimDate(""); setClaimPhotos([]); }}
                  className="mt-6 px-6 py-2.5 rounded-xl text-[12px] font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleClaimSubmit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>
                    What happened? *
                  </label>
                  <textarea
                    value={claimDesc}
                    onChange={(e) => setClaimDesc(e.target.value)}
                    placeholder="Describe the damage or issue in detail..."
                    rows={3}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border text-[13px] focus:outline-none transition-colors resize-none"
                    style={{
                      borderColor: theme === "dark" ? "#444" : "#E7E5E4",
                      backgroundColor: theme === "dark" ? "#222" : "#FAFAF8",
                      color: theme === "dark" ? "#E8E5E0" : "#1A1A1A",
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>
                    When did it happen?
                  </label>
                  <input
                    type="date"
                    value={claimDate}
                    onChange={(e) => setClaimDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border text-[13px] focus:outline-none transition-colors"
                    style={{
                      borderColor: theme === "dark" ? "#444" : "#E7E5E4",
                      backgroundColor: theme === "dark" ? "#222" : "#FAFAF8",
                      color: theme === "dark" ? "#E8E5E0" : "#1A1A1A",
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>
                    Photos (optional, max 5)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {claimPhotos.map((f, i) => (
                      <div
                        key={i}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border"
                        style={{ borderColor: theme === "dark" ? "#444" : "#E7E5E4" }}
                      >
                        <img
                          src={URL.createObjectURL(f)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setClaimPhotos((p) => p.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                        >
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  {claimPhotos.length < 5 && (
                    <label
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed text-[11px] font-semibold cursor-pointer transition-colors"
                      style={{
                        borderColor: theme === "dark" ? "#555" : "#D4D0C8",
                        color: theme === "dark" ? "#888" : "#888",
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleClaimPhotoAdd}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setClaimOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border text-[12px] font-semibold transition-colors"
                    style={{
                      borderColor: theme === "dark" ? "#444" : "#E7E5E4",
                      color: theme === "dark" ? "#999" : "#555",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!claimDesc.trim()}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-40 transition-all active:scale-[0.98]"
                    style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
                  >
                    Submit Claim
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

      {/* Claim Status Modal */}
      {claimStatusOpen && existingClaim && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
          style={{ minHeight: "100dvh" }}
          onClick={(e) => { if (e.target === e.currentTarget) setClaimStatusOpen(false); }}
        >
          <div
            className="rounded-2xl w-full max-w-[400px] shadow-2xl overflow-hidden"
            style={{ backgroundColor: theme === "dark" ? "#1A1A1A" : "#FFFFFF" }}
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
                style={{
                  backgroundColor: theme === "dark" ? "#333" : "#F5F5F3",
                  color: theme === "dark" ? "#999" : "#666",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: claimStatusColor(existingClaim.status).bg }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={claimStatusColor(existingClaim.status).fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {existingClaim.status === "resolved" || existingClaim.status === "settled" ? (
                      <polyline points="20 6 9 17 4 12" />
                    ) : existingClaim.status === "denied" ? (
                      <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                    ) : (
                      <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>
                    )}
                  </svg>
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
                  {existingClaim.status === "resolved" || existingClaim.status === "settled"
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
                style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
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
    case "resolved": case "settled": return { bg: "#22C55E18", fg: "#22C55E" };
    case "denied": return { bg: "#EF444418", fg: "#EF4444" };
    case "in_review": case "investigating": return { bg: `${GOLD}18`, fg: GOLD };
    default: return { bg: `${GOLD}12`, fg: GOLD };
  }
}

function claimStatusLabel(status: string) {
  switch (status) {
    case "submitted": return "Claim Submitted";
    case "in_review": return "Under Review";
    case "investigating": return "Being Investigated";
    case "resolved": case "settled": return "Resolved";
    case "denied": return "Denied";
    default: return "In Progress";
  }
}

function claimStatusDescription(status: string) {
  switch (status) {
    case "submitted": return "Your claim has been received and is awaiting review.";
    case "in_review": return "Our team is currently reviewing your claim.";
    case "investigating": return "We're investigating the details of your claim.";
    case "resolved": case "settled": return "Your claim has been resolved.";
    case "denied": return "Your claim was not approved after review.";
    default: return "Your claim is being processed.";
  }
}
