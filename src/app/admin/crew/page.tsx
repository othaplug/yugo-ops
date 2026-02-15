import { createClient } from "@/lib/supabase/server";
import Topbar from "../components/Topbar";
import CrewMap from "./CrewMap";

export default async function CrewPage() {
  const supabase = await createClient();
  const { data: crews } = await supabase.from("crews").select("*");

  return (
    <>
      <Topbar title="Crew Tracking" subtitle="Live GPS positions" />
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-5">
        <CrewMap crews={crews || []} />
      </div>
    </>
  );
}