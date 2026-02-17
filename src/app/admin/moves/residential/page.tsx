import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Badge from "../../components/Badge";
import { Icon } from "@/components/AppIcons";
import BackButton from "../../components/BackButton";
import MoveNotifyButton from "../MoveNotifyButton";

export default async function ResidentialMovesPage() {
  const supabase = await createClient();
  const { data: moves } = await supabase
    .from("moves")
    .select("*")
    .eq("move_type", "residential")
    .order("created_at", { ascending: false });

  const all = moves || [];
  const confirmed = all.filter((m) => m.status === "confirmed").length;
  const pipeline = all.reduce((sum, m) => sum + Number(m.estimate || 0), 0);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
        <div className="mb-4"><BackButton label="Back" /></div>
        {/* Metrics - clickable */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <Link href="/admin/moves/residential" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Residential Moves</div>
            <div className="text-xl font-bold font-heading">{all.length}</div>
          </Link>
          <Link href="/admin/moves/residential" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Confirmed</div>
            <div className="text-xl font-bold font-heading text-[var(--grn)]">{confirmed}</div>
          </Link>
          <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Pipeline</div>
            <div className="text-xl font-bold font-heading text-[var(--gold)]">${pipeline.toLocaleString()}</div>
          </Link>
          <Link href="/admin/moves/new" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all flex items-center justify-center">
            <span className="text-[10px] font-semibold text-[var(--gold)]">+ New Move</span>
          </Link>
        </div>

        {/* Move List */}
        <div className="dl">
          {all.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
              No residential moves yet
            </div>
          ) : all.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all duration-200 group"
            >
              <Link href={`/admin/moves/${m.id}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--gdim)] shrink-0 text-[var(--tx2)]">
                  <Icon name="home" className="w-[16px] h-[16px]" />
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
              </Link>
              <div className="shrink-0">
                <MoveNotifyButton move={m} />
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}