import { notFound } from "next/navigation";
import CrewWaiverSampleClient from "./CrewWaiverSampleClient";

export const metadata = {
  title: "Crew waiver sample",
};

/** Local/dev only: preview the client waiver screen without crew login. */
export default function CrewWaiverSamplePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CrewWaiverSampleClient />;
}
