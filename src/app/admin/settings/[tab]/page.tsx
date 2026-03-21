import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const label = tab === "personal" ? "Personal" : tab === "security" ? "Security" : tab === "appearance" ? "Appearance" : tab === "notifications" ? "Notifications" : tab === "integrations" ? "Integrations" : "Settings";
  return { title: `Settings — ${label}` };
}

import { createAdminClient } from "@/lib/supabase/admin";
import SettingsForm from "../SettingsForm";
import AppearanceSettings from "../AppearanceSettings";
import NotificationToggles from "../NotificationToggles";
import Enable2FAButton from "../Enable2FAButton";
import IntegrationHealthPanel from "../IntegrationHealthPanel";
import PartnerProfileSettings from "../PartnerProfileSettings";
import EditableEmailSection from "../EditableEmailSection";
import LoginHistoryPanel from "../LoginHistoryPanel";
import PersonalSettingsForm from "../PersonalSettingsForm";
import { Icon } from "@/components/AppIcons";
import { isSuperAdminEmail } from "@/lib/super-admin";

const VALID_TABS = ["personal", "security", "appearance", "notifications", "integrations"] as const;

export default async function SettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (!VALID_TABS.includes(tab as (typeof VALID_TABS)[number])) notFound();

  const supabase = await createClient();
  const db = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: platformUser } = user
    ? await db.from("platform_users").select("role, two_factor_enabled, name, phone").eq("user_id", user.id).single()
    : { data: null };
  const { data: partnerUser } = user
    ? await db.from("partner_users").select("org_id").eq("user_id", user.id).single()
    : { data: null };
  const isSuperAdmin = isSuperAdminEmail(user?.email);
  const isPartner = !!partnerUser && !platformUser && !isSuperAdmin;
  const effectiveRole = isSuperAdmin ? "owner" : platformUser?.role ?? "viewer";
  const ROLE_LABELS: Record<string, string> = {
    owner: "Owner",
    admin: "Administrator",
    manager: "Manager",
    dispatcher: "Dispatcher",
    coordinator: "Coordinator",
    viewer: "Viewer",
    crew: "Crew",
    partner: "Partner",
    client: "Client",
  };
  const roleLabel = ROLE_LABELS[effectiveRole] ?? effectiveRole;

  if (tab === "personal") {
    return (
      <div className="space-y-6">
        {isPartner ? (
          <PartnerProfileSettings />
        ) : (
          <>
            {/* Profile */}
            <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
                <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
                  <Icon name="user" className="w-[16px] h-[16px]" /> Profile
                </h2>
                <p className="text-[11px] text-[var(--tx3)] mt-0.5">Your name, contact details, and role</p>
              </div>
              <div className="px-5 py-5">
                <PersonalSettingsForm
                  initialName={platformUser?.name ?? ""}
                  initialPhone={platformUser?.phone ?? ""}
                  email={user?.email ?? ""}
                  roleLabel={roleLabel}
                />
              </div>
            </div>

            {/* Email (separate card) */}
            <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
                <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
                  <Icon name="mail" className="w-[16px] h-[16px]" /> Email Address
                </h2>
                <p className="text-[11px] text-[var(--tx3)] mt-0.5">Changing your email will require verification</p>
              </div>
              <div className="px-5 py-5">
                <EditableEmailSection currentEmail={user?.email || ""} />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (tab === "security") {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="lock" className="w-[16px] h-[16px]" /> Security
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Password and two-factor authentication</p>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-[12px] font-bold tracking-wider uppercase text-[var(--tx)] mb-2">Change Password</label>
              <SettingsForm />
            </div>
            <div>
              <label className="block text-[12px] font-bold tracking-wider uppercase text-[var(--tx)] mb-2">Two-Factor Authentication</label>
              <div className="flex items-center justify-between py-2.5 px-4 bg-[var(--bg)] border border-[var(--brd)] rounded-lg">
                <span className="text-[12px] text-[var(--tx2)]">{platformUser?.two_factor_enabled ? "2FA is active — code sent to email on each login" : "2FA not enabled"}</span>
                <Enable2FAButton enabled={platformUser?.two_factor_enabled} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="clock" className="w-[16px] h-[16px]" /> Login History
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Recent sign-in activity and active sessions</p>
          </div>
          <div className="px-5 py-5">
            <LoginHistoryPanel />
          </div>
        </div>
      </div>
    );
  }

  if (tab === "appearance") {
    return (
      <div className="space-y-1">
        <AppearanceSettings />
      </div>
    );
  }

  if (tab === "notifications") {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="bell" className="w-[16px] h-[16px]" /> Notifications
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Manage how you receive updates</p>
        </div>
        <div className="px-5 py-5">
          <NotificationToggles />
        </div>
      </div>
    );
  }

  if (tab === "integrations") {
    const integrations = [
      // Payments
      { key: "square", label: "Square", desc: "Invoicing & payment processing", icon: "creditCard" as const, connected: !!process.env.SQUARE_ACCESS_TOKEN, details: process.env.SQUARE_ENVIRONMENT === "production" ? "Mode: Production" : "Mode: Sandbox", category: "Payments" },
      // Communications
      { key: "resend", label: "Resend", desc: "Transactional email — quotes, invoices, confirmations", icon: "mail" as const, connected: !!process.env.RESEND_API_KEY, category: "Communications" },
      { key: "openphone", label: "OpenPhone", desc: "SMS notifications, dispatch alerts & client messaging", icon: "phone" as const, connected: !!process.env.OPENPHONE_API_KEY, category: "Communications" },
      // Mapping
      { key: "mapbox", label: "Mapbox", desc: "Maps, geocoding, live crew tracking & routing", icon: "mapPin" as const, connected: !!process.env.MAPBOX_TOKEN || !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN, category: "Mapping" },
      // CRM
      { key: "hubspot", label: "HubSpot", desc: "CRM — sync contacts, deals & pipeline from quotes", icon: "link" as const, connected: !!process.env.HUBSPOT_ACCESS_TOKEN, category: "CRM" },
      // Accounting
      { key: "quickbooks", label: "QuickBooks", desc: "Sync invoices and payments with your accounting software", icon: "creditCard" as const, connected: !!process.env.QUICKBOOKS_CLIENT_ID, category: "Accounting" },
      // Automation
      { key: "zapier", label: "Zapier", desc: "Automate workflows — connect Yugo to 6,000+ apps", icon: "plug" as const, connected: !!process.env.ZAPIER_WEBHOOK_SECRET, category: "Automation" },
      { key: "slack", label: "Slack", desc: "Team channel in Admin → Messages; webhooks for test pings", icon: "messageSquare" as const, connected: !!(process.env.SLACK_WEBHOOK_URL || process.env.SLACK_BOT_TOKEN), category: "Automation" },
    ];

    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="plug" className="w-[16px] h-[16px]" /> Integrations
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Connected services, APIs, and health monitoring</p>
        </div>
        <div className="px-5 py-5">
          <IntegrationHealthPanel integrations={integrations} />
        </div>
      </div>
    );
  }

  return null;
}
