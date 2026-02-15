import { createClient } from "@/lib/supabase/server";
import PlatformSettingsClient from "./PlatformSettingsClient";

export default async function PlatformPage() {
  const supabase = await createClient();
  const { data: crews } = await supabase.from("crews").select("id, name, members").order("name");
  const initialTeams = (crews || []).map((c) => ({
    id: c.id,
    label: c.name,
    memberIds: Array.isArray(c.members) ? c.members : [],
    active: true,
  }));

  return (
    <div className="max-w-[720px] mx-auto px-5 md:px-6 py-6 animate-fade-up">
      <PlatformSettingsClient initialTeams={initialTeams} />
    </div>
  );
}
