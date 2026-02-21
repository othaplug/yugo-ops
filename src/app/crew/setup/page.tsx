"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const DEVICE_STORAGE_KEY = "yugo-crew-device-id";

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!id) {
    id = "ipad-" + crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(DEVICE_STORAGE_KEY, id);
  }
  return id;
}

export default function CrewSetupPage() {
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await fetch("/api/crew/register-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          deviceId,
          deviceName: deviceName.trim() || "iPad",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }
      if (data.deviceId && typeof window !== "undefined") {
        localStorage.setItem(DEVICE_STORAGE_KEY, data.deviceId);
      }
      router.push("/crew/login");
      router.refresh();
    } catch {
      setError("Connection error");
    }
    setLoading(false);
  };

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
        }}
      >
        <style>{`
          @keyframes setupFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          .crew-setup-input:focus { border-color: #C9A962 !important; outline: none; }
          .crew-setup-btn:hover:not(:disabled) { background: #D4B56C !important; transform: translateY(-1px); }
        `}</style>

        <div
          style={{
            background: "#1A1A1A",
            border: "1px solid #2A2A2A",
            borderRadius: 20,
            padding: "36px 40px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
            animation: "setupFadeIn 0.6s ease",
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
              YUGO
            </h1>
          </div>

          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, color: "#F5F5F3", marginBottom: 6 }}>
            iPad Setup
          </div>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 32 }}>
            Enter the setup code from your admin to register this device
          </div>

          <div
            style={{
              width: 48,
              height: 1,
              background: "linear-gradient(90deg, transparent, #C9A962, transparent)",
              margin: "0 auto 32px",
            }}
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
                marginBottom: 18,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: "#666",
                  marginBottom: 6,
                }}
              >
                Setup Code
              </label>
              <input
                className="crew-setup-input"
                type="text"
                placeholder="e.g. ABCD-1234"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#0D0D0D",
                  border: "1px solid #2A2A2A",
                  borderRadius: 10,
                  color: "#F5F5F3",
                  fontSize: 16,
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: 2,
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: "#666",
                  marginBottom: 6,
                }}
              >
                Device Name (optional)
              </label>
              <input
                className="crew-setup-input"
                type="text"
                placeholder="e.g. Truck 1 iPad"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#0D0D0D",
                  border: "1px solid #2A2A2A",
                  borderRadius: 10,
                  color: "#F5F5F3",
                  fontSize: 14,
                  fontFamily: "'DM Sans', sans-serif",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
              />
            </div>

            <button
              type="submit"
              className="crew-setup-btn"
              disabled={loading}
              style={{
                width: "100%",
                padding: 13,
                background: "#C9A962",
                color: "#0D0D0D",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? "Registering..." : "Register Device"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
