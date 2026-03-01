import Link from "next/link";
import BackButton from "../components/BackButton";

const PARTNER_CATEGORIES = [
  { slug: "retail", label: "Retail", description: "White-glove delivery partners", icon: "🛋️" },
  { slug: "designers", label: "Designers", description: "Interior design projects", icon: "🎨" },
  { slug: "hospitality", label: "Hospitality", description: "FF&E & seasonal logistics", icon: "🏨" },
  { slug: "gallery", label: "Art Gallery", description: "Art transport & exhibitions", icon: "🖼️" },
  { slug: "realtors", label: "Realtors", description: "Referral partnerships", icon: "🤝" },
];

export default function PartnersHubPage() {
  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      <h1 className="font-hero text-[22px] font-bold text-[var(--tx)] mb-1">Partner Management</h1>
      <p className="text-[13px] text-[var(--tx3)] mb-6">Manage all your B2B partner relationships.</p>
      <div className="grid gap-3">
        {PARTNER_CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={`/admin/partners/${cat.slug}`}
            className="flex items-center gap-4 p-4 rounded-xl border border-[var(--brd)] bg-[var(--card)] hover:border-[var(--gold)] transition-colors"
          >
            <span className="text-2xl">{cat.icon}</span>
            <div className="flex-1">
              <h2 className="text-[14px] font-bold text-[var(--tx)]">{cat.label}</h2>
              <p className="text-[12px] text-[var(--tx3)]">{cat.description}</p>
            </div>
            <span className="text-[var(--tx3)] text-[12px]">Manage →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
