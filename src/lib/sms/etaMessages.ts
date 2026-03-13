export interface ETAMessageData {
  recipientName: string;
  originAddress: string;
  destinationAddress: string;
  etaMinutes: number;
  trackingLink: string;
  crewNames?: string;
  partnerName?: string;
}

export function buildETAMessage(messageType: string, data: ETAMessageData): string {
  const firstName = data.recipientName.split(" ")[0];
  const partner = data.partnerName ? data.partnerName + " " : "";

  switch (messageType) {
    case "crew_departed":
      return (
        "Hi " +
        firstName +
        ", your " +
        partner +
        "Yugo crew is on their way. " +
        "Estimated arrival: " +
        data.etaMinutes +
        " minutes. " +
        "Track live: " +
        data.trackingLink
      );

    case "eta_15_min":
      return (
        "Your " +
        partner +
        "Yugo crew is about 15 minutes away. " +
        "Please ensure access is clear. " +
        "Track: " +
        data.trackingLink
      );

    case "crew_arrived":
      return "Your " + partner + "Yugo crew has arrived! " + "They will be at your door shortly.";

    case "in_progress":
      return (
        "Your move is underway. Your crew is taking great care " +
        "of your belongings. " +
        "Track: " +
        data.trackingLink
      );

    case "completed":
      return (
        "Your " +
        partner +
        "delivery is complete! " +
        "We hope everything went perfectly. " +
        "Rate your experience: " +
        data.trackingLink
      );

    default:
      return "";
  }
}
