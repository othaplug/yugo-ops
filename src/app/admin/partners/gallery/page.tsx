import Link from "next/link";
import Badge from "../../components/Badge";

// Mock data for prototype layout
const ACTIVE_EXHIBITIONS = [
  { id: "1", name: "Feinstein: Convergence", gallery: "Bau-Xi", location: "Main Gallery", dates: "Feb 14 - Mar 28", works: 8, percent: 40, status: "installing" as const },
  { id: "2", name: "Group: Northern Light", gallery: "Bau-Xi", location: "Vault", dates: "Mar 1 - Apr 15", works: 12, percent: 10, status: "staging" as const },
];

const SCHEDULED_TRANSPORTS = [
  { id: "1", title: "Feinstein Oil #4", gallery: "Bau-Xi", route: "Storage → Main Gallery", value: "$45K", date: "Feb 12", status: "scheduled" as const },
  { id: "2", title: "Maxwell Bronze #2", gallery: "Olga Korper", route: "Foundry → Gallery", value: "$28K", date: "Feb 13", status: "confirmed" as const },
];

const GALLERY_PARTNERS = [
  { id: "1", name: "Bau-Xi Gallery", contact: "Sophie Kim", works: 18, inStorage: 6 },
  { id: "2", name: "Olga Korper", contact: "Olga Korper", works: 22, inStorage: 4 },
  { id: "3", name: "Nicholas Metivier", contact: "Nicholas M.", works: 12, inStorage: 2 },
];

export default function GalleryPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 animate-fade-up">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Link href="/admin/clients" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
          <div className="text-xl font-bold font-heading">3</div>
        </Link>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Exhibitions</div>
          <div className="text-xl font-bold font-heading">2</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Transports</div>
          <div className="text-xl font-bold font-heading">2</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">In Storage</div>
          <div className="text-xl font-bold font-heading">12</div>
        </div>
      </div>

      {/* Add Partner */}
      <div className="flex justify-end mb-4">
        <Link href="/admin/clients/new" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all">
          + Add Partner
        </Link>
      </div>

      {/* Active Exhibitions */}
      <div className="mb-6">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Active Exhibitions</h3>
        <div className="space-y-2">
          {ACTIVE_EXHIBITIONS.map((ex) => (
            <div key={ex.id} className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 hover:border-[var(--gold)] transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[var(--tx)]">{ex.name}</div>
                  <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                    {ex.gallery} • {ex.location} • {ex.dates} • {ex.works} works
                  </div>
                  <div className="mt-2 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--gold)] rounded-full transition-all duration-500" style={{ width: `${ex.percent}%` }} />
                  </div>
                </div>
                <Badge status={ex.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Transports */}
      <div className="mb-6">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Scheduled Transports</h3>
        <div className="space-y-2">
          {SCHEDULED_TRANSPORTS.map((t) => (
            <Link key={t.id} href="/admin/deliveries" className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all">
              <div className="w-10 h-10 rounded-lg bg-[var(--gdim)] flex items-center justify-center text-[var(--gold)] shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-[var(--tx)]">{t.title}</div>
                <div className="text-[10px] text-[var(--tx3)]">{t.gallery} • {t.route} • {t.value}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-[var(--tx3)]">{t.date}</div>
                <span className="text-[10px] font-semibold text-[var(--blue)]">{t.status}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Gallery Partners */}
      <div>
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Gallery Partners</h3>
        <div className="space-y-2">
          {GALLERY_PARTNERS.map((p) => (
            <Link key={p.id} href="/admin/clients" className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-[var(--tx)]">{p.name}</div>
                <div className="text-[10px] text-[var(--tx3)]">{p.contact} • {p.works} works • {p.inStorage} in storage</div>
              </div>
              <span className="text-[10px] font-semibold text-[var(--gold)]">View →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
