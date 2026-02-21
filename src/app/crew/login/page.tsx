"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatPhone, normalizePhone } from "@/lib/phone";

const DEVICE_STORAGE_KEY = "yugo-crew-device-id";
const DISPATCH_PHONE = "(647) 370-4525";

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
  const pinInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem(DEVICE_STORAGE_KEY) : null;
    setDeviceId(id);
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

  const handleLogin = async () => {
    if (!selectedMember || submitting) return;
    const len = selectedMember.pinLength;
    if (pin.length !== len) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/crew/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crewMemberId: selectedMember.id, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setSubmitting(false);
        return;
      }
      router.push("/crew/dashboard");
      router.refresh();
    } catch {
      setError("Connection error");
    }
    setSubmitting(false);
  };

  const handleLoginRef = useRef(handleLogin);
  handleLoginRef.current = handleLogin;

  useEffect(() => {
    if (!selectedMember || submitting) return;
    const len = selectedMember.pinLength;
    if (pin.length === len) {
      handleLoginRef.current?.();
    }
  }, [pin, selectedMember, submitting]);

  useEffect(() => {
    if (selectedMember && context?.hasDevice && !showMemberPicker) {
      const t = setTimeout(() => pinInputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [selectedMember, context?.hasDevice, showMemberPicker]);

  const handlePinChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, selectedMember?.pinLength ?? 4);
    setPin(digits);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && pin.length > 0 && !(e.target as HTMLInputElement).value) {
      setPin((p) => p.slice(0, -1));
    }
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0D0D0D",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ color: "#666", fontSize: 14 }}>Loading...</div>
      </main>
    );
  }

  if (!deviceId) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0D0D0D",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "0 28px",
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, color: "#F5F5F3", marginBottom: 12 }}>
            Device Not Registered
          </div>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            Set up this iPad first to link it to your truck and team.
          </div>
          <a
            href="/crew/setup"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#C9A962",
              color: "#0D0D0D",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Go to Setup
          </a>
        </div>
      </main>
    );
  }

  if (!context?.hasDevice) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0D0D0D",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "0 28px",
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, color: "#F5F5F3", marginBottom: 12 }}>
            Device Not Found
          </div>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            This device may need to be re-registered. Contact dispatch or set up again.
          </div>
          <a
            href="/crew/setup"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#C9A962",
              color: "#0D0D0D",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Re-register Device
          </a>
        </div>
      </main>
    );
  }

  if (context.noTeamAssigned || context.noMembers) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0D0D0D",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "0 28px",
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, color: "#F5F5F3", marginBottom: 12 }}>
            No Team Assigned
          </div>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            {context.noTeamAssigned
              ? "No team is assigned to this truck today. Contact dispatch to get scheduled."
              : "No crew members found for this team. Contact dispatch."}
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            Dispatch:{" "}
            <a href={`tel:${normalizePhone(DISPATCH_PHONE)}`} style={{ color: "#C9A962", textDecoration: "none" }}>
              {formatPhone(DISPATCH_PHONE)}
            </a>
          </div>
        </div>
      </main>
    );
  }

  const pinLength = selectedMember?.pinLength ?? 4;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date();
  const dateStr = context.dateStr || `${dayNames[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0D0D0D",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          padding: "0 28px",
          position: "relative",
          zIndex: 1,
          animation: "loginFadeIn 0.6s ease",
        }}
      >
        <style>{`
          @keyframes loginFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          .crew-login-input:focus { border-color: #C9A962 !important; outline: none; }
          .crew-login-link:hover { color: #D4B56C !important; text-decoration: underline; }
        `}</style>

        <div
          style={{
            background: "#1A1A1A",
            border: "1px solid #2A2A2A",
            borderRadius: 20,
            padding: "36px 40px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 20px",
                borderRadius: 9999,
                background: "rgba(201,169,98,0.08)",
                border: "1px solid rgba(201,169,98,0.4)",
                color: "#C9A962",
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 3,
                margin: 0,
              }}
            >
              Y U G O
            </h1>
          </div>

          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 26, color: "#F5F5F3", marginBottom: 6 }}>
            Crew Portal
          </div>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            {context.truckName} · {dateStr}
          </div>

          <div
            style={{
              width: 48,
              height: 1,
              background: "linear-gradient(90deg, transparent, #C9A962, transparent)",
              margin: "0 auto 28px",
            }}
          />

          {!showMemberPicker ? (
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(201,169,98,0.3), rgba(201,169,98,0.1))",
                  border: "2px solid rgba(201,169,98,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#C9A962",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {selectedMember?.initials ?? "?"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#F5F5F3", marginBottom: 4 }}>
                {selectedMember?.name ?? "—"}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                {selectedMember?.role === "lead" ? "Lead" : selectedMember?.role} · {context.teamName ?? "Team"}
              </div>
              <button
                type="button"
                onClick={() => setShowMemberPicker(true)}
                className="crew-login-link"
                style={{
                  background: "none",
                  border: "none",
                  color: "#888",
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
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: "#666", marginBottom: 12 }}>
                Select crew member
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                {context.teamMembers?.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMember(m);
                      setShowMemberPicker(false);
                      setPin("");
                      setTimeout(() => pinInputRef.current?.focus(), 100);
                    }}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: selectedMember?.id === m.id ? "rgba(201,169,98,0.2)" : "rgba(255,255,255,0.05)",
                      border: selectedMember?.id === m.id ? "2px solid #C9A962" : "1px solid #333",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 600,
                      color: selectedMember?.id === m.id ? "#C9A962" : "#999",
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
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "#666",
                marginBottom: 10,
              }}
            >
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
                    border: `2px solid ${pin.length > i ? "#C9A962" : "#2A2A2A"}`,
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

          <div style={{ fontSize: 12, color: "#555", textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
            Dispatch:{" "}
            <a
              className="crew-login-link"
              href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
              style={{ color: "#C9A962", fontWeight: 600, textDecoration: "none" }}
            >
              {formatPhone(DISPATCH_PHONE)}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
