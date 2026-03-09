import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePoDPDF } from "@/lib/pdf";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const admin = createAdminClient();

    const { data: pod } = await admin
      .from("proof_of_delivery")
      .select("*")
      .eq("id", id)
      .single();

    if (!pod) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let deliveryNumber = "—";
    let address = "—";
    let partnerName: string | null = null;

    if (pod.delivery_id) {
      const { data: delivery } = await admin
        .from("deliveries")
        .select("delivery_number, delivery_address, organization_id")
        .eq("id", pod.delivery_id)
        .single();
      if (delivery) {
        deliveryNumber = delivery.delivery_number || deliveryNumber;
        address = delivery.delivery_address || address;
        if (delivery.organization_id) {
          const { data: org } = await admin
            .from("organizations")
            .select("name")
            .eq("id", delivery.organization_id)
            .single();
          partnerName = org?.name || null;
        }
      }
    } else if (pod.move_id) {
      const { data: move } = await admin
        .from("moves")
        .select("move_code, delivery_address")
        .eq("id", pod.move_id)
        .single();
      if (move) {
        deliveryNumber = move.move_code || deliveryNumber;
        address = move.delivery_address || address;
      }
    }

    const items = Array.isArray(pod.item_conditions) ? pod.item_conditions : [];

    const doc = generatePoDPDF({
      deliveryNumber,
      date: pod.completed_at ? new Date(pod.completed_at).toLocaleString("en-US", {
        month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
      }) : "—",
      address,
      gpsLat: pod.gps_lat,
      gpsLng: pod.gps_lng,
      crewMembers: pod.crew_members || [],
      partnerName,
      items: items.map((ic: Record<string, string>) => ({
        name: ic.item_name || "Item",
        condition: ic.condition || "pristine",
        notes: ic.notes || "",
      })),
      signerName: pod.signer_name || "—",
      signedAt: pod.signed_at ? new Date(pod.signed_at).toLocaleString("en-US", {
        month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
      }) : "—",
      satisfactionRating: pod.satisfaction_rating,
      satisfactionComment: pod.satisfaction_comment,
      signatureDataUrl: pod.signature_data,
    });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="PoD-${deliveryNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/pod/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
