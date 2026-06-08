export type HubSpotAutoCreateDealResult =
  | { status: "created"; dealId: string }
  | {
      status: "duplicate";
      existingDealId: string;
      existingDealName: string;
      existingDealStageId: string;
    }
  /**
   * Helper hit a recoverable failure (HubSpot 4xx, missing config,
   * contact-create failed, etc.). reason is a short string suitable
   * for webhook_logs / audit trail — operators read it to see WHICH
   * property HubSpot rejected without having to fish in Vercel logs.
   */
  | { status: "failed"; reason: string }
  | null
