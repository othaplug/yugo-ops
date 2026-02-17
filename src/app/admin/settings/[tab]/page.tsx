import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "../SettingsForm";
import ThemeToggle from "../ThemeToggle";
import NotificationToggles from "../NotificationToggles";
import Enable2FAButton from "../Enable2FAButton";
import IntegrationButtons from "../IntegrationButtons";
import PartnerProfileSettings from "../PartnerProfileSettings";
import EditableEmailSection from "../EditableEmailSection";
import { Icon } from "@/components/AppIcons";

const VALID_TABS = ["personal", "security", "appearance", "notifications", "integrations"] as const;

export default async function SettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (!VALID_TABS.includes(tab as (typeof VALID_TABS)[number])) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: platformUser } = user
    ? await supabase.from("platform_users").select("role, two_factor_enabled").eq("user_id", user.id).single()
    : { data: null };
  const { data: partnerUser } = user
    ? await supabase.from("partner_users").select("org_id").eq("user_id", user.id).single()
    : { data: null };
  const isSuperAdmin = (user?.email || "").toLowerCase() === (process.env.SUPER_ADMIN_EMAIL || "othaplug@gmail.com").toLowerCase();
  const isPartner = !!partnerUser && !platformUser && !isSuperAdmin;
  const roleLabel = platformUser?.role === "admin" ? "Administrator" : "Dispatcher";

  if (tab === "personal") {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        {isPartner ? (
          <PartnerProfileSettings />
        ) : (
          <>
            <div className="px-5 py-5 border-b border-[var(--brd)] bg-[var(--bg2)]">
              <h2 className="font-heading text-[18px] font-bold text-[var(--tx)]">Personal Account</h2>
              <p className="text-[12px] text-[var(--tx3)] mt-1.5">Manage your profile and credentials</p>
            </div>
            <div className="px-5 py-5 space-y-4">
              <EditableEmailSection currentEmail={user?.email || ""} />
              <div>
                <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Role</label>
                <div className="text-[13px] text-[var(--tx)] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-4 py-2.5 inline-flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--gold)] rounded-full" />
                  {platformUser ? roleLabel : "Administrator"}
                </div>
                <p className="text-[10px] text-[var(--tx3)] mt-1">Only administrators can change user roles</p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (tab === "security") {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="lock" className="w-[16px] h-[16px]" /> Security
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Password and two-factor authentication</p>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Change Password</label>
            <SettingsForm />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Two-Factor Authentication</label>
            <div className="flex items-center justify-between py-2.5 px-4 bg-[var(--bg)] border border-[var(--brd)] rounded-lg">
              <span className="text-[12px] text-[var(--tx2)]">{platformUser?.two_factor_enabled ? "2FA is active — code sent to email on each login" : "2FA not enabled"}</span>
              <Enable2FAButton enabled={platformUser?.two_factor_enabled} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "appearance") {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="paint" className="w-[16px] h-[16px]" /> Appearance
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Theme and display preferences</p>
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
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="plug" className="w-[16px] h-[16px]" /> Integrations
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Connected services and APIs</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          {[
            { label: "Square", desc: "Invoicing & payment processing", status: process.env.SQUARE_ACCESS_TOKEN ? "connected" : "disconnected", icon: "creditCard" as const },
            { label: "Resend", desc: "Email notifications & campaigns", status: process.env.RESEND_API_KEY ? "connected" : "disconnected", icon: "mail" as const },
            { label: "Twilio", desc: "SMS notifications & alerts", status: process.env.TWILIO_ACCOUNT_SID ? "connected" : "disconnected", icon: "phone" as const },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3 border-b border-[var(--brd)] last:border-0">
              <div className="flex items-center gap-3">
                <div className="text-[var(--tx2)]"><Icon name={item.icon} className="w-[20px] h-[20px]" /></div>
                <div>
                  <div className="text-[13px] font-semibold text-[var(--tx)]">{item.label}</div>
                  <div className="text-[11px] text-[var(--tx3)] mt-0.5">{item.desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                  item.status === "connected" ? "bg-[rgba(45,159,90,0.12)] text-[var(--grn)]" : "bg-[rgba(212,138,41,0.12)] text-[var(--org)]"
                }`}>
                  {item.status === "connected" ? "Connected" : "Not connected"}
                </div>
                <IntegrationButtons status={item.status} label={item.status === "connected" ? "Configure" : "Connect"} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
