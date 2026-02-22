"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";

export default function EditableEmailSection({ currentEmail }: { currentEmail: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState(currentEmail);
  useEffect(() => setEmail(currentEmail), [currentEmail]);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangeClick = () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast("Enter an email address", "x");
      return;
    }
    if (trimmed === currentEmail) {
      toast("Email is unchanged", "x");
      return;
    }
    setNewEmail(trimmed);
    setModalOpen(true);
    setStep("email");
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/account/request-email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setStep("code");
      toast("Verification code sent to your current email", "check");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/account/confirm-email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), newEmail: newEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast("Email updated. Signing you out…", "check");
      router.push("/login");
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setStep("email");
    setNewEmail("");
    setCode("");
  };

  return (
    <div>
      <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Email Address</label>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="flex-1 px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
        />
        <button
          type="button"
          onClick={handleChangeClick}
          className="px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] transition-all shrink-0"
        >
          Change
        </button>
      </div>

      <ModalOverlay open={modalOpen} onClose={closeModal} title="Change email address">
        <div className="p-5 space-y-4">
          <p className="text-[12px] text-[var(--tx2)]">Changing to: <strong className="text-[var(--tx)]">{newEmail}</strong></p>
          <p className="text-[10px] text-[var(--tx3)]">A verification code will be sent to <strong>{currentEmail}</strong> to confirm</p>
          {step === "email" ? (
            <form onSubmit={(e) => { e.preventDefault(); handleRequestCode(e); }} className="space-y-3">
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] disabled:opacity-50">
                  {loading ? "Sending…" : "Send code"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Verification code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  maxLength={6}
                  className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none font-mono tracking-widest"
                />
              </div>
              <p className="text-[10px] text-[var(--tx3)]">Code sent to {currentEmail}. Check your inbox.</p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setStep("email"); setCode(""); }} className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] transition-all">
                  Back
                </button>
                <button type="submit" disabled={loading || code.length !== 6} className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] disabled:opacity-50">
                  {loading ? "Updating…" : "Confirm"}
                </button>
              </div>
            </form>
          )}
        </div>
      </ModalOverlay>
    </div>
  );
}
