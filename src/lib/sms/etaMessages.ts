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
        `We will keep you updated as your job progresses.\n${data.trackingLink}`,
      ].join("\n\n");

    case "eta_15_min":
      return [
        `Hi ${firstName},`,
        `Your ${partner}Yugo crew is about 15 minutes away.`,
        `Please ensure access is clear and parking is available.\n${data.trackingLink}`,
      ].join("\n\n");

    case "crew_arrived":
      return [
        `Hi ${firstName},`,
        `Your ${partner}Yugo crew has arrived and is ready to begin. You are in great hands.`,
      ].join("\n\n");

    case "in_progress":
      return [
        `Hi ${firstName},`,
        `Your move is underway. Your crew is taking exceptional care of your belongings at every step.`,
        `Track live:\n${data.trackingLink}`,
      ].join("\n\n");

    case "completed":
      return [
        `Hi ${firstName},`,
        `Your ${partner}move is complete. It was a pleasure taking care of you today.`,
        `Share your experience:\n${data.trackingLink}`,
      ].join("\n\n");

    case "crew_running_late":
      return [
        `Hi ${firstName},`,
        `We want to keep you informed. Your ${partner}Yugo crew is running approximately ${data.etaMinutes} minutes behind schedule.`,
        `We appreciate your patience and will update you as soon as we can.\n${data.trackingLink}`,
      ].join("\n\n");

    default:
      return "";
  }
}
