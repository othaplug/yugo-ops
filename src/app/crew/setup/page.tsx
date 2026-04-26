"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import YugoLogo from "@/components/YugoLogo";
import { cn } from "@/lib/utils";

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
  const [setupWarning, setSetupWarning] = useState("");
  const router = useRouter();

  const goToLogin = () => {
    router.push("/crew/login");
    router.refresh();
  };

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
      if (typeof data.warning === "string" && data.warning.trim()) {
        setSetupWarning(data.warning.trim());
        setLoading(false);
        return;
      }
      goToLogin();
    } catch {
      setError("Connection error");
    }
    setLoading(false);
  };

  return (
    <main
      className={cn(
        "flex min-h-dvh items-center justify-center px-4 py-8",
        "[font-family:var(--font-body)]",
        "bg-zinc-950",
      )}
    >
      <div className="w-full max-w-[420px]">
        <div
          className={cn(
            "border border-zinc-800/90 bg-zinc-900/95 p-8 shadow-xl sm:p-10",
            "animate-[setupFadeIn_0.5s_ease_both]",
          )}
        >
          <style>{`
            @keyframes setupFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>

          {setupWarning ? (
            <div className="text-left">
              <h1 className="font-hero text-[22px] font-normal text-stone-100">
                Registered with a note
              </h1>
              <p className="mb-5 mt-2 text-[14px] leading-relaxed text-stone-400 [font-family:var(--font-body)]">
                {setupWarning}
              </p>
              <button
                type="button"
                onClick={goToLogin}
                className="crew-premium-cta w-full min-h-[48px] border border-[#3d1426] text-[11px] font-bold uppercase tracking-[0.12em] text-[#FFFBF7] [font-family:var(--font-body)]"
              >
                Continue to crew login
              </button>
            </div>
          ) : (
            <>
              <div className="mb-7 flex justify-center">
                <div className="inline-flex items-center justify-center rounded-full border border-[var(--yu3-wine)]/40 bg-[var(--yu3-wine)]/10 px-5 py-2">
                  <YugoLogo size={18} variant="cream" />
                </div>
              </div>

              <h1 className="font-hero text-center text-[24px] font-normal text-stone-100">
                iPad setup
              </h1>
              <p className="mb-8 mt-1 text-center text-[14px] text-stone-500 [font-family:var(--font-body)]">
                Enter the setup code from your admin to register this device
              </p>

              <div
                className="mb-8 h-px w-12 bg-gradient-to-r from-transparent via-[var(--yu3-wine)]/50 to-transparent"
                aria-hidden
              />

              {error && (
                <div
                  className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300 [font-family:var(--font-body)]"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500 [font-family:var(--font-body)]">
                    Setup code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ABCD-1234"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
                    }
                    required
                    autoFocus
                    className="w-full border-0 border-b border-zinc-700 bg-transparent py-3 text-[16px] tracking-[0.2em] text-stone-100 placeholder:text-stone-600 outline-none [font-family:var(--font-body)] focus:border-b-[var(--yu3-wine)]/60"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500 [font-family:var(--font-body)]">
                    Device name (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Truck 1 iPad"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full border-0 border-b border-zinc-700 bg-transparent py-3 text-[14px] text-stone-100 placeholder:text-stone-600 outline-none [font-family:var(--font-body)] focus:border-b-[var(--yu3-wine)]/60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="crew-premium-cta w-full min-h-[48px] text-[11px] font-bold uppercase tracking-[0.12em] text-[#FFFBF7] [font-family:var(--font-body)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Registering" : "Register device"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
