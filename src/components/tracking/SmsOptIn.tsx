"use client";

import { useState, useEffect, useCallback } from "react";
import { DeviceMobileCamera, Check, X } from "@phosphor-icons/react";

interface SmsOptInProps {
  moveId: string;
  initialPhone?: string;
  token: string;
}

const STORAGE_KEY_PREFIX = "yugo_sms_pref_";

export default function SmsOptIn({ moveId, initialPhone, token }: SmsOptInProps) {
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${moveId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setEnabled(parsed.enabled ?? false);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.enabled) setShowInput(false);
      }
    } catch {
      // localStorage unavailable
    }
  }, [moveId]);

  const save = useCallback(
    async (nextEnabled: boolean, nextPhone: string) => {
      setSaving(true);
      try {
        await fetch(`/api/track/moves/${moveId}/sms-preference?token=${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: nextPhone, enabled: nextEnabled }),
        });

        localStorage.setItem(
          `${STORAGE_KEY_PREFIX}${moveId}`,
          JSON.stringify({ enabled: nextEnabled, phone: nextPhone })
        );

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        // Silently fail
      } finally {
        setSaving(false);
      }
    },
    [moveId, token]
  );

  const handleToggle = () => {
    if (enabled) {
      setEnabled(false);
      setShowInput(false);
      save(false, phone);
    } else {
      if (phone) {
        setEnabled(true);
        setShowInput(false);
        save(true, phone);
      } else {
        setShowInput(true);
      }
    }
  };

  const handleSubmitPhone = () => {
    if (!phone.trim()) return;
    setEnabled(true);
    setShowInput(false);
    save(true, phone.trim());
  };

  return (
    <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg1)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DeviceMobileCamera size={20} className="text-[var(--tx3)]" />
          <div>
            <p className="text-sm font-medium text-[var(--tx1)]">Text Updates</p>
            <p className="text-xs text-[var(--tx3)]">Get SMS notifications about your move</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-[var(--grn)]">
              <Check size={14} weight="bold" />
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? "bg-[var(--grn)]" : "bg-[var(--brd)]"
            }`}
            aria-label={enabled ? "Disable text updates" : "Enable text updates"}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {showInput && !enabled && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="tel"
            placeholder="(647) 370-4525"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--brd)] bg-[var(--bg2)] px-3 py-2 text-sm text-[var(--tx1)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
          />
          <button
            type="button"
            onClick={handleSubmitPhone}
            disabled={!phone.trim() || saving}
            className="rounded-lg bg-[var(--gold)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Enable
          </button>
          <button
            type="button"
            onClick={() => setShowInput(false)}
            className="rounded-lg p-2 text-[var(--tx3)] hover:bg-[var(--bg2)]"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
