"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";

const JOB_TITLES = [
  "Owner / CEO",
  "Operations Manager",
  "Dispatcher",
  "Move Coordinator",
  "Sales Representative",
  "Customer Support",
  "Crew Lead",
  "Accountant / Finance",
  "Other",
];

export default function PersonalSettingsForm({
  initialName,
  initialPhone,
  email,
  roleLabel,
}: {
  initialName: string;
  initialPhone: string;
  email: string;
  roleLabel: string;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ? formatPhone(initialPhone) : "");
  const phoneInput = usePhoneInput(phone, setPhone);
  const [jobTitle, setJobTitle] = useState(() => localStorage.getItem("pref_job_title") ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: normalizePhone(phone) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      localStorage.setItem("pref_job_title", jobTitle);
      try {
        localStorage.removeItem("pref_timezone");
      } catch {
        /* ignore */
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast("Profile updated", "check");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] text-[var(--tx)] focus:border-[var(--gold)] outline-none transition-colors";

  return (
    <div className="space-y-4">
      {/* Name + Email row */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className={fieldClass}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            disabled
            className={`${fieldClass} opacity-50 cursor-not-allowed`}
          />
          <p className="text-[9px] text-[var(--tx3)] mt-1">Change email in the Security tab</p>
        </div>
      </div>

      {/* Phone + Job Title row */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1">Phone Number</label>
          <input
            ref={phoneInput.ref}
            type="tel"
            value={phone}
            onChange={phoneInput.onChange}
            placeholder={PHONE_PLACEHOLDER}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1">Job Title</label>
          <select
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className={fieldClass}
          >
            <option value="">Select a title…</option>
            {JOB_TITLES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Business timezone (fixed; matches crew and partner portal) */}
      <div>
        <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1">Time zone</label>
        <div className={`${fieldClass} opacity-90 cursor-default`}>
          Eastern Time (Toronto) — all schedules and times use this zone
        </div>
        <p className="text-[9px] text-[var(--tx3)] mt-1">
          Set APP_TIMEZONE / NEXT_PUBLIC_APP_TIMEZONE to America/Toronto in deployment if you ever need to change the business region.
        </p>
      </div>

      {/* Role (read-only) */}
      <div>
        <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1">Role</label>
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg">
          <span className="w-2 h-2 bg-[var(--gold)] rounded-full" />
          <span className="text-[12px] text-[var(--tx)]">{roleLabel}</span>
          <span className="ml-auto text-[9px] text-[var(--tx3)]">Managed by administrator</span>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
      >
        {loading ? "Saving…" : saved ? "Saved ✓" : "Save Profile"}
      </button>
    </div>
  );
}
