/**
 * HubSpot webhook signature tests (v1, v2, v3, constant-time, fail closed).
 * Run: npx tsx scripts/test-hubspot-signature.ts
 */
import { createHash, createHmac } from "crypto";
import {
  HUBSPOT_V3_MAX_AGE_MS,
  decodeV3Uri,
  hubSpotSignedUris,
  verifyHubSpotSignature,
} from "../src/lib/hubspot/verify-webhook-signature";

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};
const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

const SECRET = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy";
const URI = "https://www.yugoplus.co/api/webhooks/hubspot-contact";
const BODY = '[{"objectId":123,"properties":{"email":"a@b.co","phone":"4165550100"}}]';
const NOW = 1_760_000_000_000;

// Signatures built exactly as HubSpot documents them.
const v1 = createHash("sha256").update(SECRET + BODY).digest("hex");
const v2 = createHash("sha256").update(SECRET + "POST" + URI + BODY).digest("hex");
const ts = String(NOW - 1000);
const v3 = createHmac("sha256", SECRET).update("POST" + URI + BODY + ts).digest("base64");

const base = { secret: SECRET, method: "POST", uris: [URI], rawBody: BODY, nowMs: NOW };

console.log("valid signatures");
check(verifyHubSpotSignature({ ...base, headers: headers({ "x-hubspot-signature": v1, "x-hubspot-signature-version": "v1" }) }).valid, "v1 accepted");
check(verifyHubSpotSignature({ ...base, headers: headers({ "x-hubspot-signature": v1 }) }).valid, "v1 accepted with no version header");
check(verifyHubSpotSignature({ ...base, headers: headers({ "x-hubspot-signature": v2, "x-hubspot-signature-version": "v2" }) }).valid, "v2 accepted");
check(verifyHubSpotSignature({ ...base, headers: headers({ "x-hubspot-signature-v3": v3, "x-hubspot-request-timestamp": ts }) }).valid, "v3 accepted");
check(
  verifyHubSpotSignature({ ...base, uris: ["http://internal:3000/api/webhooks/hubspot-contact", URI], headers: headers({ "x-hubspot-signature": v2, "x-hubspot-signature-version": "v2" }) }).valid,
  "v2 accepted against the public URL when the internal URL differs",
);

console.log("HubSpot documentation vectors (v2)");
const DOC_SECRET = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy";
check(
  verifyHubSpotSignature({
    secret: DOC_SECRET,
    method: "GET",
    uris: ["https://www.example.com/webhook_uri"],
    rawBody: "",
    headers: headers({ "x-hubspot-signature": "eee2dddcc73c94d699f5e395f4b9d454a069a6855fbfa152e91e88823087200e", "x-hubspot-signature-version": "v2" }),
  }).valid,
  "docs v2 GET example",
);
check(
  verifyHubSpotSignature({
    secret: DOC_SECRET,
    method: "POST",
    uris: ["https://www.example.com/webhook_uri"],
    rawBody: '{"example_field":"example_value"}',
    headers: headers({ "x-hubspot-signature": "9569219f8ba981ffa6f6f16aa0f48637d35d728c7e4d93d0d52efaa512af7900", "x-hubspot-signature-version": "v2" }),
  }).valid,
  "docs v2 POST example",
);

console.log("v3 URI decoding");
const encUri = "https://www.yugoplus.co/api/webhooks/hubspot-contact?email=a%40b.co";
const v3enc = createHmac("sha256", SECRET).update("POST" + decodeV3Uri(encUri) + BODY + ts).digest("base64");
check(decodeV3Uri(encUri).endsWith("email=a@b.co"), "%40 decoded to @");
check(
  verifyHubSpotSignature({ ...base, uris: [encUri], headers: headers({ "x-hubspot-signature-v3": v3enc, "x-hubspot-request-timestamp": ts }) }).valid,
  "v3 signed over the decoded URI accepted",
);

console.log("rejected");
check(!verifyHubSpotSignature({ ...base, rawBody: BODY + " ", headers: headers({ "x-hubspot-signature": v1 }) }).valid, "tampered body rejected");
check(!verifyHubSpotSignature({ ...base, secret: "other", headers: headers({ "x-hubspot-signature": v1 }) }).valid, "wrong secret rejected");
check(!verifyHubSpotSignature({ ...base, secret: "  ", headers: headers({ "x-hubspot-signature": v1 }) }).valid, "missing secret fails closed");
check(!verifyHubSpotSignature({ ...base, headers: headers({}) }).valid, "missing signature rejected");
check(
  !verifyHubSpotSignature({ ...base, headers: headers({ "x-hubspot-signature": v2, "x-hubspot-signature-version": "v1" }) }).valid,
  "v2 hash under a v1 header rejected",
);
const oldBuggy = createHmac("sha256", SECRET).update(SECRET + BODY).digest("hex");
check(!verifyHubSpotSignature({ ...base, headers: headers({ "x-hubspot-signature": oldBuggy }) }).valid, "old HMAC-style value rejected");
const staleTs = String(NOW - HUBSPOT_V3_MAX_AGE_MS - 1);
const staleSig = createHmac("sha256", SECRET).update("POST" + URI + BODY + staleTs).digest("base64");
check(!verifyHubSpotSignature({ ...base, headers: headers({ "x-hubspot-signature-v3": staleSig, "x-hubspot-request-timestamp": staleTs }) }).valid, "v3 older than 5 minutes rejected");
check(!verifyHubSpotSignature({ ...base, headers: headers({ "x-hubspot-signature-v3": v3 }) }).valid, "v3 without timestamp rejected");
check(!verifyHubSpotSignature({ ...base, headers: headers({ "x-hubspot-signature": v1, "x-hubspot-signature-version": "v9" }) }).valid, "unknown version rejected");

console.log("signed URI candidates");
const uris = hubSpotSignedUris({
  url: "http://localhost:3000/api/webhooks/hubspot-contact?x=1",
  headers: headers({ "x-forwarded-host": "www.yugoplus.co", "x-forwarded-proto": "https" }),
});
check(uris[0] === "https://www.yugoplus.co/api/webhooks/hubspot-contact?x=1", "public URL tried first");
check(uris.includes("http://localhost:3000/api/webhooks/hubspot-contact?x=1"), "raw URL also tried");

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
