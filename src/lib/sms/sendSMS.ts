function toE164NorthAmerica(raw: string): string {
  let phone = raw.trim();
  if (!phone.startsWith("+")) {
    phone = "+1" + phone.replace(/\D/g, "");
  }
  return phone;
}

export async function sendSMS(
  to: string,
  body: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.OPENPHONE_API_KEY;
  const phoneNumberId = process.env.OPENPHONE_PHONE_NUMBER_ID;

  if (!apiKey || !phoneNumberId) {
    return { success: false, error: "OpenPhone not configured" };
  }

  try {
    const formattedPhone = toE164NorthAmerica(to);

    const response = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: body,
        to: [formattedPhone],
        from: phoneNumberId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || "OpenPhone API error" };
    }

    return { success: true, id: data.data?.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("OpenPhone SMS error:", msg);
    return { success: false, error: msg };
  }
}
