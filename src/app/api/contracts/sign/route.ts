import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import jsPDF from "jspdf";

interface ContractAddonData {
  name: string;
  price: number;
  quantity?: number;
}

interface ContractData {
  service_type: string;
  package_label: string;
  from_address: string;
  to_address: string;
  move_date: string | null;
  base_price: number;
  addons: ContractAddonData[];
  addon_total: number;
  total_before_tax: number;
  tax: number;
  grand_total: number;
  deposit: number;
}

interface ContractSignPayload {
  quote_id: string;
  typed_name: string;
  agreement_version: string;
  user_agent: string;
  contract_data: ContractData;
}

const CANCELLATION_TEXT: Record<string, string> = {
  local_move:
    "Full refund if cancelled 48+ hours before move. Non-refundable within 48 hours.",
  long_distance:
    "Full refund if cancelled 72+ hours before move. Non-refundable within 72 hours.",
  office_move:
    "Full refund if cancelled 72+ hours before relocation. Non-refundable within 72 hours.",
  single_item:
    "Full refund if cancelled 24+ hours before delivery. Non-refundable within 24 hours.",
  white_glove:
    "Full refund if cancelled 48+ hours before delivery. Non-refundable within 48 hours.",
  specialty:
    "72-hour cancellation policy. Custom crating materials non-refundable.",
  b2b_oneoff:
    "Full refund if cancelled 24+ hours before delivery. Non-refundable within 24 hours.",
};

const BALANCE_DUE_TEXT: Record<string, string> = {
  local_move: "48 hours before move date",
  long_distance: "before departure date",
  office_move: "per agreed phasing schedule",
  single_item: "upon delivery",
  white_glove: "upon delivery",
  specialty: "upon project completion",
  b2b_oneoff: "upon delivery",
};

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-CA");
}

function generateContractPdf(
  payload: ContractSignPayload,
  ipAddress: string,
  signedAt: string,
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cd = payload.contract_data;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("YUGO", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Premium Moving Services \u2022 Toronto & GTA", pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setDrawColor(184, 150, 46);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Service Agreement", pageWidth / 2, y, { align: "center" });
  y += 12;

  doc.setFontSize(10);
  doc.text(`Quote: ${payload.quote_id}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Date: ${new Date(signedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}`,
    pageWidth - margin,
    y,
    { align: "right" },
  );
  y += 6;
  doc.text(`Client: ${payload.typed_name}`, margin, y);
  y += 10;

  /* ── Service Summary ── */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Service Summary", margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const svcLabel = cd.service_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const summaryLines = [
    `Service: ${svcLabel} \u2014 ${cd.package_label}`,
    `From: ${cd.from_address}`,
    `To: ${cd.to_address}`,
    ...(cd.move_date
      ? [
          `Date: ${new Date(cd.move_date + "T00:00:00").toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
        ]
      : []),
    `Base Rate: ${fmtCurrency(cd.base_price)}`,
  ];

  for (const line of summaryLines) {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
  }

  /* ── Add-ons ── */
  if (cd.addons?.length > 0) {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.text("Add-ons:", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    for (const addon of cd.addons) {
      const qtyStr = addon.quantity && addon.quantity > 1 ? ` \u00d7${addon.quantity}` : "";
      doc.text(`  \u2022 ${addon.name}${qtyStr}: ${fmtCurrency(addon.price)}`, margin, y);
      y += 5;
    }
    doc.setFont("helvetica", "bold");
    doc.text(`  Add-on Subtotal: ${fmtCurrency(cd.addon_total)}`, margin, y);
    doc.setFont("helvetica", "normal");
    y += 3;
  }

  /* ── Financial Summary ── */
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Financial Summary", margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Before Tax: ${fmtCurrency(cd.total_before_tax)}`, margin, y);
  y += 5;
  doc.text(`HST (13%): ${fmtCurrency(cd.tax)}`, margin, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Grand Total: ${fmtCurrency(cd.grand_total)}`, margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Deposit: ${fmtCurrency(cd.deposit)}`, margin, y);
  y += 5;

  const balDue = BALANCE_DUE_TEXT[cd.service_type] ?? "before service date";
  doc.text(
    `Balance: ${fmtCurrency(cd.grand_total - cd.deposit)} (due ${balDue})`,
    margin,
    y,
  );
  y += 12;

  /* ── Terms & Conditions ── */
  const checkPageBreak = () => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Terms & Conditions", margin, y);
  y += 8;
  doc.setFontSize(9);

  const terms = [
    {
      title: "1. Flat-Rate Guarantee",
      body: `The total quoted above (${fmtCurrency(cd.grand_total)} incl. HST) is a guaranteed flat rate. No hidden charges, hourly rates, or surprise fees.`,
    },
    {
      title: "2. Payment Terms",
      body: `A deposit of ${fmtCurrency(cd.deposit)} is due at booking. The remaining balance of ${fmtCurrency(cd.grand_total - cd.deposit)} is due ${balDue}.`,
    },
    {
      title: "3. Card-on-File Authorization",
      body: "I authorize YUGO Moving Inc. to securely store my payment card using Square's PCI-compliant vault and charge the balance per payment terms.",
    },
    {
      title: "4. Cancellation Policy",
      body: CANCELLATION_TEXT[cd.service_type] ?? CANCELLATION_TEXT.local_move,
    },
    {
      title: "5. Liability & Insurance",
      body: "Standard coverage at $0.60/lb per article. Enhanced full-value protection available as add-on. YUGO carries $2M commercial liability insurance.",
    },
    {
      title: "6. Scope Changes",
      body: "Changes to scope will be communicated and require written approval before additional charges.",
    },
  ];

  for (const term of terms) {
    checkPageBreak();
    doc.setFont("helvetica", "bold");
    doc.text(term.title, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(term.body, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  /* ── Signature Block ── */
  checkPageBreak();
  y += 5;
  doc.setDrawColor(184, 150, 46);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Electronic Signature", margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Signed by: ${payload.typed_name}`, margin, y);
  y += 6;
  doc.text(
    `Date: ${new Date(signedAt).toLocaleString("en-CA")}`,
    margin,
    y,
  );
  y += 6;
  doc.text(`IP Address: ${ipAddress}`, margin, y);
  y += 6;
  doc.text(`Agreement Version: ${payload.agreement_version}`, margin, y);
  y += 6;

  const ua = payload.user_agent ?? "unknown";
  const uaLines = doc.splitTextToSize(`User Agent: ${ua}`, contentWidth);
  doc.text(uaLines, margin, y);

  doc.setFontSize(7);
  doc.setTextColor(128, 128, 128);
  doc.text(
    "This document is a legally binding agreement under the Ontario Electronic Commerce Act, 2000.",
    pageWidth / 2,
    285,
    { align: "center" },
  );

  return Buffer.from(doc.output("arraybuffer"));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ContractSignPayload>;
    const { quote_id, typed_name, agreement_version, user_agent, contract_data } = body;

    if (!quote_id || !typed_name || !agreement_version || !contract_data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ipAddress = getClientIp(req);
    const signedAt = new Date().toISOString();
    const supabase = createAdminClient();

    /* 1. Verify quote exists */
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, quote_id, status")
      .eq("quote_id", quote_id)
      .single();

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    /* 2. Store contract_signed event */
    await supabase.from("quote_events").insert({
      quote_id,
      event_type: "contract_signed",
      metadata: {
        typed_name,
        agreement_version,
        ip_address: ipAddress,
        user_agent: user_agent ?? "unknown",
        signed_at: signedAt,
        grand_total: contract_data.grand_total,
        deposit: contract_data.deposit,
        package_label: contract_data.package_label,
      },
    });

    /* 3. Generate contract PDF */
    let pdfUrl: string | null = null;
    try {
      const pdfBuffer = generateContractPdf(
        { quote_id, typed_name, agreement_version, user_agent: user_agent ?? "", contract_data },
        ipAddress,
        signedAt,
      );

      const filePath = `contracts/${quote_id}/agreement-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("move-documents")
        .upload(filePath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("move-documents")
          .getPublicUrl(filePath);
        pdfUrl = urlData?.publicUrl ?? null;
      } else {
        console.error("[contract-pdf] Upload failed:", uploadError.message);
      }
    } catch (pdfErr) {
      console.error("[contract-pdf] Generation failed:", pdfErr);
    }

    return NextResponse.json({
      success: true,
      signed_at: signedAt,
      pdf_url: pdfUrl,
    });
  } catch (e) {
    console.error("[contracts/sign] Error:", e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
