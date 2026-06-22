import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { logActivity } from "@/lib/activity";
import { EMAIL_FOREST, EMAIL_PREMIUM_PAGE } from "@/lib/email/email-brand-tokens";

export async function generateInstallPhotoReport(projectId: string): Promise<void> {
  const db = createAdminClient();

  const { data: project } = await db
    .from("projects")
    .select(
      `
      *,
      organizations:partner_id(name, type),
      project_inventory(item_name, quantity, room_destination, delivery_photo_url, pickup_photo_url, condition_on_receipt)
    `,
    )
    .eq("id", projectId)
    .single();

  if (!project) return;

  const org = project.organizations as { name: string; email?: string } | null;
  // Look up partner contact email
  const { data: orgFull } = await db
    .from("organizations")
    .select("email")
    .eq("id", project.partner_id)
    .single();

  const toEmail = (orgFull as { email?: string } | null)?.email;

  if (!toEmail) {
    console.warn("[photo-report] No email for partner org:", project.partner_id);
    return;
  }

  const items = (project.project_inventory || []) as Array<{
    item_name: string;
    quantity: number;
    room_destination: string | null;
    delivery_photo_url: string | null;
    pickup_photo_url: string | null;
    condition_on_receipt: string | null;
  }>;

  const itemsWithPhotos = items.filter((i) => i.delivery_photo_url);
  const installDate = project.target_end_date || project.actual_end_date || new Date().toISOString().split("T")[0];

  const html = buildPhotoReportHtml({
    projectNumber: project.project_number,
    projectName: project.project_name,
    endClientName: project.end_client_name || "",
    installAddress: project.site_address || "",
    installDate,
    coordinatorName: project.coordinator_name || "Yugo Team",
    partnerName: org?.name || "",
    itemsWithPhotos,
  });

  await sendEmail({
    to: toEmail,
    subject: `Install Complete — ${project.project_name} (${project.project_number})`,
    html,
  });

  await db
    .from("projects")
    .update({
      designer_phase: "completed",
      status: "completed",
      actual_end_date: installDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  await logActivity({
    entity_type: "project",
    entity_id: projectId,
    event_type: "completed",
    description: `Install photo report sent to ${toEmail}. Project marked complete.`,
    icon: "check",
  });
}

function buildPhotoReportHtml(data: {
  projectNumber: string;
  projectName: string;
  endClientName: string;
  installAddress: string;
  installDate: string;
  coordinatorName: string;
  partnerName: string;
  itemsWithPhotos: Array<{
    item_name: string;
    quantity: number;
    room_destination: string | null;
    delivery_photo_url: string | null;
    pickup_photo_url: string | null;
    condition_on_receipt: string | null;
  }>;
}): string {
  const formattedDate = new Date(data.installDate + "T12:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const itemRows = data.itemsWithPhotos
    .map(
      (item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #ece8e0;vertical-align:top;">
        <p style="margin:0;font-size:14px;color:#1a1412;font-weight:600;">
          ${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.item_name}
        </p>
        ${item.room_destination ? `<p style="margin:4px 0 0;font-size:12px;color:#8b7b6b;">${item.room_destination}</p>` : ""}
        ${
          item.delivery_photo_url
            ? `<a href="${item.delivery_photo_url}" style="display:inline-block;margin-top:8px;">
                <img src="${item.delivery_photo_url}" alt="${item.item_name} — installed" width="280"
                  style="border-radius:6px;display:block;max-width:280px;height:auto;border:1px solid #ece8e0;" />
              </a>`
            : ""
        }
      </td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Install Complete — ${data.projectName}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_PREMIUM_PAGE};font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #ece8e0;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:${EMAIL_FOREST};padding:32px 36px;">
              <p style="margin:0 0 4px;font-size:10px;letter-spacing:4px;color:rgba(255,255,255,0.5);font-family:sans-serif;text-transform:uppercase;">YUGO</p>
              <h1 style="margin:0;font-size:22px;color:#fff;font-weight:400;font-family:Georgia,serif;">Install Complete</h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.7);font-family:sans-serif;">${data.projectNumber}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 24px;font-size:15px;color:#3a2a1a;line-height:1.6;font-family:sans-serif;">
                Hi ${data.partnerName},<br /><br />
                The install for <strong>${data.projectName}</strong> has been completed
                on ${formattedDate}. Here's a photo documentation of every placed item.
              </p>

              <!-- Project details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:11px;color:#8b7b6b;font-family:sans-serif;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Client</td>
                        <td style="font-size:13px;color:#1a1412;font-family:sans-serif;text-align:right;">${data.endClientName}</td>
                      </tr>
                      <tr>
                        <td style="font-size:11px;color:#8b7b6b;font-family:sans-serif;text-transform:uppercase;letter-spacing:1px;padding-top:8px;padding-bottom:4px;">Address</td>
                        <td style="font-size:13px;color:#1a1412;font-family:sans-serif;text-align:right;padding-top:8px;">${data.installAddress}</td>
                      </tr>
                      <tr>
                        <td style="font-size:11px;color:#8b7b6b;font-family:sans-serif;text-transform:uppercase;letter-spacing:1px;padding-top:8px;">Coordinator</td>
                        <td style="font-size:13px;color:#1a1412;font-family:sans-serif;text-align:right;padding-top:8px;">${data.coordinatorName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Item photos -->
              ${
                data.itemsWithPhotos.length > 0
                  ? `<p style="margin:0 0 16px;font-size:12px;color:#8b7b6b;text-transform:uppercase;letter-spacing:1px;font-family:sans-serif;">
                      ${data.itemsWithPhotos.length} item${data.itemsWithPhotos.length !== 1 ? "s" : ""} documented
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>`
                  : `<p style="font-size:14px;color:#8b7b6b;font-family:sans-serif;text-align:center;padding:24px 0;">
                      No photos were attached to this install report.
                    </p>`
              }

              <p style="margin:28px 0 0;font-size:14px;color:#3a2a1a;font-family:sans-serif;line-height:1.6;">
                Thank you for choosing Yugo for this project.<br />
                — ${data.coordinatorName}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #ece8e0;background:#faf8f4;">
              <p style="margin:0;font-size:11px;color:#aaa;font-family:sans-serif;text-align:center;">
                Yugo · Toronto, ON · yugoplus.co
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
