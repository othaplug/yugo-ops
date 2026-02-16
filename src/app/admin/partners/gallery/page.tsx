import Link from "next/link";
import BackButton from "../../components/BackButton";
import GalleryClient from "./GalleryClient";
import CreateProjectButton from "./CreateProjectButton";

const GALLERY_PARTNERS = [
  { id: "1", name: "Bau-Xi Gallery", contact: "Sophie Kim", works: 18, inStorage: 6 },
  { id: "2", name: "Olga Korper", contact: "Olga Korper", works: 22, inStorage: 4 },
  { id: "3", name: "Nicholas Metivier", contact: "Nicholas M.", works: 12, inStorage: 2 },
];

export default function GalleryPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
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

      {/* Create Project */}
      <div className="flex justify-end mb-4">
        <CreateProjectButton />
      </div>

      <GalleryClient />

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
