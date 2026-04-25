"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Yu3PortaledTokenRoot } from "@/hooks/useAdminShellTheme";
import {
  CaretLeft,
  CaretRight,
  DeviceMobile,
  SealCheck,
} from "@phosphor-icons/react";
import {
  WAIVER_CATEGORIES,
  type WaiverCategory,
} from "@/lib/waivers/waiver-categories";
import {
  ClientWaiverView,
  type CrewRecommendation,
} from "@/components/crew/ClientWaiverView";

type WaiverStep =
  | "select_category"
  | "describe"
  | "hand_to_client"
  | "client_view"
  | "complete";

export type WaiverFlowProps = {
  open: boolean;
  onClose: () => void;
  moveId: string;
  clientName: string;
  viewerCrewMemberId: string;
  viewerCrewMemberName: string;
};

const MAX_PHOTOS = 8;

export const WaiverFlow = ({
  open,
  onClose,
  moveId,
  clientName,
  viewerCrewMemberId,
  viewerCrewMemberName,
}: WaiverFlowProps) => {
  const [step, setStep] = useState<WaiverStep>("select_category");
  const [selectedCategory, setSelectedCategory] = useState<WaiverCategory | null>(
    null,
  );
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [crewRecommendation, setCrewRecommendation] =
    useState<CrewRecommendation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("select_category");
    setSelectedCategory(null);
    setItemName("");
    setDescription("");
    setPhotoFiles([]);
    setPhotoPreviewUrls([]);
    setCrewRecommendation(null);
    setError(null);
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    return () => {
      for (const u of photoPreviewUrls) {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u);
      }
    };
  }, [photoPreviewUrls]);

  const handlePhotoFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const next: File[] = [];
    for (let i = 0; i < files.length && next.length < MAX_PHOTOS; i++) {
      const f = files[i];
      if (f.type.startsWith("image/")) next.push(f);
    }
    setPhotoFiles(next);
    setPhotoPreviewUrls((prev) => {
      for (const u of prev) {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u);
      }
      return next.map((f) => URL.createObjectURL(f));
    });
  }, []);

  const uploadPhotos = async (): Promise<string[]> => {
    const paths: string[] = [];
    for (const file of photoFiles) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/moves/${encodeURIComponent(moveId)}/waiver-photos`,
        { method: "POST", body: fd, credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Photo upload failed");
      if (typeof data.path === "string") paths.push(data.path);
    }
    return paths;
  };

  const saveWaiver = async (payload: {
    status: "signed" | "declined";
    signature_data?: string;
    signed_by?: string;
    photo_paths: string[];
  }) => {
    const res = await fetch(`/api/moves/${encodeURIComponent(moveId)}/waivers`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: selectedCategory?.code,
        item_name: itemName.trim(),
        description: description.trim(),
        photo_paths: payload.photo_paths,
        crew_recommendation: crewRecommendation,
        status: payload.status,
        signature_data: payload.signature_data,
        signed_by: payload.signed_by,
        reported_by: viewerCrewMemberId,
        reported_by_name: viewerCrewMemberName,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not save waiver");
  };

  const handleWaiverSigned = async (signatureData: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const paths = await uploadPhotos();
      await saveWaiver({
        status: "signed",
        signature_data: signatureData,
        signed_by: clientName,
        photo_paths: paths,
      });
      setStep("complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWaiverDeclined = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const paths = await uploadPhotos();
      await saveWaiver({
        status: "declined",
        photo_paths: paths,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const canGenerate =
    itemName.trim().length > 0 &&
    description.trim().length > 0 &&
    photoFiles.length > 0 &&
    crewRecommendation !== null;

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99990] flex flex-col modal-overlay"
      data-modal-root
      data-crew-portal
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
      role="presentation"
    >
      <Yu3PortaledTokenRoot dataTheme="light" className="min-h-0 w-full flex-1 overflow-y-auto">
        <div className="min-h-full p-4 max-w-lg mx-auto pb-8">
          {error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-800">
              {error}
            </div>
          )}

          {step === "complete" && (
            <div
              className="bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-2xl p-6 text-center shadow-2xl"
              data-crew-job-premium
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--yu3-wine-tint)] flex items-center justify-center mx-auto mb-4">
                <SealCheck size={32} weight="bold" className="text-[var(--yu3-wine)]" aria-hidden />
              </div>
              <h2 className="font-hero text-[22px] font-bold text-[var(--yu3-ink)] mb-2">
                Waiver saved
              </h2>
              <p className="text-[13px] text-[var(--yu3-ink-faint)] mb-6 leading-relaxed">
                The signed waiver is on file. You can continue the job.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="crew-premium-cta inline-flex w-full items-center justify-center gap-2 py-3 min-h-[48px] font-bold text-[11px] uppercase tracking-[0.1em] text-[#fffbf7] [font-family:var(--font-body)] leading-none"
              >
                Done
                <CaretRight size={16} weight="bold" className="shrink-0 opacity-95" aria-hidden />
              </button>
            </div>
          )}

          {step === "select_category" && (
            <div
              className="bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-2xl p-5 shadow-2xl"
              data-crew-job-premium
            >
              <h2 className="font-hero text-[22px] font-bold text-[var(--yu3-ink)] mb-1">
                What is the risk?
              </h2>
              <p className="text-[12px] text-[var(--yu3-ink-faint)] mb-4 leading-relaxed">
                Select the category that best describes the situation. The client
                must review and sign before you proceed.
              </p>
              <div className="space-y-2 max-h-[min(52vh,420px)] overflow-y-auto pr-1">
                {WAIVER_CATEGORIES.map((cat) => (
                  <button
                    key={cat.code}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                      setStep("describe");
                    }}
                    className="w-full text-left p-4 rounded-xl border border-[var(--yu3-line)] bg-[var(--yu3-bg-canvas)]/40 hover:border-[#5C1A33]/40 hover:bg-[#5C1A33]/[0.04] transition-colors"
                  >
                    <p className="text-[13px] font-semibold text-[var(--yu3-ink)]">
                      {cat.label}
                    </p>
                    <p className="text-[11px] text-[var(--yu3-ink-faint)] mt-1 leading-snug">
                      {cat.description}
                    </p>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-4 py-2.5 text-[13px] text-[var(--yu3-ink-faint)] hover:text-[#5C1A33]"
              >
                Cancel
              </button>
            </div>
          )}

          {step === "describe" && selectedCategory && (
            <div
              className="bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-2xl p-5 shadow-2xl"
              data-crew-job-premium
            >
              <h2 className="font-hero text-[22px] font-bold text-[var(--yu3-ink)] mb-1">
                Describe the situation
              </h2>
              <p className="text-[12px] text-[var(--yu3-ink-faint)] mb-4 leading-relaxed">
                Be specific. This becomes part of the signed waiver.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--yu3-ink-faint)] uppercase tracking-wider mb-1">
                    Item or area affected
                  </label>
                  <input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. King bed frame, master bedroom"
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--yu3-bg-canvas)] border border-[var(--yu3-line)] text-[var(--yu3-ink)] placeholder:text-[var(--yu3-ink-faint)] text-[13px] focus:border-[#5C1A33]/35 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--yu3-ink-faint)] uppercase tracking-wider mb-1">
                    What is the problem?
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the condition and why it is risky."
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--yu3-bg-canvas)] border border-[var(--yu3-line)] text-[var(--yu3-ink)] placeholder:text-[var(--yu3-ink-faint)] text-[13px] focus:border-[#5C1A33]/35 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--yu3-ink-faint)] uppercase tracking-wider mb-1">
                    Photos (required)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={(e) => handlePhotoFiles(e.target.files)}
                    className="w-full text-[12px] text-[var(--yu3-ink-muted)] file:mr-2 file:py-1.5 file:px-2 file:rounded-lg file:border file:border-[var(--yu3-line)] file:bg-[var(--yu3-bg-canvas)]"
                  />
                  {photoFiles.length > 0 && (
                    <p className="text-[11px] text-[#243524] mt-1 font-medium">
                      {photoFiles.length} photo
                      {photoFiles.length !== 1 ? "s" : ""} attached
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--yu3-ink-faint)] uppercase tracking-wider mb-1">
                    Your recommendation
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCrewRecommendation("proceed_with_caution")
                      }
                      className={`flex-1 py-2.5 text-[11px] font-semibold rounded-xl border transition-colors ${
                        crewRecommendation === "proceed_with_caution"
                          ? "border-[#b45309] bg-[#b45309]/10 text-[#92400e]"
                          : "border-[var(--yu3-line)] text-[var(--yu3-ink-faint)]"
                      }`}
                    >
                      Proceed with caution
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrewRecommendation("do_not_recommend")}
                      className={`flex-1 py-2.5 text-[11px] font-semibold rounded-xl border transition-colors ${
                        crewRecommendation === "do_not_recommend"
                          ? "border-red-400 bg-red-50 text-red-800"
                          : "border-[var(--yu3-line)] text-[var(--yu3-ink-faint)]"
                      }`}
                    >
                      Do not recommend
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep("select_category")}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-2.5 text-[13px] font-medium border border-[var(--yu3-line)] text-[var(--yu3-ink-muted)] rounded-xl hover:bg-[var(--yu3-bg-canvas)]"
                >
                  <CaretLeft size={16} aria-hidden />
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => setStep("hand_to_client")}
                  className="flex-1 crew-premium-cta inline-flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#fffbf7] disabled:opacity-40 rounded-xl"
                >
                  Generate waiver
                  <CaretRight size={16} weight="bold" aria-hidden />
                </button>
              </div>
            </div>
          )}

          {step === "hand_to_client" && selectedCategory && (
            <div
              className="bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-2xl p-6 text-center shadow-2xl"
              data-crew-job-premium
            >
              <div className="w-16 h-16 rounded-full bg-[#b45309]/15 flex items-center justify-center mx-auto mb-4">
                <DeviceMobile
                  size={32}
                  weight="duotone"
                  className="text-[#92400e]"
                  aria-hidden
                />
              </div>
              <h2 className="font-hero text-[26px] sm:text-[30px] leading-tight font-bold text-[var(--yu3-ink)] mb-3">
                Hand the phone to the client
              </h2>
              <p className="text-[12px] text-[var(--yu3-ink-faint)] leading-relaxed mb-6">
                The client needs to read the waiver, understand the risks, and
                sign if they want to proceed.
              </p>
              <button
                type="button"
                onClick={() => setStep("client_view")}
                className="w-full crew-premium-cta inline-flex items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.08em] text-[#fffbf7] [font-family:var(--font-body)] leading-none rounded-xl"
              >
                Ready, show waiver to client
                <CaretRight size={18} weight="bold" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setStep("describe")}
                className="w-full mt-3 py-2 text-[13px] text-[var(--yu3-ink-faint)]"
              >
                Back
              </button>
            </div>
          )}

          {step === "client_view" && selectedCategory && (
            <div className="space-y-4">
              <ClientWaiverView
                category={selectedCategory}
                itemName={itemName}
                description={description}
                photoPreviewUrls={photoPreviewUrls}
                crewRecommendation={crewRecommendation}
                clientName={clientName}
                onSigned={(sig) => void handleWaiverSigned(sig)}
                onDeclined={() => void handleWaiverDeclined()}
              />
              <button
                type="button"
                onClick={() => setStep("hand_to_client")}
                disabled={submitting}
                className="w-full py-2.5 text-[13px] font-medium border border-[var(--yu3-line)] rounded-xl text-[var(--yu3-ink-muted)] bg-[var(--yu3-bg-surface)] disabled:opacity-50"
              >
                Back (crew view)
              </button>
            </div>
          )}
        </div>
      </Yu3PortaledTokenRoot>
    </div>,
    document.body,
  );
}
