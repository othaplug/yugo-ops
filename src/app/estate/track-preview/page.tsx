import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allowClientUiPreview } from "@/lib/client-ui-preview";
import {
  buildEstateTrackPreviewMoveActive,
  PREVIEW_TRACK_TOKEN,
} from "@/lib/track-move-client-preview-data";
import TrackMoveClient from "@/app/track/move/[id]/TrackMoveClient";
import PreviewChromeBanner from "@/app/track/move/preview/PreviewChromeBanner";

export const metadata: Metadata = {
  title: "Estate track (sample)",
  robots: { index: false, follow: false },
};

/** Estate tier uses the same track UI as Signature; this preview only swaps tier + code. */
export default function EstateTrackPreviewPage() {
  if (!allowClientUiPreview()) notFound();

  const move = buildEstateTrackPreviewMoveActive();

  return (
    <div className="flex flex-col h-screen min-h-0">
      <PreviewChromeBanner variant="estate" />
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
