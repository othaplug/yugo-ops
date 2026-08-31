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
      return [
        `Hi ${firstName},`,
        `Your ${partner}Yugo crew is on the way. Estimated arrival in ${data.etaMinutes} minutes.`,
        `Track: ${data.trackingLink}`,
      ].join("\n\n");

    case "eta_15_min":
      return [
        `Hi ${firstName},`,
        `Your ${partner}Yugo crew is about 15 minutes away. Please make sure access is clear and parking is available.`,
        `Track: ${data.trackingLink}`,
      ].join("\n\n");

    case "crew_arrived":
      return [
        `Hi ${firstName},`,
        `Your ${partner}Yugo crew has arrived and is ready to begin.`,
      ].join("\n\n");

    case "in_progress":
      return [
        `Your job is underway. Your crew is taking care of every step.`,
        `Track: ${data.trackingLink}`,
      ].join("\n\n");

    case "completed":
      return [
        `Hi ${firstName},`,
        `Your ${partner}move is complete. It was a pleasure taking care of you today.`,
        `Share your experience: ${data.trackingLink}`,
      ].join("\n\n");

    case "crew_running_late":
      return [
        `Hi ${firstName},`,
        `Quick update. Your ${partner}Yugo crew is running about ${data.etaMinutes} minutes behind schedule. Thanks for your patience; we will update you as soon as we can.`,
        `Track: ${data.trackingLink}`,
      ].join("\n\n");

    default:
      return "";
  }
}
