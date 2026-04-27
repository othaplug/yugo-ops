import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicVisionModelCandidates } from "@/lib/ai/anthropic-vision-model";

export type AIInventorySuggestion = {
  name: string
  room: string
  weight: "light" | "standard" | "heavy" | "very_heavy"
  fragile: boolean
  quantity: number
  confidence: "high" | "medium" | "low"
  note?: string
}

const MAX_IMAGES = 15;

const WEIGHT_TO_TIER: Record<
  AIInventorySuggestion["weight"],
  "light" | "standard" | "heavy" | "very_heavy" | "super_heavy" | "extreme"
> = {
  light: "light",
  standard: "standard",
  heavy: "heavy",
  very_heavy: "very_heavy",
};

export { WEIGHT_TO_TIER };

function firstAssistantText(
  data: { content?: { type: string; text?: string }[] },
): string {
  const blocks = data.content;
  if (!Array.isArray(blocks)) return "";
  for (const b of blocks) {
    if (b?.type === "text" && typeof b.text === "string") return b.text;
  }
  return "";
}

/**
 * Call Claude with vision on survey photos. Uses signed URLs to read private storage objects.
 * Retries with alternate model ids if Anthropic returns a model/404-style error.
 */
export async function analyzePhotosWithAI(
  db: SupabaseClient,
  photoPathsByRoom: Record<string, string[]>,
): Promise<{ suggestions: AIInventorySuggestion[]; modelUsed: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI is not configured");
  }

  const content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: {
          type: "base64";
          media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
          data: string;
        };
      }
  > = [];

  const blocks: {
    roomId: string;
    b64: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  }[] = [];

  outer: for (const [roomId, paths] of Object.entries(photoPathsByRoom)) {
    if (!Array.isArray(paths)) continue;
    for (const p of paths) {
      if (typeof p !== "string" || !p.trim()) continue;
      if (blocks.length >= MAX_IMAGES) break outer;
      const { data: signed, error: signErr } = await db.storage
        .from("photo-surveys")
        .createSignedUrl(p.trim(), 120);
      if (signErr || !signed?.signedUrl) continue;
      const res = await fetch(signed.signedUrl);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 11 * 1024 * 1024) continue;
      const ct = (res.headers.get("content-type") || "image/jpeg").toLowerCase();
      const mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" =
        ct.includes("png")
          ? "image/png"
          : ct.includes("webp")
            ? "image/webp"
            : ct.includes("gif")
              ? "image/gif"
              : "image/jpeg";
      const b64 = buf.toString("base64");
      blocks.push({ roomId, b64, mediaType });
    }
  }

  const models = getAnthropicVisionModelCandidates();
  const firstModel = models[0] ?? "claude-sonnet-4-5-20250929";
  if (blocks.length === 0) {
    return { suggestions: [], modelUsed: firstModel };
  }

  const instruction = `You are analyzing photos of a home for a moving company. For each room photo, identify every piece of furniture and large item visible.

Return ONLY a JSON array. No other text. No markdown. No explanation.

Each item should be:
{
  "name": "descriptive name (e.g. '3-seater sofa', 'King bed frame with headboard')",
  "room": "room_id from the photo (must match the room_id we label)",
  "weight": "light" | "standard" | "heavy" | "very_heavy",
  "fragile": true/false,
  "quantity": number,
  "confidence": "high" | "medium" | "low",
  "note": "any special observation (material, condition, specialty handling needed)"
}

Weight guide:
- light: under 50 lbs (lamps, side tables, small boxes)
- standard: 50-150 lbs (chairs, desks, small dressers)
- heavy: 150-300 lbs (sofas, beds, large dressers, dining tables)
- very_heavy: over 300 lbs (pianos, safes, marble tables, large appliances)

Flag as fragile: glass, mirrors, marble, ceramic, antiques, electronics, artwork.
Count multiples (e.g. "dining chairs" quantity 6, not 6 separate entries).
Include appliances if visible. Include boxes or bins if visible (estimate count).
Do NOT include small items (books, decorations, kitchenware) unless in large quantity.`;

  content.push({ type: "text", text: instruction });

  for (const b of blocks) {
    content.push({ type: "text", text: `\n--- Room: ${b.roomId} ---` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: b.mediaType, data: b.b64 },
    });
  }

  const requestBody = {
    max_tokens: 4000,
    messages: [{ role: "user" as const, content }],
  };

  let lastErrorMessage = "Anthropic request failed";
  for (let i = 0; i < models.length; i++) {
    const model = models[i]!;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...requestBody, model }),
    });
    const data = (await response.json()) as {
      content?: { type: string; text?: string }[];
      error?: { message?: string; type?: string };
    };
    if (response.ok) {
      const text = firstAssistantText(data);
      try {
        const cleaned = text.replace(/```json|```/g, "").trim();
        const suggestions = JSON.parse(cleaned) as AIInventorySuggestion[];
        if (!Array.isArray(suggestions)) {
          return { suggestions: [], modelUsed: model };
        }
        return { suggestions, modelUsed: model };
      } catch {
        return { suggestions: [], modelUsed: model };
      }
    }
    const msg = data.error?.message || "Anthropic request failed";
    lastErrorMessage = msg;
    const atEnd = i === models.length - 1;
    const canRetryWithOtherModel = !atEnd && (response.status === 400 || response.status === 404);
    if (canRetryWithOtherModel) continue;
    throw new Error(msg);
  }
  throw new Error(lastErrorMessage);
}
