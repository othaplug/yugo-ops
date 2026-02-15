import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";
import ThemeToggle from "./ThemeToggle";
import NotificationToggles from "./NotificationToggles";
import Enable2FAButton from "./Enable2FAButton";
import IntegrationButtons from "./IntegrationButtons";
import { Icon } from "@/components/AppIcons";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="max-w-[720px] mx-auto px-5 md:px-6 py-6 space-y-6 animate-fade-up">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <a href="#personal" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">Personal</a>
          <a href="#security" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">Security</a>
          <a href="#appearance" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">Appearance</a>
          <a href="#notifications" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">Notifications</a>
          <a href="#integrations" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">Integrations</a>
        </div>
        {/* Personal Account Section */}
        <div id="personal" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="font-heading text-[16px] font-bold text-[var(--tx)]">Personal Account</h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Manage your profile and credentials</p>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Email Address</label>
              <div className="text-[13px] text-[var(--tx)] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-4 py-2.5">
                {user?.email}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Role</label>
              <div className="text-[13px] text-[var(--tx)] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-4 py-2.5 inline-flex items-center gap-2">
                <span className="w-2 h-2 bg-[var(--gold)] rounded-full" />
                Administrator
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div id="security" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4">
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
                <span className="text-[12px] text-[var(--tx2)]">2FA not enabled</span>
                <Enable2FAButton />
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div id="appearance" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4">
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

        {/* Notifications Section */}
        <div id="notifications" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4">
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

        {/* Integrations Section */}
        <div id="integrations" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="plug" className="w-[16px] h-[16px]" /> Integrations
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Connected services and APIs</p>
          </div>
          <div className="px-5 py-5 space-y-3">
            {[
              { 
                label: "Square", 
                desc: "Invoicing & payment processing", 
                status: process.env.SQUARE_ACCESS_TOKEN ? "connected" : "disconnected",
                icon: "creditCard"
              },
              { 
                label: "Resend", 
                desc: "Email notifications & campaigns", 
                status: process.env.RESEND_API_KEY ? "connected" : "disconnected",
                icon: "mail"
              },
              { 
                label: "Twilio", 
                desc: "SMS notifications & alerts", 
                status: process.env.TWILIO_ACCOUNT_SID ? "connected" : "disconnected",
                icon: "phone"
              },
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
                    item.status === "connected" 
                      ? "bg-[rgba(45,159,90,0.12)] text-[var(--grn)]" 
                      : "bg-[rgba(212,138,41,0.12)] text-[var(--org)]"
                  }`}>
                    {item.status === "connected" ? "Connected" : "Not connected"}
                  </div>
                  <IntegrationButtons status={item.status} label={item.status === "connected" ? "Configure" : "Connect"} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="font-heading text-[16px] font-bold text-[var(--tx)]">Preferences</h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Customize your experience</p>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Language</label>
              <select className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none transition-colors">
                <option>English (US)</option>
                <option>English (UK)</option>
                <option>French</option>
                <option>Spanish</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Timezone</label>
              <select className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none transition-colors">
                <option>America/Toronto (EST)</option>
                <option>America/New_York (EST)</option>
                <option>America/Los_Angeles (PST)</option>
                <option>Europe/London (GMT)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Date Format</label>
              <select className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none transition-colors">
                <option>MM/DD/YYYY</option>
                <option>DD/MM/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>
    </div>
  );
}