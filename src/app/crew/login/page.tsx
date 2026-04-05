"use client";

import { useState, useEffect, useRef, useMemo, type CSSProperties, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import YugoLogo from "@/components/YugoLogo";
import { formatDate } from "@/lib/client-timezone";

const DEVICE_STORAGE_KEY = "yugo-crew-device-id";
const CONSENT_KEY = "yugo-crew-consent-accepted";
const DISPATCH_PHONE = process.env.NEXT_PUBLIC_YUGO_PHONE || "(647) 370-4525";
/** Phone + PIN login API expects exactly this many digits (matches `CREW_PIN_LENGTH` in `@/lib/crew-token`). */
const PHONE_LOGIN_PIN_DIGITS = 6;

/** Dark `#1A1A1A` card: forest green fails WCAG — use cream / off-white tints. */
const CREW_LOGIN_CARD_INK_LABEL = "rgba(255, 255, 255, 0.82)";
const CREW_LOGIN_CARD_INK_BODY = "rgba(255, 255, 255, 0.7)";
const CREW_LOGIN_CARD_INK_SUBTLE = "rgba(255, 255, 255, 0.52)";
const CREW_LOGIN_CARD_LINK = "rgba(255, 250, 245, 0.95)";
const CREW_LOGIN_CARD_PIN_RING = "rgba(255, 255, 255, 0.48)";
const CREW_LOGIN_CARD_DIVIDER = "rgba(255, 255, 255, 0.28)";
const CREW_LOGIN_CARD_CHECKBOX_ACCENT = "#ddd9d3";

const CREW_LOGIN_MAIN_STYLE: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'DM Sans', sans-serif",
  background:
    "radial-gradient(ellipse 120% 85% at 50% -18%, rgba(92, 26, 51, 0.52) 0%, transparent 58%), linear-gradient(180deg, #141016 0%, #0a0909 50%, #050505 100%)",
};

/** Horizontal inset on <main>; width constraint lives on the login panel <section>. */
const CREW_LOGIN_MAIN_EDGE: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0 28px",
};

const CREW_LOGIN_CARD_SHELL: CSSProperties = {
  background: "#1A1A1A",
  border: "1px solid #2A2A2A",
  borderRadius: 0,
  padding: "36px 40px",
  boxShadow: "0 4px 28px rgba(0,0,0,0.4)",
  textAlign: "left",
  width: "100%",
  maxWidth: 460,
};

const CREW_LOGIN_GATE_CARD: CSSProperties = {
  ...CREW_LOGIN_CARD_SHELL,
  textAlign: "center",
};

const CREW_LOGIN_EYEBROW: CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  lineHeight: 1,
  color: "rgba(255,255,255,0.45)",
  marginBottom: 10,
};

/** Uppercase micro-labels above fields (matches quote / portal label rhythm). */
const CREW_LOGIN_FIELD_LABEL: CSSProperties = {
  display: "block",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  lineHeight: 1,
  color: CREW_LOGIN_CARD_INK_LABEL,
  marginBottom: 10,
};

const CREW_LOGIN_PRIMARY_LINK_BTN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  width: "100%",
  boxSizing: "border-box",
  minHeight: 48,
  padding: "14px 16px",
  borderRadius: 0,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  lineHeight: 1,
  textDecoration: "none",
  color: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(44, 62, 45, 0.35)",
  fontFamily: "'DM Sans', sans-serif",
};

/** Full-width row under forest CTA; color from `.crew-login-gate-secondary` in globals (hover contrast). */
const CREW_LOGIN_GATE_SECONDARY: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  boxSizing: "border-box",
  marginTop: 16,
  minHeight: 44,
  padding: "14px 12px",
  background: "none",
  border: "none",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  lineHeight: 1.35,
  cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif",
  textAlign: "center",
};

const CREW_LOGIN_PANEL_H1_PHONE: CSSProperties = {
  fontFamily: "'Instrument Serif', serif",
  fontSize: 24,
  fontWeight: 400,
  color: "#F5F5F3",
  margin: "0 0 6px 0",
  textAlign: "center",
};

const CREW_LOGIN_PANEL_H1_MAIN: CSSProperties = {
  fontFamily: "'Instrument Serif', serif",
  fontSize: 26,
  fontWeight: 400,
  color: "#F5F5F3",
  margin: "0 0 6px 0",
};

const CREW_LOGIN_GATE_H1: CSSProperties = {
  fontFamily: "'Instrument Serif', serif",
  fontSize: 24,
  fontWeight: 400,
  color: "#F5F5F3",
  margin: "0 0 12px 0",
};

type LoginContext = {
  hasDevice: boolean;
  deviceName?: string;
  truckName?: string;
  teamName?: string;
  dateStr?: string;
  crewLead?: { id: string; name: string; initials: string; role: string; pinLength: number };
  teamMembers?: { id: string; name: string; initials: string; role: string; pinLength: number }[];
  noTeamAssigned?: boolean;
  noMembers?: boolean;
};

export default function CrewLoginPage() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [context, setContext] = useState<LoginContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; initials: string; role: string; pinLength: number } | null>(null);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [usePhoneLogin, setUsePhoneLogin] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [phonePin, setPhonePin] = useState("");
  const pinInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const phonePinInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = useMemo(() => searchParams.get("welcome") === "1", [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = localStorage.getItem(DEVICE_STORAGE_KEY);
    setDeviceId(id);
    const accepted = localStorage.getItem(CONSENT_KEY) === "true";
    setConsentAccepted(accepted);
    if (accepted) setConsentChecked(true);
  }, []);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/crew/login-context?deviceId=${encodeURIComponent(deviceId)}`);
        const data = await res.json();
        if (cancelled) return;
        setContext(data);
        if (data.crewLead) {
          setSelectedMember(data.crewLead);
          setPin("");
        }
      } catch {
        if (!cancelled) setContext({ hasDevice: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [deviceId]);

  const handleConsentChange = (checked: boolean) => {
    setConsentChecked(checked);
    if (checked && typeof window !== "undefined") {
      localStorage.setItem(CONSENT_KEY, "true");
      setConsentAccepted(true);
    }
  };

  const handleLogin = async () => {
    if (!selectedMember || submitting) return;
    if (isWelcome && !consentChecked) return;
    const len = selectedMember.pinLength;
    if (pin.length !== len) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/crew/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewMemberId: selectedMember.id,
          pin,
          ...(deviceId ? { deviceId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setPin("");
        setSubmitting(false);
        return;
      }
      router.push("/crew/dashboard");
    } catch {
      setError("Connection error");
      setPin("");
    }
    setSubmitting(false);
  };

  const submitPhoneLogin = async () => {
    if (isWelcome && !consentChecked) return;
    if (submitting) return;
    const digits = phoneDigits.replace(/\D/g, "").slice(0, 10);
    if (digits.length < 10 || phonePin.length !== PHONE_LOGIN_PIN_DIGITS) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/crew/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, pin: phonePin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setPhonePin("");
        setSubmitting(false);
        return;
      }
      router.push("/crew/dashboard");
    } catch {
      setError("Connection error");
      setPhonePin("");
    }
    setSubmitting(false);
  };

  const handleLoginRef = useRef(handleLogin);
  handleLoginRef.current = handleLogin;
  const submitPhoneLoginRef = useRef(submitPhoneLogin);
  submitPhoneLoginRef.current = submitPhoneLogin;

  useEffect(() => {
    if (!selectedMember || submitting) return;
    if (isWelcome && !consentChecked) return;
    const len = selectedMember.pinLength;
    if (pin.length === len) {
      handleLoginRef.current?.();
    }
  }, [pin, selectedMember, submitting, isWelcome, consentChecked]);

  useEffect(() => {
    if (selectedMember && context?.hasDevice && !showMemberPicker && !usePhoneLogin) {
      const t = setTimeout(() => pinInputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [selectedMember, context?.hasDevice, showMemberPicker, usePhoneLogin]);

  useEffect(() => {
    if (!usePhoneLogin || submitting) return;
    if (isWelcome && !consentChecked) return;
    const digits = phoneDigits.replace(/\D/g, "").slice(0, 10);
    if (digits.length === 10 && phonePin.length === PHONE_LOGIN_PIN_DIGITS) {
      submitPhoneLoginRef.current?.();
    }
  }, [phonePin, phoneDigits, usePhoneLogin, submitting, isWelcome, consentChecked]);

  useEffect(() => {
    if (!usePhoneLogin) return;
    const t = setTimeout(() => phoneInputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [usePhoneLogin]);

  const handlePinChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, selectedMember?.pinLength ?? 4);
    setPin(digits);
  };

  const handlePhonePinChange = (val: string) => {
    setPhonePin(val.replace(/\D/g, "").slice(0, PHONE_LOGIN_PIN_DIGITS));
  };

  const openPhoneLogin = () => {
    setUsePhoneLogin(true);
    setShowMemberPicker(false);
    setPhoneDigits("");
    setPhonePin("");
    setPin("");
    setError("");
  };

  const backFromPhoneLogin = () => {
    setUsePhoneLogin(false);
    setPhoneDigits("");
    setPhonePin("");
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && pin.length > 0 && !(e.target as HTMLInputElement).value) {
      setPin((p) => p.slice(0, -1));
    }
  };

  const handlePhonePinKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && phonePin.length > 0 && !(e.target as HTMLInputElement).value) {
      setPhonePin((p) => p.slice(0, -1));
    }
  };

  if (loading) {
    return (
      <main className="crew-login-gate" style={{ ...CREW_LOGIN_MAIN_STYLE, ...CREW_LOGIN_MAIN_EDGE }}>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Loading...</span>
      </main>
    );
  }

  if (!deviceId) {
    return (
      <main className="crew-login-gate" style={{ ...CREW_LOGIN_MAIN_STYLE, ...CREW_LOGIN_MAIN_EDGE }}>
          {usePhoneLogin ? (
            <section className="crew-login-panel" style={CREW_LOGIN_CARD_SHELL} aria-labelledby="crew-login-panel-title">
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <YugoLogo size={22} variant="cream" />
              </div>
              <h1 id="crew-login-panel-title" style={CREW_LOGIN_PANEL_H1_PHONE}>
                Crew Portal
              </h1>
              <div style={{ fontSize: 14, color: CREW_LOGIN_CARD_INK_BODY, marginBottom: 20, textAlign: "center" }}>Phone & PIN</div>
              <CrewPhoneLoginFields
                phoneDigits={phoneDigits}
                onPhoneDigitsChange={(d) => {
                  setPhoneDigits(d);
                  if (d.length === 10) {
                    setTimeout(() => phonePinInputRef.current?.focus(), 50);
                  }
                }}
                phonePin={phonePin}
                onPhonePinChange={handlePhonePinChange}
                phoneInputRef={phoneInputRef}
                phonePinInputRef={phonePinInputRef}
                onPhonePinKeyDown={handlePhonePinKeyDown}
                submitting={submitting}
                onBack={backFromPhoneLogin}
                backLabel="Back"
              />
              {error && (
                <div
                  style={{
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    color: "#F87171",
                    fontSize: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    marginTop: 16,
                  }}
                >
                  {error}
                </div>
              )}
              {isWelcome && !consentAccepted && (
                <div style={{ marginTop: 20, padding: "14px 16px", background: "rgba(92,26,51,0.08)", borderRadius: 10, border: "1px solid rgba(92,26,51,0.22)" }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => handleConsentChange(e.target.checked)}
                      style={{ marginTop: 2, width: 15, height: 15, accentColor: CREW_LOGIN_CARD_CHECKBOX_ACCENT, flexShrink: 0, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 11, color: CREW_LOGIN_CARD_INK_BODY, lineHeight: 1.6 }}>
                      I agree to Yugo&apos;s{" "}
                      <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: CREW_LOGIN_CARD_LINK, textDecoration: "underline" }}>Privacy Policy</a> and{" "}
                      <a href="/legal/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ color: CREW_LOGIN_CARD_LINK, textDecoration: "underline" }}>Terms of Use</a>
                    </span>
                  </label>
                </div>
              )}
              <div style={{ fontSize: 12, color: CREW_LOGIN_CARD_INK_SUBTLE, textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
                Dispatch:{" "}
                <a className="crew-login-link" href={`tel:${normalizePhone(DISPATCH_PHONE)}`} style={{ color: CREW_LOGIN_CARD_LINK, fontWeight: 600, textDecoration: "none" }}>
                  {formatPhone(DISPATCH_PHONE)}
                </a>
              </div>
            </section>
          ) : (
            <section className="crew-login-panel" style={CREW_LOGIN_GATE_CARD} aria-labelledby="crew-login-gate-title">
              <div style={{ marginBottom: 20 }}>
                <YugoLogo size={22} variant="cream" />
              </div>
              <div style={CREW_LOGIN_EYEBROW}>Device setup</div>
              <h1 id="crew-login-gate-title" style={CREW_LOGIN_GATE_H1}>
                Device Not Registered
              </h1>
              <div style={{ fontSize: 14, color: CREW_LOGIN_CARD_INK_BODY, marginBottom: 24, lineHeight: 1.55 }}>
                Set up this iPad first to link it to your truck and team.
              </div>
              <a href="/crew/setup" className="crew-premium-cta" style={CREW_LOGIN_PRIMARY_LINK_BTN}>
                Go to setup
                <CaretRight size={12} weight="bold" style={{ flexShrink: 0, opacity: 0.9 }} aria-hidden />
              </a>
              <button
                type="button"
                onClick={openPhoneLogin}
                className="crew-login-link crew-login-gate-secondary"
                style={CREW_LOGIN_GATE_SECONDARY}
              >
                Log in with phone & PIN
              </button>
            </section>
          )}
      </main>
    );
  }

  if (!context?.hasDevice) {
    return (
      <main className="crew-login-gate" style={{ ...CREW_LOGIN_MAIN_STYLE, ...CREW_LOGIN_MAIN_EDGE }}>
          {usePhoneLogin ? (
            <section className="crew-login-panel" style={CREW_LOGIN_CARD_SHELL} aria-labelledby="crew-login-panel-title">
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <YugoLogo size={22} variant="cream" />
              </div>
              <h1 id="crew-login-panel-title" style={CREW_LOGIN_PANEL_H1_PHONE}>
                Crew Portal
              </h1>
              <div style={{ fontSize: 14, color: CREW_LOGIN_CARD_INK_BODY, marginBottom: 20, textAlign: "center" }}>Phone & PIN</div>
              <CrewPhoneLoginFields
                phoneDigits={phoneDigits}
                onPhoneDigitsChange={(d) => {
                  setPhoneDigits(d);
                  if (d.length === 10) {
                    setTimeout(() => phonePinInputRef.current?.focus(), 50);
                  }
                }}
                phonePin={phonePin}
                onPhonePinChange={handlePhonePinChange}
                phoneInputRef={phoneInputRef}
                phonePinInputRef={phonePinInputRef}
                onPhonePinKeyDown={handlePhonePinKeyDown}
                submitting={submitting}
                onBack={backFromPhoneLogin}
                backLabel="Back"
              />
              {error && (
                <div
                  style={{
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    color: "#F87171",
                    fontSize: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    marginTop: 16,
                  }}
                >
                  {error}
                </div>
              )}
              {isWelcome && !consentAccepted && (
                <div style={{ marginTop: 20, padding: "14px 16px", background: "rgba(92,26,51,0.08)", borderRadius: 10, border: "1px solid rgba(92,26,51,0.22)" }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => handleConsentChange(e.target.checked)}
                      style={{ marginTop: 2, width: 15, height: 15, accentColor: CREW_LOGIN_CARD_CHECKBOX_ACCENT, flexShrink: 0, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 11, color: CREW_LOGIN_CARD_INK_BODY, lineHeight: 1.6 }}>
                      I agree to Yugo&apos;s{" "}
                      <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: CREW_LOGIN_CARD_LINK, textDecoration: "underline" }}>Privacy Policy</a> and{" "}
                      <a href="/legal/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ color: CREW_LOGIN_CARD_LINK, textDecoration: "underline" }}>Terms of Use</a>
                    </span>
                  </label>
                </div>
              )}
              <div style={{ fontSize: 12, color: CREW_LOGIN_CARD_INK_SUBTLE, textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
                Dispatch:{" "}
                <a className="crew-login-link" href={`tel:${normalizePhone(DISPATCH_PHONE)}`} style={{ color: CREW_LOGIN_CARD_LINK, fontWeight: 600, textDecoration: "none" }}>
                  {formatPhone(DISPATCH_PHONE)}
                </a>
              </div>
            </section>
          ) : (
            <section className="crew-login-panel" style={CREW_LOGIN_GATE_CARD} aria-labelledby="crew-login-gate-title">
              <div style={{ marginBottom: 20 }}>
                <YugoLogo size={22} variant="cream" />
              </div>
              <div style={CREW_LOGIN_EYEBROW}>Device</div>
              <h1 id="crew-login-gate-title" style={CREW_LOGIN_GATE_H1}>
                Device Not Found
              </h1>
              <div style={{ fontSize: 14, color: CREW_LOGIN_CARD_INK_BODY, marginBottom: 24, lineHeight: 1.55 }}>
                This device may need to be re-registered. Contact dispatch or set up again.
              </div>
              <a href="/crew/setup" className="crew-premium-cta" style={CREW_LOGIN_PRIMARY_LINK_BTN}>
                Re-register device
                <CaretRight size={12} weight="bold" style={{ flexShrink: 0, opacity: 0.9 }} aria-hidden />
              </a>
              <button
                type="button"
                onClick={openPhoneLogin}
                className="crew-login-link crew-login-gate-secondary"
                style={CREW_LOGIN_GATE_SECONDARY}
              >
                Log in with phone & PIN
              </button>
            </section>
          )}
      </main>
    );
  }

  if (context.noTeamAssigned || context.noMembers) {
    return (
      <main className="crew-login-gate" style={{ ...CREW_LOGIN_MAIN_STYLE, ...CREW_LOGIN_MAIN_EDGE }}>
          {usePhoneLogin ? (
            <section className="crew-login-panel" style={CREW_LOGIN_CARD_SHELL} aria-labelledby="crew-login-panel-title">
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <YugoLogo size={22} variant="cream" />
              </div>
              <h1 id="crew-login-panel-title" style={CREW_LOGIN_PANEL_H1_PHONE}>
                Crew Portal
              </h1>
              <div style={{ fontSize: 14, color: CREW_LOGIN_CARD_INK_BODY, marginBottom: 20, textAlign: "center" }}>Phone & PIN</div>
              <CrewPhoneLoginFields
                phoneDigits={phoneDigits}
                onPhoneDigitsChange={(d) => {
                  setPhoneDigits(d);
                  if (d.length === 10) {
                    setTimeout(() => phonePinInputRef.current?.focus(), 50);
                  }
                }}
                phonePin={phonePin}
                onPhonePinChange={handlePhonePinChange}
                phoneInputRef={phoneInputRef}
                phonePinInputRef={phonePinInputRef}
                onPhonePinKeyDown={handlePhonePinKeyDown}
                submitting={submitting}
                onBack={backFromPhoneLogin}
                backLabel="Back"
              />
              {error && (
                <div
                  style={{
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    color: "#F87171",
                    fontSize: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    marginTop: 16,
                  }}
                >
                  {error}
                </div>
              )}
              {isWelcome && !consentAccepted && (
                <div style={{ marginTop: 20, padding: "14px 16px", background: "rgba(92,26,51,0.08)", borderRadius: 10, border: "1px solid rgba(92,26,51,0.22)" }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => handleConsentChange(e.target.checked)}
                      style={{ marginTop: 2, width: 15, height: 15, accentColor: CREW_LOGIN_CARD_CHECKBOX_ACCENT, flexShrink: 0, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 11, color: CREW_LOGIN_CARD_INK_BODY, lineHeight: 1.6 }}>
                      I agree to Yugo&apos;s{" "}
                      <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: CREW_LOGIN_CARD_LINK, textDecoration: "underline" }}>Privacy Policy</a> and{" "}
                      <a href="/legal/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ color: CREW_LOGIN_CARD_LINK, textDecoration: "underline" }}>Terms of Use</a>
                    </span>
                  </label>
                </div>
              )}
              <div style={{ fontSize: 12, color: CREW_LOGIN_CARD_INK_SUBTLE, textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
                Dispatch:{" "}
                <a className="crew-login-link" href={`tel:${normalizePhone(DISPATCH_PHONE)}`} style={{ color: CREW_LOGIN_CARD_LINK, fontWeight: 600, textDecoration: "none" }}>
                  {formatPhone(DISPATCH_PHONE)}
                </a>
              </div>
            </section>
          ) : (
            <section className="crew-login-panel" style={CREW_LOGIN_GATE_CARD} aria-labelledby="crew-login-gate-title">
              <div style={{ marginBottom: 20 }}>
                <YugoLogo size={22} variant="cream" />
              </div>
              <div style={CREW_LOGIN_EYEBROW}>Schedule</div>
              <h1 id="crew-login-gate-title" style={CREW_LOGIN_GATE_H1}>
                No Team Assigned
              </h1>
              <div style={{ fontSize: 14, color: CREW_LOGIN_CARD_INK_BODY, marginBottom: 24, lineHeight: 1.55 }}>
                {context.noTeamAssigned
                  ? "No team is assigned to this truck today. Contact dispatch to get scheduled."
                  : "No crew members found for this team. Contact dispatch."}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", marginBottom: 4 }}>
                Dispatch:{" "}
                <a
                  href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
                  className="crew-login-link"
                  style={{ color: "rgba(255,255,255,0.78)", fontWeight: 600, textDecoration: "none" }}
                >
                  {formatPhone(DISPATCH_PHONE)}
                </a>
              </div>
              <button
                type="button"
                onClick={openPhoneLogin}
                className="crew-login-link crew-login-gate-secondary"
                style={CREW_LOGIN_GATE_SECONDARY}
              >
                Log in with phone & PIN
              </button>
            </section>
          )}
      </main>
    );
  }

  const pinLength = selectedMember?.pinLength ?? 4;
  const dateStr =
    context.dateStr || formatDate(new Date(), { weekday: "long", month: "short", day: "numeric" });

  return (
    <main
      className="crew-login-gate"
      style={{
        ...CREW_LOGIN_MAIN_STYLE,
        ...CREW_LOGIN_MAIN_EDGE,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes loginFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .crew-login-input:focus { border-bottom-color: rgba(92,26,51,0.55) !important; outline: none; box-shadow: none !important; }
      `}</style>

      <section
        className="crew-login-panel"
        style={{
          ...CREW_LOGIN_CARD_SHELL,
          position: "relative",
          zIndex: 1,
          animation: "loginFadeIn 0.6s ease",
        }}
        aria-labelledby="crew-login-panel-title"
      >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <YugoLogo size={22} variant="cream" />
          </div>

          <h1 id="crew-login-panel-title" style={CREW_LOGIN_PANEL_H1_MAIN}>
            Crew Portal
          </h1>
          <div style={{ fontSize: 14, color: CREW_LOGIN_CARD_INK_BODY, marginBottom: 24 }}>
            {usePhoneLogin ? "Your number on file · 6-digit PIN" : `${context.truckName} · ${dateStr}`}
          </div>

          <div
            style={{
              width: 48,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${CREW_LOGIN_CARD_DIVIDER}, transparent)`,
              margin: "0 auto 28px",
            }}
          />

          {usePhoneLogin ? (
            <CrewPhoneLoginFields
              phoneDigits={phoneDigits}
              onPhoneDigitsChange={(d) => {
                setPhoneDigits(d);
                if (d.length === 10) {
                  setTimeout(() => phonePinInputRef.current?.focus(), 50);
                }
              }}
              phonePin={phonePin}
              onPhonePinChange={handlePhonePinChange}
              phoneInputRef={phoneInputRef}
              phonePinInputRef={phonePinInputRef}
              onPhonePinKeyDown={handlePhonePinKeyDown}
              submitting={submitting}
              onBack={backFromPhoneLogin}
              backLabel="Back to tablet login"
            />
          ) : (
            <>
              {!showMemberPicker ? (
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, rgba(92,26,51,0.35), rgba(92,26,51,0.08))",
                      border: "2px solid rgba(92,26,51,0.45)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 12px",
                      fontSize: 24,
                      fontWeight: 600,
                      color: CREW_LOGIN_CARD_LINK,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {selectedMember?.initials ?? "?"}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#F5F5F3", marginBottom: 4 }}>
                    {selectedMember?.name ?? "-"}
                  </div>
                  <div style={{ fontSize: 12, color: CREW_LOGIN_CARD_INK_SUBTLE, marginBottom: 8 }}>
                    {selectedMember?.role === "lead" ? "Lead" : selectedMember?.role} · {context.teamName ?? "Team"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMemberPicker(true)}
                    className="crew-login-link"
                    style={{
                      background: "none",
                      border: "none",
                      color: CREW_LOGIN_CARD_INK_SUBTLE,
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      padding: 0,
                    }}
                  >
                    Not {selectedMember?.name?.split(" ")[0]}?
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ ...CREW_LOGIN_FIELD_LABEL, textAlign: "center", marginBottom: 12 }}>Select crew member</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                    {context.teamMembers?.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="crew-keep-round"
                        onClick={() => {
                          setSelectedMember(m);
                          setShowMemberPicker(false);
                          setPin("");
                          setError("");
                          setTimeout(() => pinInputRef.current?.focus(), 100);
                        }}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: "50%",
                          background: selectedMember?.id === m.id ? "rgba(92,26,51,0.22)" : "rgba(255,255,255,0.05)",
                          border: selectedMember?.id === m.id ? `2px solid ${CREW_LOGIN_CARD_PIN_RING}` : "1px solid #333",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 600,
                          color: selectedMember?.id === m.id ? CREW_LOGIN_CARD_LINK : "rgba(255,255,255,0.42)",
                          fontFamily: "'DM Sans', sans-serif",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        title={m.name}
                      >
                        {m.initials}
                      </button>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <button
                      type="button"
                      onClick={openPhoneLogin}
                      className="crew-login-link"
                      style={{
                        background: "none",
                        border: "none",
                        color: CREW_LOGIN_CARD_INK_SUBTLE,
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        padding: 0,
                      }}
                    >
                      Wrong crew? Log in with phone & PIN
                    </button>
                  </div>
                </div>
              )}

              {!showMemberPicker && (
                <>
                  <p
                    style={{
                      fontSize: 12,
                      color: CREW_LOGIN_CARD_INK_BODY,
                      lineHeight: 1.55,
                      textAlign: "center",
                      margin: "0 0 16px",
                    }}
                  >
                    This tablet shows the crew dispatch assigned to this truck today. If your team took over the truck, ask dispatch to update today&apos;s assignment—or use phone & PIN below.
                  </p>
                  <div style={{ textAlign: "center", marginBottom: 22 }}>
                    <button
                      type="button"
                      onClick={openPhoneLogin}
                      className="crew-login-link"
                      style={{
                        background: "none",
                        border: "none",
                        color: CREW_LOGIN_CARD_LINK,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        padding: 0,
                      }}
                    >
                      Log in with phone & PIN instead
                    </button>
                  </div>
                </>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={CREW_LOGIN_FIELD_LABEL} htmlFor="crew-login-pin-hidden">
                  Enter PIN
                </label>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => pinInputRef.current?.focus()}
                  onKeyDown={(e) => e.key === "Enter" && pinInputRef.current?.focus()}
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    marginBottom: 8,
                    cursor: "pointer",
                  }}
                >
                  {Array.from({ length: pinLength }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 52,
                        height: 56,
                        borderRadius: 10,
                        background: "#0D0D0D",
                        border: `2px solid ${pin.length > i ? CREW_LOGIN_CARD_PIN_RING : "#2A2A2A"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        fontWeight: 600,
                        color: "#F5F5F3",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {pin[i] ? "•" : ""}
                    </div>
                  ))}
                </div>
                <input
                  id="crew-login-pin-hidden"
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={pinLength}
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="crew-login-input"
                  style={{
                    position: "absolute",
                    opacity: 0,
                    pointerEvents: "none",
                    width: 0,
                    height: 0,
                  }}
                  aria-label="PIN"
                />
              </div>
            </>
          )}

          {error && (
            <div
              style={{
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.2)",
                color: "#F87171",
                fontSize: 12,
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 18,
              }}
            >
              {error}
            </div>
          )}

          {isWelcome && !consentAccepted && (
            <div style={{ marginTop: 20, padding: "14px 16px", background: "rgba(92,26,51,0.08)", borderRadius: 10, border: "1px solid rgba(92,26,51,0.22)" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => handleConsentChange(e.target.checked)}
                  style={{ marginTop: 2, width: 15, height: 15, accentColor: CREW_LOGIN_CARD_CHECKBOX_ACCENT, flexShrink: 0, cursor: "pointer" }}
                />
                <span style={{ fontSize: 11, color: CREW_LOGIN_CARD_INK_BODY, lineHeight: 1.6 }}>
                  I agree to Yugo&apos;s{" "}
                  <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: CREW_LOGIN_CARD_LINK, textDecoration: "underline" }}>Privacy Policy</a> and{" "}
                  <a href="/legal/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ color: CREW_LOGIN_CARD_LINK, textDecoration: "underline" }}>Terms of Use</a>
                </span>
              </label>
            </div>
          )}

          <div style={{ fontSize: 12, color: CREW_LOGIN_CARD_INK_SUBTLE, textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
            Dispatch:{" "}
            <a
              className="crew-login-link"
              href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
              style={{ color: CREW_LOGIN_CARD_LINK, fontWeight: 600, textDecoration: "none" }}
            >
              {formatPhone(DISPATCH_PHONE)}
            </a>
          </div>
        </section>
    </main>
  );
}

function CrewPhoneLoginFields({
  phoneDigits,
  onPhoneDigitsChange,
  phonePin,
  onPhonePinChange,
  phoneInputRef,
  phonePinInputRef,
  onPhonePinKeyDown,
  submitting,
  onBack,
  backLabel,
}: {
  phoneDigits: string;
  onPhoneDigitsChange: (digits: string) => void;
  phonePin: string;
  onPhonePinChange: (val: string) => void;
  phoneInputRef: RefObject<HTMLInputElement | null>;
  phonePinInputRef: RefObject<HTMLInputElement | null>;
  onPhonePinKeyDown: (e: React.KeyboardEvent) => void;
  submitting: boolean;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <>
      <p
        style={{
          fontSize: 13,
          color: CREW_LOGIN_CARD_INK_BODY,
          lineHeight: 1.55,
          textAlign: "center",
          margin: "0 0 20px",
        }}
      >
        Use the mobile number on file with Yugo and your 6-digit crew PIN. This works when the tablet still shows another crew.
      </p>
      <label htmlFor="crew-login-phone" style={CREW_LOGIN_FIELD_LABEL}>
        Phone number
      </label>
      <input
        id="crew-login-phone"
        ref={phoneInputRef}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={PHONE_PLACEHOLDER}
        disabled={submitting}
        value={formatPhone(phoneDigits)}
        onChange={(e) => onPhoneDigitsChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        className="crew-login-input"
        style={{
          width: "100%",
          padding: "12px 0",
          borderRadius: 0,
          border: "none",
          borderBottom: "1px solid #3A3A3E",
          background: "transparent",
          color: "#F5F5F3",
          fontSize: 16,
          marginBottom: 20,
          boxSizing: "border-box",
          fontFamily: "'DM Sans', sans-serif",
        }}
      />
      <div style={{ marginBottom: 18, position: "relative" }}>
        <label htmlFor="crew-login-phone-pin" style={CREW_LOGIN_FIELD_LABEL}>
          Enter PIN (6 digits)
        </label>
        <div
          role="button"
          tabIndex={0}
          onClick={() => phonePinInputRef.current?.focus()}
          onKeyDown={(e) => e.key === "Enter" && phonePinInputRef.current?.focus()}
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginBottom: 8,
            cursor: "pointer",
          }}
        >
          {Array.from({ length: PHONE_LOGIN_PIN_DIGITS }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 52,
                height: 56,
                borderRadius: 10,
                background: "#0D0D0D",
                border: `2px solid ${phonePin.length > i ? CREW_LOGIN_CARD_PIN_RING : "#2A2A2A"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 600,
                color: "#F5F5F3",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {phonePin[i] ? "•" : ""}
            </div>
          ))}
        </div>
        <input
          id="crew-login-phone-pin"
          ref={phonePinInputRef}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={PHONE_LOGIN_PIN_DIGITS}
          value={phonePin}
          onChange={(e) => onPhonePinChange(e.target.value)}
          onKeyDown={onPhonePinKeyDown}
          disabled={submitting}
          className="crew-login-input"
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
            width: 0,
            height: 0,
          }}
          aria-label="PIN"
        />
      </div>
      <button
        type="button"
        onClick={onBack}
        className="crew-login-link"
        style={{
          display: "block",
          width: "100%",
          background: "none",
          border: "none",
          color: CREW_LOGIN_CARD_INK_SUBTLE,
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "inherit",
          padding: "8px 0 0",
          textAlign: "center",
        }}
      >
        {backLabel}
      </button>
    </>
  );
}
