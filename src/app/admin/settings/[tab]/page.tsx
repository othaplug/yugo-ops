import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SettingsForm from "../SettingsForm";
import ThemeToggle from "../ThemeToggle";
import NotificationToggles from "../NotificationToggles";
import Enable2FAButton from "../Enable2FAButton";
import IntegrationHealthPanel from "../IntegrationHealthPanel";
import PartnerProfileSettings from "../PartnerProfileSettings";
import EditableEmailSection from "../EditableEmailSection";
import LoginHistoryPanel from "../LoginHistoryPanel";
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
    ? await db.from("platform_users").select("role, two_factor_enabled").eq("user_id", user.id).single()
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
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        {isPartner ? (
          <PartnerProfileSettings />
        ) : (
          <>
            <div className="px-5 py-5 border-b border-[var(--brd)] bg-[var(--bg2)]">
              <h2 className="font-heading text-h3-lg font-bold text-[var(--tx)]">Personal Account</h2>
              <p className="text-ui text-[var(--tx3)] mt-1.5">Manage your profile and credentials</p>
            </div>
            <div className="px-5 py-5 space-y-4">
              <EditableEmailSection currentEmail={user?.email || ""} />
              <div>
                <label className="block text-label font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Role</label>
                <div className="text-body text-[var(--tx)] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-4 py-2.5 inline-flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--gold)] rounded-full" />
                  {roleLabel}
                </div>
                <p className="text-label text-[var(--tx3)] mt-1">Only administrators can change user roles</p>
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
            <h2 className="font-heading text-h3 font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="lock" className="w-[16px] h-[16px]" /> Security
            </h2>
            <p className="text-caption text-[var(--tx3)] mt-0.5">Password and two-factor authentication</p>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-label font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Change Password</label>
              <SettingsForm />
            </div>
            <div>
              <label className="block text-label font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Two-Factor Authentication</label>
              <div className="flex items-center justify-between py-2.5 px-4 bg-[var(--bg)] border border-[var(--brd)] rounded-lg">
                <span className="text-ui text-[var(--tx2)]">{platformUser?.two_factor_enabled ? "2FA is active — code sent to email on each login" : "2FA not enabled"}</span>
                <Enable2FAButton enabled={platformUser?.two_factor_enabled} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="font-heading text-h3 font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="clock" className="w-[16px] h-[16px]" /> Login History
            </h2>
            <p className="text-caption text-[var(--tx3)] mt-0.5">Recent sign-in activity and active sessions</p>
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
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-h3 font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="paint" className="w-[16px] h-[16px]" /> Appearance
          </h2>
          <p className="text-caption text-[var(--tx3)] mt-0.5">Theme and display preferences</p>
        </div>
        <div className="px-5 py-5">
          <ThemeToggle />
        </div>
      </div>
    );
  }

  if (tab === "notifications") {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-h3 font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="bell" className="w-[16px] h-[16px]" /> Notifications
          </h2>
          <p className="text-caption text-[var(--tx3)] mt-0.5">Manage how you receive updates</p>
        </div>
        <div className="px-5 py-5">
          <NotificationToggles />
        </div>
      </div>
    );
  }

  if (tab === "integrations") {
    const integrations = [
      { key: "square", label: "Square", desc: "Invoicing & payment processing", icon: "creditCard" as const, connected: !!process.env.SQUARE_ACCESS_TOKEN, details: process.env.SQUARE_ENVIRONMENT === "production" ? "Mode: Production" : "Mode: Sandbox" },
      { key: "resend", label: "Resend", desc: "Email notifications & campaigns", icon: "mail" as const, connected: !!process.env.RESEND_API_KEY },
      { key: "twilio", label: "Twilio", desc: "SMS notifications & alerts", icon: "phone" as const, connected: !!process.env.TWILIO_ACCOUNT_SID },
      { key: "mapbox", label: "Mapbox", desc: "Maps, geocoding & distance calculation", icon: "mapPin" as const, connected: !!process.env.MAPBOX_TOKEN || !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN },
    ];

    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-h3 font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="plug" className="w-[16px] h-[16px]" /> Integrations
          </h2>
          <p className="text-caption text-[var(--tx3)] mt-0.5">Connected services, APIs, and health monitoring</p>
        </div>
        <div className="px-5 py-5">
          <IntegrationHealthPanel integrations={integrations} />
        </div>
      </div>
    );
  }

  return null;
}
