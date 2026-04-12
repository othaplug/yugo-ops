"use client";

import { ClientWaiverView } from "@/components/crew/ClientWaiverView";
import { waiverCategoryByCode } from "@/lib/waivers/waiver-categories";

export default function CrewWaiverSampleClient() {
  const category = waiverCategoryByCode.disassembly_risk;

  return (
    <div
      className="min-h-dvh bg-[#1a1a1a] px-3 py-6 sm:px-6"
      data-crew-portal
    >
      <p className="text-[11px] text-white/60 mb-3 max-w-lg mx-auto text-center [font-family:var(--font-body)]">
        Development sample: client-facing waiver (as shown when the crew hands
        the phone to the client). The full flow starts from an active move job
        in the crew app.
      </p>
      <div className="max-w-lg mx-auto">
        <ClientWaiverView
          category={category}
          itemName="King bed frame, master bedroom"
          description="Two of the four bolts connecting the headboard to the frame are stripped. The previous installer used incorrect screws and adhesive. Removing the headboard may damage the mounting points."
          photoPreviewUrls={[]}
          crewRecommendation="proceed_with_caution"
          clientName="Alex Sample"
          onSigned={() => {
            window.alert("Sample only: would save signed waiver to the server.")
          }}
          onDeclined={() => {
            window.alert("Sample only: would record decline and return to crew.")
          }}
        />
      </div>
    </div>
  );
}
