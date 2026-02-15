import Topbar from "../../components/Topbar";

export default function GalleryPage() {
  return (
    <>
      <Topbar title="Art Gallery" subtitle="Transport & exhibitions" />
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-5">
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            ["Partners", "3"],
            ["Exhibitions", "2"],
            ["Transports", "2"],
            ["In Storage", "12"],
          ].map(([label, value]) => (
            <div key={label} className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
              <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">{label}</div>
              <div className="text-xl font-bold font-serif">{value}</div>
            </div>
          ))}
        </div>
        <div className="text-center py-8 text-[var(--tx3)] text-[11px]">
          Gallery management coming soon. Gallery data will be stored in a dedicated exhibitions table.
        </div>
      </div>
    </>
  );
}