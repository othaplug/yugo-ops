/**
 * Set HubSpot deal job_no (numeric string only, e.g. "3009") from OPS quote_id.
 */
export async function patchHubSpotDealJobNo(
  token: string,
  dealId: string,
  jobNoNumeric: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: { job_no: jobNoNumeric } }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}
