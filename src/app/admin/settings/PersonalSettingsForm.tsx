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
    "admin-premium-input w-full";

  const labelClass = "admin-premium-label admin-premium-label--tight";

  return (
    <div className="space-y-5">
      {/* Name + Email row */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Email Address</label>
          <input
            type="email"
            value={email}
            disabled
            className={`${fieldClass} opacity-50 cursor-not-allowed`}
          />
          <p className="text-[10px] text-[var(--tx3)] mt-1.5">Change email in the Security tab</p>
        </div>
      </div>

      {/* Phone + Job Title row */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Phone Number</label>
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
          <label className={labelClass}>Job Title</label>
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
        <label className={labelClass}>Time zone</label>
        <div className={`${fieldClass} opacity-90 cursor-default`}>
          Eastern Time (Toronto). All schedules and times use this zone.
        </div>
        <p className="text-[10px] text-[var(--tx3)] mt-1.5">
          This timezone applies across Yugo for your organization. If you need it changed, ask your administrator.
        </p>
      </div>

      {/* Role (read-only) */}
      <div>
        <label className={labelClass}>Role</label>
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg">
          <span className="w-2 h-2 bg-[var(--admin-primary-fill)] rounded-full" />
          <span className="text-[13px] text-[var(--tx)]">{roleLabel}</span>
          <span className="ml-auto text-[10px] text-[var(--tx3)]">Managed by administrator</span>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50"
      >
        {loading ? "Saving…" : saved ? "Saved ✓" : "Save Profile"}
      </button>
    </div>
  );
}
