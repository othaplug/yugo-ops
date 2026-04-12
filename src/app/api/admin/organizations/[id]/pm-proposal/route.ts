import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { isPropertyManagementDeliveryVertical } from "@/lib/partner-type";
import jsPDF from "jspdf";

/**
 * POST — generate a branded PDF proposal for a property-management partner (draft/active contract rate card).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id: orgId } = await params;
  const admin = createAdminClient();

  const { data: org } = await admin.from("organizations").select("id, name, type, vertical").eq("id", orgId).single();
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const vertical = String(org.vertical || org.type || "");
  if (!isPropertyManagementDeliveryVertical(vertical)) {
    return NextResponse.json({ error: "Proposal is for property-management partners only" }, { status: 400 });
  }

  let intro = "";
  try {
    const body = await req.json();
    if (typeof body?.intro === "string") intro = body.intro.slice(0, 4000);
  } catch {
    /* optional body */
  }

  const { data: contract } = await admin
    .from("partner_contracts")
    .select("contract_number, rate_card, start_date, end_date, contract_type")
    .eq("partner_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 22;

  doc.setFontSize(16);
  doc.text("Property management partnership proposal", 20, y);
  y += 12;

  doc.setFontSize(11);
  doc.text(`Prepared for: ${org.name || "Partner"}`, 20, y);
  y += 8;
  if (contract?.contract_number) {
    doc.text(`Reference: ${contract.contract_number}`, 20, y);
    y += 8;
  }
  if (contract?.start_date && contract?.end_date) {
    doc.text(`Suggested term: ${contract.start_date} to ${contract.end_date}`, 20, y);
    y += 8;
  }

  y += 6;
  doc.setFontSize(10);
  const about = [
    "We provide fixed-rate renovation and tenant moves with transparent surcharges,",
    "a dedicated partner portal for buildings and units, and real-time move tracking for tenants.",
    "Rates below come from your contract rate card on file.",
  ];
  for (const line of about) {
    doc.text(line, 20, y, { maxWidth: pageW - 40 });
    y += 6;
  }

  if (intro.trim()) {
    y += 4;
    doc.setFontSize(10);
    doc.text("Custom note", 20, y);
    y += 6;
    doc.setFontSize(9);
    doc.text(intro.trim(), 20, y, { maxWidth: pageW - 40 });
    y += 24;
  }

  y += 4;
  doc.setFontSize(11);
  doc.text("Rate overview (contract)", 20, y);
  y += 8;

  doc.setFontSize(8);
  const rc = (contract?.rate_card || {}) as Record<string, unknown>;
  const keys = ["renovation_move_out", "renovation_move_in", "renovation_bundle", "tenant_move_gta", "tenant_move_outside"];
  for (const k of keys) {
    const section = rc[k];
    if (!section || typeof section !== "object") continue;
    doc.setFont("helvetica", "bold");
    doc.text(k.replace(/_/g, " "), 20, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const row = section as Record<string, unknown>;
    const parts = Object.entries(row)
      .map(([uk, val]) => `${uk}: $${val}`)
      .join("   ");
    const lines = doc.splitTextToSize(parts, pageW - 40);
    doc.text(lines, 20, y);
    y += 4 + lines.length * 4;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  y += 8;
  doc.setFontSize(9);
  doc.text("Weekend surcharge, after-hours premium, and holiday surcharge are defined in your rate card JSON.", 20, y, { maxWidth: pageW - 40 });
  y += 12;
  doc.text("Terms: subject to executed agreement. This PDF is a summary for discussion, not a binding contract.", 20, y, { maxWidth: pageW - 40 });
  y += 14;
  doc.text("Signature ________________________________   Date ______________", 20, y);

  const buf = doc.output("arraybuffer");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="yugo-pm-proposal-${orgId.slice(0, 8)}.pdf"`,
    },
  });
}
