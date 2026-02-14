import Topbar from "../components/Topbar";
import LogoutButton from "../LogoutButton";

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" subtitle="Configuration" />
      <div className="max-w-[800px] px-6 py-5">
        {/* Profile */}
        <div className="flex items-center gap-3 p-3.5 bg-[var(--bg)] border border-[var(--brd)] rounded-xl mb-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--gold)] to-[#8B7332] flex items-center justify-center text-sm font-bold text-white">
            JO
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-bold">J. Oche</div>
            <div className="text-[9px] text-[var(--tx2)]">Founder • Yugo</div>
          </div>
          <LogoutButton />
        </div>

        {/* Rates */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-3">
          <div className="text-xs font-bold mb-2">💰 Rates</div>
          {[
            ["Essentials", "$150/hr"],
            ["Premier", "$220/hr"],
            ["Estate", "$350/hr+"],
            ["Office", "$3K-$25K"],
          ].map(([tier, rate]) => (
            <div key={tier} className="flex items-center justify-between px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg mb-[3px]">
              <span className="text-[10px] font-medium">{tier}</span>
              <span className="text-[10px] text-[var(--tx2)] font-semibold">{rate}</span>
            </div>
          ))}
        </div>

        {/* Crews */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-3">
          <div className="text-xs font-bold mb-2">👥 Crews</div>
          {[
            ["Team A", "Marcus, Devon"],
            ["Team B", "James, Olu"],
            ["Team C", "Ryan, Chris"],
            ["Art Specialist", "On call"],
          ].map(([name, members]) => (
            <div key={name} className="flex items-center justify-between px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg mb-[3px]">
              <div>
                <div className="text-[10px] font-medium">{name}</div>
                <div className="text-[8px] text-[var(--tx3)]">{members}</div>
              </div>
              <div className="w-2 h-2 rounded-full bg-[var(--grn)]" />
            </div>
          ))}
        </div>

        {/* App Settings */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-xs font-bold mb-2">⚙️ App</div>
          {["Notifications", "Auto-Invoice", "Calendar Sync", "Backup"].map((setting) => (
            <div key={setting} className="flex items-center justify-between px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg mb-[3px]">
              <span className="text-[10px] font-medium">{setting}</span>
              <span className="text-[9px] text-[var(--grn)] font-semibold">Enabled</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}