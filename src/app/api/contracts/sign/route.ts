import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import jsPDF from "jspdf";
import {
  WINE,
  GOLD,
  DARK,
  GRAY,
  GRAY_LIGHT,
  drawYugoHeader,
  drawYugoFooter,
  drawTopAccentBar,
  drawBottomAccentBar,
  setSectionLabel,
  setBodyText,
  setHeroTitle,
} from "@/lib/pdf-brand";
import { getCompanyDisplayName, getCompanyLegalName } from "@/lib/config";

interface ContractAddonData {
  name: string;
  price: number;
  quantity?: number;
}

interface BinRentalSchedulePdf {
  delivery_date: string | null;
  delivery_address: string;
  move_date: string | null;
  pickup_date: string | null;
  pickup_address: string;
  cycle_days: number;
}

interface ContractStopPdf {
  address: string;
  access_line: string | null;
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
  bin_rental_schedule?: BinRentalSchedulePdf;
  /** When present with length > 1, PDF lists each pickup instead of a single From line. */
  pickup_stops?: ContractStopPdf[];
  dropoff_stops?: ContractStopPdf[];
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
  bin_rental:
    "Full refund if cancelled 48+ hours before scheduled bin delivery. Fees may apply within 48 hours or after dispatch/delivery.",
};

const BALANCE_DUE_TEXT: Record<string, string> = {
  local_move: "48 hours before move date",
  long_distance: "before departure date",
  office_move: "per agreed phasing schedule",
  single_item: "upon delivery",
  white_glove: "upon delivery",
  specialty: "upon project completion",
  b2b_oneoff: "upon delivery",
  bin_rental: "included in full payment at booking",
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

function fmtPdfLongDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function generateContractPdf(
  payload: ContractSignPayload,
  ipAddress: string,
  signedAt: string,
  companyLegalName: string,
  companyDisplayName: string,
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cd = payload.contract_data;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const centerX = pageWidth / 2;

  drawTopAccentBar(doc, true);
  let y = drawYugoHeader(doc, { yStart: 18, centerX, margin });
  setHeroTitle(doc, 14);
  doc.text(
    cd.service_type === "bin_rental" ? "Bin Rental Agreement" : "Service Agreement",
    centerX,
    y,
    { align: "center" },
  );
  y += 10;

  setBodyText(doc, 10);
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

  setSectionLabel(doc, 12);
  doc.text("Service Summary", margin, y);
  y += 8;
  setBodyText(doc, 10);

  const svcLabel = cd.service_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const brs = cd.bin_rental_schedule;
  const multiPick = cd.pickup_stops && cd.pickup_stops.length > 1;
  const multiDrop = cd.dropoff_stops && cd.dropoff_stops.length > 1;
  const summaryLines =
    cd.service_type === "bin_rental" && brs
      ? [
          `Service: Bin rental \u2014 ${cd.package_label}`,
          ...(brs.delivery_date
            ? [`Bin delivery: ${fmtPdfLongDate(brs.delivery_date)} \u2192 ${brs.delivery_address}`]
            : []),
          ...(brs.move_date ? [`Move day (reference): ${fmtPdfLongDate(brs.move_date)}`] : []),
          ...(brs.pickup_date
            ? [`Bin pickup: ${fmtPdfLongDate(brs.pickup_date)} \u2190 ${brs.pickup_address}`]
            : []),
          `Included rental cycle: ${brs.cycle_days} days`,
          `Rental package (before tax): ${fmtCurrency(cd.base_price)}`,
        ]
      : [
          `Service: ${svcLabel} \u2014 ${cd.package_label}`,
          ...(multiPick
            ? cd.pickup_stops!.flatMap((s, i) => {
                const acc = s.access_line ? ` (Access: ${s.access_line})` : "";
                return [`Pickup ${i + 1}: ${s.address}${acc}`];
              })
            : [`From: ${cd.from_address}`]),
          ...(multiDrop
            ? cd.dropoff_stops!.flatMap((s, i) => {
                const acc = s.access_line ? ` (Access: ${s.access_line})` : "";
                return [`Destination ${i + 1}: ${s.address}${acc}`];
              })
            : [`To: ${cd.to_address}`]),
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

  if (cd.addons?.length > 0) {
    y += 3;
    setSectionLabel(doc, 10);
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

  y += 5;
  setSectionLabel(doc, 12);
  doc.text("Financial Summary", margin, y);
  y += 8;
  setBodyText(doc, 10);
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
  const balanceAmt = cd.grand_total - cd.deposit;
  if (balanceAmt <= 0.005) {
    doc.text(`Balance: ${fmtCurrency(0)} (full payment at booking)`, margin, y);
  } else {
    doc.text(
      `Balance: ${fmtCurrency(balanceAmt)} (due ${balDue})`,
      margin,
      y,
    );
  }
  y += 12;

  /* ── Terms & Conditions ── */
  const checkPageBreak = () => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  };

  setSectionLabel(doc, 12);
  doc.text("Terms & Conditions", margin, y);
  y += 8;
  setBodyText(doc, 9);

  const terms =
    cd.service_type === "bin_rental"
      ? [
          {
            title: "1. Bin rental service",
            body: "Plastic moving bin rental: delivery of bins, use during the included rental period, and scheduled pickup of emptied and stacked bins, as described in your quote.",
          },
          {
            title: "2. Quoted fee",
            body: `Total ${fmtCurrency(cd.grand_total)} incl. HST covers the rental package in your quote. This is a rental service, not a staffed residential move unless separately contracted.`,
          },
          {
            title: "3. Payment",
            body: `Full payment of ${fmtCurrency(cd.grand_total)} incl. HST is due at booking unless your coordinator confirms otherwise in writing.`,
          },
          {
            title: "4. Card on file",
            body: `I authorize ${companyLegalName} to keep a card on file for approved charges such as late returns, extra rental days, or missing/damaged bins.`,
          },
          {
            title: "5. Cancellation",
            body: CANCELLATION_TEXT.bin_rental,
          },
          {
            title: "6. Bins & liability",
            body: "Bins remain company property. Reasonable fees may apply for loss, damage, or late return. Contents you pack are your responsibility unless separate moving coverage applies.",
          },
        ]
      : [
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
            body: `I authorize ${companyLegalName} to securely store my payment card using Square's PCI-compliant vault and charge the balance per payment terms.`,
          },
          {
            title: "4. Cancellation Policy",
            body: CANCELLATION_TEXT[cd.service_type] ?? CANCELLATION_TEXT.local_move,
          },
          {
            title: "5. Liability & Insurance",
            body: "Standard coverage at $0.60/lb per article. Enhanced full-value protection available as add-on. Yugo carries $2M commercial liability insurance.",
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

  checkPageBreak();
  y += 5;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  setSectionLabel(doc, 12);
  doc.text("Electronic Signature", margin, y);
  y += 8;
  setBodyText(doc, 10);
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
  doc.setTextColor(...GRAY);
  doc.text(
    "This document is a legally binding agreement under the Ontario Electronic Commerce Act, 2000.",
    pageWidth / 2,
    285,
    { align: "center" },
  );

  drawYugoFooter(doc, { y: 282 });
  drawBottomAccentBar(doc, true);
  return Buffer.from(doc.output("arraybuffer"));
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`contract:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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
      const [companyLegalName, companyDisplayName] = await Promise.all([
        getCompanyLegalName(),
        getCompanyDisplayName(),
      ]);
      const pdfBuffer = generateContractPdf(
        { quote_id, typed_name, agreement_version, user_agent: user_agent ?? "", contract_data },
        ipAddress,
        signedAt,
        companyLegalName,
        companyDisplayName,
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
