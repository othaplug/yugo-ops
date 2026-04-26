export type HubSpotAutoCreateDealResult =
  | { status: "created"; dealId: string }
  | {
      status: "duplicate";
      existingDealId: string;
      existingDealName: string;
      existingDealStageId: string;
    }
  | null
