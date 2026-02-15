import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";
import ThemeToggle from "./ThemeToggle";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="max-w-[720px] mx-auto px-5 md:px-6 py-6 space-y-6">
        {/* Account Section */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="text-[16px] font-bold text-[var(--tx)]">Account</h2>
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
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Change Password</label>
              <SettingsForm />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Two-Factor Authentication</label>
              <div className="flex items-center justify-between py-2.5 px-4 bg-[var(--bg)] border border-[var(--brd)] rounded-lg">
                <span className="text-[12px] text-[var(--tx2)]">2FA not enabled</span>
                <button className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all">
                  Enable 2FA
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="text-[16px] font-bold text-[var(--tx)]">Appearance</h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Theme and display preferences</p>
          </div>
          <div className="px-5 py-5">
            <ThemeToggle />
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="text-[16px] font-bold text-[var(--tx)]">Notifications</h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Manage how you receive updates</p>
          </div>
          <div className="px-5 py-5 space-y-3">
            {[
              { label: "Email Notifications", desc: "Receive updates via email", enabled: true },
              { label: "SMS Notifications", desc: "Receive updates via text message", enabled: false },
              { label: "Push Notifications", desc: "Browser push notifications", enabled: true },
              { label: "Weekly Digest", desc: "Summary of weekly activity", enabled: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-3 border-b border-[var(--brd)] last:border-0">
                <div>
                  <div className="text-[13px] font-semibold text-[var(--tx)]">{item.label}</div>
                  <div className="text-[11px] text-[var(--tx3)] mt-0.5">{item.desc}</div>
                </div>
                <button
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    item.enabled ? "bg-[var(--gold)]" : "bg-[var(--brd)]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      item.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Integrations Section */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="text-[16px] font-bold text-[var(--tx)]">Integrations</h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Connected services and APIs</p>
          </div>
          <div className="px-5 py-5 space-y-3">
            {[
              { 
                label: "Square", 
                desc: "Invoicing & payment processing", 
                status: process.env.SQUARE_ACCESS_TOKEN ? "connected" : "disconnected",
                icon: "💳"
              },
              { 
                label: "Resend", 
                desc: "Email notifications & campaigns", 
                status: process.env.RESEND_API_KEY ? "connected" : "disconnected",
                icon: "📧"
              },
              { 
                label: "Twilio", 
                desc: "SMS notifications & alerts", 
                status: process.env.TWILIO_ACCOUNT_SID ? "connected" : "disconnected",
                icon: "📱"
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-3 border-b border-[var(--brd)] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="text-[24px]">{item.icon}</div>
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
                  <button className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all">
                    {item.status === "connected" ? "Configure" : "Connect"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h2 className="text-[16px] font-bold text-[var(--tx)]">Preferences</h2>
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

        {/* Danger Zone */}
        <div className="bg-[var(--card)] border border-[var(--red)]/20 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--red)]/10 bg-[rgba(209,67,67,0.04)]">
            <h2 className="text-[16px] font-bold text-[var(--red)]">Danger Zone</h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">Destructive actions that cannot be undone</p>
          </div>
          <div className="px-5 py-5 space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-[var(--brd)]">
              <div>
                <div className="text-[13px] font-semibold text-[var(--tx)]">Export All Data</div>
                <div className="text-[11px] text-[var(--tx3)] mt-0.5">Download a complete copy of your data</div>
              </div>
              <button className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all">
                Export
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-[13px] font-semibold text-[var(--red)]">Delete All Data</div>
                <div className="text-[11px] text-[var(--tx3)] mt-0.5">Permanently delete all deliveries, invoices, and records</div>
              </div>
              <button className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--red)]/40 text-[var(--red)] hover:bg-[rgba(209,67,67,0.08)] transition-all">
                Delete
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}