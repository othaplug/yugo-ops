import { createClient } from "@/lib/supabase/server";
import Topbar from "../../components/Topbar";
import Badge from "../../components/Badge";

export default async function OfficeMovesPage() {
  const supabase = await createClient();
  const { data: moves } = await supabase
    .from("moves")
    .select("*")
    .eq("move_type", "office")
    .order("created_at", { ascending: false });

  const all = moves || [];
  const confirmed = all.filter((m) => m.status === "confirmed").length;
  const pipeline = all.reduce((sum, m) => sum + Number(m.estimate || 0), 0);

  return (
    <>
      <Topbar title="Office Moves" subtitle="Commercial logistics" />
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-5">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Office Moves</div>
            <div className="text-xl font-bold font-serif">{all.length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Confirmed</div>
            <div className="text-xl font-bold font-serif text-[var(--grn)]">{confirmed}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Pipeline</div>
            <div className="text-xl font-bold font-serif">${pipeline.toLocaleString()}</div>
          </div>
        </div>

        {/* Move List */}
        <div className="flex flex-col gap-1">
          {all.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-[var(--bldim)] shrink-0">
                🏢
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{m.client_name}</div>
                <div className="text-[9px] text-[var(--tx3)] truncate">
                  {m.from_address} → {m.to_address}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-[var(--tx3)]">{m.scheduled_date}</div>
                <div className="text-[10px] font-bold text-[var(--gold)]">
                  ${Number(m.estimate || 0).toLocaleString()}
                </div>
              </div>
              <Badge status={m.status} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}