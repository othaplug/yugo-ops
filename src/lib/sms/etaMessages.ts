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
        "Yugo crew is on the way. " +
        "Estimated arrival in " +
        data.etaMinutes +
        " minutes. " +
        "Track live: " +
        data.trackingLink
      );

    case "eta_15_min":
      return (
        "Hi " +
        firstName +
        ", your " +
        partner +
        "Yugo crew is about 15 minutes away. " +
        "Please ensure access is clear and parking is available. " +
        "Track live: " +
        data.trackingLink
      );

    case "crew_arrived":
      return (
        "Hi " +
        firstName +
        ", your " +
        partner +
        "Yugo crew has arrived. They will be with you shortly."
      );

    case "in_progress":
      return (
        "Your move is underway. Your crew is taking excellent care " +
        "of your belongings every step of the way. " +
        "Track live: " +
        data.trackingLink
      );

    case "completed":
      return (
        "Your " +
        partner +
        "move is complete. " +
        "It was a pleasure taking care of you today. " +
        "Share your experience: " +
        data.trackingLink
      );

    case "crew_running_late":
      return (
        "Hi " +
        firstName +
        ", we want to keep you informed. Your " +
        partner +
        "Yugo crew is running approximately " +
        data.etaMinutes +
        " minutes behind schedule. We apologize for any inconvenience. Track live: " +
        data.trackingLink
      );

    default:
      return "";
  }
}
