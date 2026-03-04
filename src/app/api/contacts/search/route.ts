import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

interface CacheEntry {
  data: HubSpotContact[];
  ts: number;
}

interface HubSpotContact {
  hubspot_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  postal: string;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.ts > CACHE_TTL_MS) cache.delete(key);
  }
}

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ contacts: [] });
  }

  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ contacts: cached.data });
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { contacts: [], error: "HUBSPOT_ACCESS_TOKEN not configured" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: q,
          limit: 10,
          properties: [
            "firstname",
            "lastname",
            "email",
            "phone",
            "address",
            "city",
            "zip",
          ],
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { contacts: [], error: `HubSpot ${res.status}: ${text}` },
        { status: 502 },
      );
    }

    const json = await res.json();

    const contacts: HubSpotContact[] = (json.results ?? []).map(
      (r: { id: string; properties: Record<string, string | null> }) => {
        const p = r.properties;
        const first = (p.firstname ?? "").trim();
        const last = (p.lastname ?? "").trim();
        const city = (p.city ?? "").trim();
        const addr = (p.address ?? "").trim();
        const fullAddress = [addr, city].filter(Boolean).join(", ");

        return {
          hubspot_id: r.id,
          name: [first, last].filter(Boolean).join(" "),
          email: (p.email ?? "").trim(),
          phone: (p.phone ?? "").trim(),
          address: fullAddress,
          postal: (p.zip ?? "").trim(),
        };
      },
    );

    cache.set(cacheKey, { data: contacts, ts: Date.now() });

    if (cache.size > 200) pruneCache();

    return NextResponse.json({ contacts });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        contacts: [],
        error: err instanceof Error ? err.message : "HubSpot search failed",
      },
      { status: 500 },
    );
  }
}
