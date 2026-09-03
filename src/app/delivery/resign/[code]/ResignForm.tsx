"use client";

import { useRef, useState } from "react";

interface Props {
  deliveryId: string;
  deliveryNumber: string;
  recipientName: string;
  deliveryAddress: string;
  businessName: string | null;
  scheduledDate: string | null;
  token: string;
  alreadySigned: boolean;
}

export default function ResignForm({
  deliveryId,
  deliveryNumber,
  recipientName,
  deliveryAddress,
  businessName,
  scheduledDate,
  token,
  alreadySigned,
}: Props) {
  const [name, setName] = useState(recipientName || "");
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(alreadySigned);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = "#1a1310";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setSignature(canvas.toDataURL("image/png"));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignature("");
  };

  const submit = async () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas?.toDataURL("image/png") || signature;
    if (!name.trim() || !dataUrl) {
      setError("Please enter your name and sign above.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/public/delivery-resign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryId,
          token,
          signedBy: name.trim(),
          signatureDataUrl: dataUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Connection error. Please try again.");
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <main style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px" }}>
        <h1 style={{ fontFamily: "serif", fontSize: 28, marginBottom: 12 }}>Thank you</h1>
        <p style={{ color: "#7a6e67", lineHeight: 1.55 }}>
          Your signature for delivery {deliveryNumber} has been recorded. You can close this window.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 64px" }}>
      <p
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#7a6e67",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        Yugo · Delivery sign-off
      </p>
      <h1 style={{ fontFamily: "serif", fontSize: 30, margin: "0 0 8px", color: "#2B0416" }}>
        Sign for delivery {deliveryNumber}
      </h1>
      <p style={{ color: "#7a6e67", lineHeight: 1.55, marginBottom: 24, fontSize: 14 }}>
        Our crew asked you to sign on their device at drop-off but the connection was interrupted. Please re-sign below so we can close out the delivery.
      </p>

      <div
        style={{
          background: "#F9EDE4",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 20,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <div>
          <strong>Delivery:</strong> {deliveryNumber}
        </div>
        {businessName && (
          <div>
            <strong>From:</strong> {businessName}
          </div>
        )}
        <div>
          <strong>To:</strong> {deliveryAddress}
        </div>
        {scheduledDate && (
          <div>
            <strong>Date:</strong> {scheduledDate}
          </div>
        )}
      </div>

      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        Your full name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #d8cabe",
          fontSize: 15,
          marginBottom: 20,
        }}
        autoComplete="name"
      />

      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        Signature
      </label>
      <div
        style={{
          border: "1px solid #d8cabe",
          borderRadius: 8,
          background: "#fff",
          padding: 8,
          marginBottom: 8,
        }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={220}
          style={{ width: "100%", height: 220, touchAction: "none", display: "block" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <button
        type="button"
        onClick={clearSignature}
        style={{
          background: "transparent",
          border: "none",
          color: "#66143D",
          fontSize: 12,
          fontWeight: 600,
          padding: 0,
          marginBottom: 20,
          cursor: "pointer",
        }}
      >
        Clear signature
      </button>

      {error && (
        <p style={{ color: "#a3181d", fontSize: 13, marginBottom: 12 }}>{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        style={{
          width: "100%",
          padding: "14px 18px",
          borderRadius: 10,
          border: "none",
          background: "#2B0416",
          color: "#F9EDE4",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? "Submitting…" : "Submit signature"}
      </button>
    </main>
  );
}
