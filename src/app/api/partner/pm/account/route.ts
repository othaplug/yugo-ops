import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { contractHasRateMatrix } from "@/lib/partners/pm-contract-rate";
import { pmRateCardReasonRowVisible } from "@/lib/partners/pm-portal-move-types";

const DEFAULT_COORDINATOR_EMAIL = "partners@helloyugo.com";
const DEFAULT_COORDINATOR_PHONE = "(289) 306-0583";

function coordinatorFromOrg(org: {
  partner_coordinator_name?: string | null;
  partner_coordinator_email?: string | null;
  partner_coordinator_phone?: string | null;
} | null) {
  const name = String(org?.partner_coordinator_name || "").trim();
  if (!name) {
    return {
      assigned: false as const,
      name: null as string | null,
      email: DEFAULT_COORDINATOR_EMAIL,
      phone: DEFAULT_COORDINATOR_PHONE,
      initials: "YG",
    };
  }
  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
      : name.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, "") || "YG";
  return {
    assigned: true as const,
    name,
    email: String(org?.partner_coordinator_email || "").trim() || DEFAULT_COORDINATOR_EMAIL,
    phone: String(org?.partner_coordinator_phone || "").trim() || DEFAULT_COORDINATOR_PHONE,
    initials,
  };
}

/** Company, contract, rate matrix summary, portal users for PM account tab. */
export async function GET() {
  const { orgIds, userId, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const admin = createAdminClient();

  const [{ data: org }, { data: contract }] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "name, legal_name, contact_name, email, phone, address, billing_email, vertical, type, partner_coordinator_name, partner_coordinator_email, partner_coordinator_phone",
      )
      .eq("id", orgId)
      .single(),
    admin
      .from("partner_contracts")
      .select(
        "id, contract_number, contract_type, start_date, end_date, auto_renew, rate_card, status, pdf_url, payment_terms, tenant_comms_by",
      )
      .eq("partner_id", orgId)
      .in("status", ["active", "negotiating", "proposed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const vertical = (org?.vertical as string | null | undefined) ?? null;

  const hasMatrix = contract?.id ? await contractHasRateMatrix(admin, contract.id as string) : false;

  let rateCardRows: {
    reasonCode: string;
    type: string;
    studio: string;
    oneBr: string;
    twoBr: string;
    threeBr: string;
  }[] = [];

  if (contract?.id && hasMatrix) {
    const { data: matrix } = await admin
      .from("pm_rate_cards")
      .select("reason_code, unit_size, zone, base_rate")
      .eq("contract_id", contract.id as string)
      .eq("active", true)
      .eq("zone", "local");

    const { data: reasonRows } = await admin.from("pm_move_reasons").select("reason_code, label").is("partner_id", null);

    const labelByCode: Record<string, string> = {};
    for (const r of reasonRows ?? []) labelByCode[r.reason_code as string] = r.label as string;

    const byReason = new Map<string, Record<string, number>>();
    for (const row of matrix ?? []) {
      const rc = row.reason_code as string;
      const sz = String(row.unit_size || "").toLowerCase();
      if (!byReason.has(rc)) byReason.set(rc, {});
      const bucket = byReason.get(rc)!;
      bucket[sz] = Number(row.base_rate) || 0;
    }

    rateCardRows = [...byReason.entries()]
      .filter(([code]) => pmRateCardReasonRowVisible(code, vertical))
      .map(([code, bucket]) => ({
        reasonCode: code,
        type: labelByCode[code] || code.replace(/_/g, " "),
        studio: String(bucket.studio ?? "—"),
        oneBr: String(bucket["1br"] ?? "—"),
        twoBr: String(bucket["2br"] ?? "—"),
        threeBr: String(bucket["3br"] ?? "—"),
      }));
  } else if (contract?.rate_card && typeof contract.rate_card === "object") {
    const card = contract.rate_card as Record<string, unknown>;
    const keys = Object.keys(card).filter((k) => !["weekend", "holiday", "after_hours"].includes(k));
    rateCardRows = keys
      .slice(0, 12)
      .filter((k) => pmRateCardReasonRowVisible(k, vertical))
      .map((k) => ({
        reasonCode: k,
        type: k.replace(/_/g, " "),
        studio: "—",
        oneBr: "—",
        twoBr: "—",
        threeBr: "—",
      }));
  }

  const { data: partnerUsers } = await admin.from("partner_users").select("user_id, created_at").eq("org_id", orgId);

  const portalUsers: { id: string; name: string; email: string; status: string }[] = [];
  for (const pu of partnerUsers ?? []) {
    const uid = pu.user_id as string;
    const { data: authUser } = await admin.auth.admin.getUserById(uid);
    const email = authUser?.user?.email ?? "";
    const name =
      (authUser?.user?.user_metadata?.full_name as string) ||
      (authUser?.user?.user_metadata?.name as string) ||
      email.split("@")[0] ||
      "User";
    portalUsers.push({
      id: uid,
      name,
      email,
      status: "active",
    });
  }

  const coordinator = coordinatorFromOrg(org);

  return NextResponse.json({
    company: {
      name: org?.legal_name || org?.name || "",
      contactName: org?.contact_name || "",
      email: org?.email || org?.billing_email || "",
      phone: org?.phone || "",
      address: org?.address || "",
    },
    vertical,
    contract: contract
      ? {
          id: contract.id,
          contract_number: contract.contract_number,
          contract_type: contract.contract_type,
          start_date: contract.start_date,
          end_date: contract.end_date,
          auto_renew: contract.auto_renew,
          pdf_url: contract.pdf_url,
          tenant_comms_by: contract.tenant_comms_by,
        }
      : null,
    contractTypeLabel:
      contract?.contract_type === "per_move"
        ? "Per move"
        : contract?.contract_type === "fixed_rate"
          ? "Fixed rate"
          : contract?.contract_type === "day_rate_retainer"
            ? "Day-rate retainer"
            : contract?.contract_type || "",
    rateCard: rateCardRows,
    portalUsers,
    currentUserId: userId,
    coordinator,
  });
}
