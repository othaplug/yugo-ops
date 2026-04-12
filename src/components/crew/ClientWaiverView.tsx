"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WaiverCategory } from "@/lib/waivers/waiver-categories";
import { useSignaturePad } from "@/hooks/useSignaturePad";
import YugoLogo from "@/components/YugoLogo";
import {
  CREAM,
  FOREST_BODY,
  FOREST_MUTED,
  QUOTE_EYEBROW_CLASS,
  WINE,
} from "@/app/quote/[quoteId]/quote-shared";

export type CrewRecommendation = "proceed_with_caution" | "do_not_recommend";

export type ClientWaiverViewProps = {
  category: WaiverCategory;
  itemName: string;
  description: string;
  photoPreviewUrls: string[];
  crewRecommendation: CrewRecommendation | null;
  clientName: string;
  onSigned: (signatureDataUrl: string) => void;
  onDeclined: () => void;
};

export const ClientWaiverView = ({
  category,
  itemName,
  description,
  photoPreviewUrls,
  crewRecommendation,
  clientName,
  onSigned,
  onDeclined,
}: ClientWaiverViewProps) => {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { startDrawing, draw, stopDrawing, clear, hasSignature } =
    useSignaturePad(canvasRef);

  const layoutCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = containerRef.current;
    if (!canvas || !wrap) return;
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const w = wrap.clientWidth;
    const h = 160;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    layoutCanvas();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => layoutCanvas())
        : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);
    return () => {
      ro?.disconnect();
    };
  }, [layoutCanvas]);

  const handleClearSignature = () => {
    clear();
    layoutCanvas();
  };

  const handleSignConfirm = () => {
    if (!agreedToTerms || !hasSignature()) return;
    const data = canvasRef.current?.toDataURL("image/png");
    if (!data || !data.includes("base64")) return;
    onSigned(data);
  };

  const risks =
    category.risks.length > 0
      ? category.risks
      : [
          "Additional risks may apply based on the situation your crew described. Proceed only if you accept responsibility for those risks.",
        ];

  return (
    <div
      className="rounded-xl overflow-hidden -mx-1 sm:mx-0"
      style={{ backgroundColor: CREAM, color: FOREST_BODY }}
    >
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col items-center text-center mb-8">
          <YugoLogo size={34} variant="wine" onLightBackground className="mb-4" />
          <p
            className={`${QUOTE_EYEBROW_CLASS} text-[11px] leading-none`}
            style={{ color: FOREST_MUTED }}
          >
            Service acknowledgment
          </p>
        </div>

        <div className="mb-6">
          <p className="text-[13px] sm:text-sm leading-relaxed" style={{ color: FOREST_BODY }}>
            Your Yugo crew has identified a condition that may affect the safe
            handling of an item or property during your move. Please read the
            details below carefully.
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 mb-4 border border-[#2C3E2D]/12 shadow-[0_2px_12px_rgba(44,62,45,0.06)]">
          <p className={`${QUOTE_EYEBROW_CLASS} text-[10px] mb-1`} style={{ color: FOREST_MUTED }}>
            Item
          </p>
          <p className="text-[13px] sm:text-sm font-medium" style={{ color: FOREST_BODY }}>
            {itemName}
          </p>

          <p className={`${QUOTE_EYEBROW_CLASS} text-[10px] mt-3 mb-1`} style={{ color: FOREST_MUTED }}>
            Condition identified
          </p>
          <p className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap" style={{ color: FOREST_BODY }}>
            {description}
          </p>

          <p className={`${QUOTE_EYEBROW_CLASS} text-[10px] mt-3 mb-1`} style={{ color: FOREST_MUTED }}>
            Category
          </p>
          <p className="text-[13px] sm:text-sm" style={{ color: FOREST_BODY }}>
            {category.label}
          </p>
        </div>

        {photoPreviewUrls.length > 0 && (
          <div className="mb-4">
            <p className={`${QUOTE_EYEBROW_CLASS} text-[10px] mb-2`} style={{ color: FOREST_MUTED }}>
              Photos taken by crew
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photoPreviewUrls.map((src, i) => (
                <img
                  key={src.slice(0, 40) + i}
                  src={src}
                  alt={`Condition photo ${i + 1}`}
                  className="w-20 h-20 shrink-0 object-cover rounded-lg border border-[#2C3E2D]/15"
                />
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg p-4 mb-4 border border-amber-200 bg-amber-50">
          <p className="text-[10px] uppercase tracking-wider text-amber-800 mb-2 font-medium">
            Potential risks
          </p>
          <ul className="space-y-1.5 list-disc pl-4">
            {risks.map((risk, i) => (
              <li
                key={i}
                className="text-[13px] sm:text-sm text-amber-900 leading-relaxed"
              >
                {risk}
              </li>
            ))}
          </ul>
        </div>

        {crewRecommendation === "do_not_recommend" && (
          <div className="rounded-lg p-4 mb-4 border border-red-200 bg-red-50">
            <p className="text-[10px] uppercase tracking-wider text-red-700 mb-1 font-medium">
              Crew recommendation
            </p>
            <p className="text-[13px] sm:text-sm text-red-800 leading-relaxed">
              Your crew does not recommend proceeding with this item under these
              conditions. They believe there is a significant risk of damage.
              However, the final decision is yours.
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg p-4 mb-6 border border-[#2C3E2D]/12 shadow-[0_2px_12px_rgba(44,62,45,0.06)]">
          <p className={`${QUOTE_EYEBROW_CLASS} text-[10px] mb-2`} style={{ color: FOREST_MUTED }}>
            By signing below, you acknowledge
          </p>
          <div className="space-y-2.5 text-[13px] sm:text-sm leading-relaxed" style={{ color: FOREST_BODY }}>
            <p>
              1. I have been informed by the Yugo crew of the condition
              described above and the associated risks.
            </p>
            <p>
              2. I understand that proceeding with the handling, disassembly,
              transport, or reassembly of this item under these conditions may
              result in damage to the item, the property, or both.
            </p>
            <p>
              3. I choose to proceed despite these risks and release HELLOYUGO
              Inc. and its crew from liability for any damage directly
              resulting from the condition described above.
            </p>
            <p>
              4. This waiver applies only to the specific item and condition
              described. All other items and services remain covered under the
              standard terms of my move agreement.
            </p>
            <p>
              5. Photos documenting the condition have been taken before any
              handling.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-1 shrink-0"
            style={{ accentColor: WINE }}
            aria-describedby="waiver-ack-text"
          />
          <span
            id="waiver-ack-text"
            className="text-[13px] sm:text-sm leading-relaxed"
            style={{ color: FOREST_BODY }}
          >
            I have read and understood the above. I wish to proceed with full
            knowledge of the risks described.
          </span>
        </label>

        <div className="mb-6">
          <p className={`${QUOTE_EYEBROW_CLASS} text-[10px] mb-2`} style={{ color: FOREST_MUTED }}>
            Your signature
          </p>
          <div
            ref={containerRef}
            className="bg-white border-2 border-[#2C3E2D]/22 rounded-lg overflow-hidden w-full"
            style={{ touchAction: "none" }}
          >
            <canvas
              ref={canvasRef}
              className="w-full block"
              style={{ maxHeight: 160 }}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>
          <div className="flex justify-between items-center mt-1 gap-2">
            <p className="text-[10px] shrink-0" style={{ color: FOREST_MUTED }}>
              Sign with your finger or stylus
            </p>
            <button
              type="button"
              onClick={handleClearSignature}
              className="text-[10px] font-medium shrink-0"
              style={{ color: WINE }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-[10px] mb-1" style={{ color: FOREST_MUTED }}>
              Name
            </p>
            <p className="text-[13px] sm:text-sm font-medium" style={{ color: FOREST_BODY }}>
              {clientName}
            </p>
          </div>
          <div>
            <p className="text-[10px] mb-1" style={{ color: FOREST_MUTED }}>
              Date
            </p>
            <p className="text-[13px] sm:text-sm font-medium" style={{ color: FOREST_BODY }}>
              {new Date().toLocaleDateString("en-CA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSignConfirm}
            disabled={!agreedToTerms || !hasSignature()}
            className="w-full py-3.5 rounded-lg text-[13px] sm:text-sm font-medium disabled:opacity-30 text-[#FFFBF7]"
            style={{ backgroundColor: WINE }}
          >
            I agree, proceed with the move
          </button>

          <button
            type="button"
            onClick={onDeclined}
            className="w-full py-3 text-[13px] sm:text-sm rounded-lg bg-white border-2 border-[#2C3E2D]/35"
            style={{ color: FOREST_BODY }}
          >
            I do not want to proceed with this item
          </button>

          <p className="text-[10px] text-center leading-relaxed" style={{ color: FOREST_MUTED }}>
            If you choose not to proceed, the crew will skip this item and
            continue with the rest of your move. No charge applies for the
            skipped item.
          </p>
        </div>
      </div>
    </div>
  );
}
