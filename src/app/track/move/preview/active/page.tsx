import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allowClientUiPreview } from "@/lib/client-ui-preview";
import {
  buildStandardTrackPreviewMoveActive,
  PREVIEW_TRACK_TOKEN,
} from "@/lib/track-move-client-preview-data";
import TrackMoveClient from "../../[id]/TrackMoveClient";
import PreviewChromeBanner from "../PreviewChromeBanner";

export const metadata: Metadata = {
  title: "Track move (sample — before complete)",
  robots: { index: false, follow: false },
};

/** Standard Signature track: cream shell, countdown, tabs — not Estate. */
export default function TrackMovePreviewActivePage() {
  if (!allowClientUiPreview()) notFound();

  const move = buildStandardTrackPreviewMoveActive();

  return (
    <div className="flex flex-col h-screen min-h-0">
      <PreviewChromeBanner variant="active" />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TrackMoveClient
          fillParentHeight
          move={move}
          crew={null}
          token={PREVIEW_TRACK_TOKEN}
          fromNotify={false}
          paymentSuccess={false}
          linkExpired={false}
          additionalFeesCents={0}
          changeRequestFeesCents={0}
          extraItemFeesCents={0}
          tippingEnabled={false}
          showTipPrompt={false}
          tipData={null}
          crewSize={3}
          inventoryChangeFeatureOn={false}
          inventoryChangeItemWeights={[]}
          inventoryChangeEligible={false}
          inventoryChangeReason=""
          inventoryChangePending={null}
          inventoryChangePerScoreRate={35}
          inventoryChangeMaxItems={10}
          latestInventoryAdjustmentPayment={null}
          crewChangeRequest={null}
          binOrder={null}
          quotePickupStops={null}
        />
      </div>
    </div>
  );
}
