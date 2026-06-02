"use client";

/**
 * Canvas-drawn signature input — no external dependencies (no
 * react-signature-canvas etc.). The user draws with mouse, touch, or
 * pen pointer; the component reports a PNG data URL via onChange when
 * the stroke ends, and reports `null` whenever the canvas is cleared.
 *
 * Used alongside the typed legal name in the Reserve Your Date step.
 * Both are required to enable "Sign & Continue" — typed name supports
 * the legal claim of intent + identity; drawn signature provides the
 * visual signature that goes on the contract PDF and audit trail.
 *
 * Resolution: the canvas internal pixel size is 2× the CSS size so the
 * stroke stays crisp on Retina displays. Stroke width tuned for ink-pen
 * feel without being too heavy on small signatures.
 *
 * Accessibility: keyboard users can press the Clear button. Empty
 * canvas reads as "Signature canvas — draw to sign" for screen readers.
 */

import * as React from "react";

type Point = { x: number; y: number };

type Props = {
  /** Called with a base64 PNG data URL each time the user finishes a stroke;
   *  called with null when the canvas is cleared. */
  onChange: (dataUrl: string | null) => void;
  /** Visible CSS height of the canvas (px). Internal pixels are 2× for retina. */
  height?: number;
  /** Ink colour. Defaults to a deep forest that prints well in B&W. */
  inkColor?: string;
  /** Optional disable flag (e.g. while submitting). */
  disabled?: boolean;
  /** Optional value used to clear externally (e.g. after submit success). */
  resetSignal?: number;
};

export default function SignaturePad({
  onChange,
  height = 140,
  inkColor = "#2C3E2D",
  disabled = false,
  resetSignal,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);
  const lastPointRef = React.useRef<Point | null>(null);
  const hasStrokesRef = React.useRef(false);
  const [hasSignature, setHasSignature] = React.useState(false);

  /** Resize the canvas's internal pixel buffer to match CSS size × 2 (retina). */
  const resizeCanvas = React.useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2;
  }, [inkColor]);

  React.useEffect(() => {
    resizeCanvas();
    const handle = () => resizeCanvas();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [resizeCanvas]);

  /** External reset (parent flips resetSignal). */
  React.useEffect(() => {
    if (resetSignal === undefined) return;
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = pointFromEvent(e);
    lastPointRef.current = p;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y); // tiny segment so a single tap leaves a dot
    ctx.stroke();
    hasStrokesRef.current = true;
    if (!hasSignature) setHasSignature(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = pointFromEvent(e);
    const last = lastPointRef.current;
    if (!last) return;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    if (hasStrokesRef.current) {
      const c = canvasRef.current;
      if (c) onChange(c.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    hasStrokesRef.current = false;
    setHasSignature(false);
    onChange(null);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={
          hasSignature
            ? "Signed — signature captured"
            : "Signature canvas — draw to sign"
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          width: "100%",
          height,
          touchAction: "none",
          cursor: disabled ? "not-allowed" : "crosshair",
          backgroundColor: "#FFFFFF",
          borderRadius: 0,
          border: `1px solid ${hasSignature ? inkColor : "#D5D0C8"}`,
          display: "block",
        }}
      />
      {!hasSignature && (
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] tracking-[0.12em] uppercase opacity-50"
          style={{ color: inkColor }}
        >
          Sign here
        </span>
      )}
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-[10px] text-[var(--tx2)] opacity-70">
          Use your mouse, finger, or pen to sign above.
        </p>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasSignature}
          className="text-[10px] uppercase tracking-wider font-semibold underline-offset-2 hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: inkColor }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
