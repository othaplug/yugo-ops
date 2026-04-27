const INVALID_LEGACY = "claude-sonnet-4-20250514"
export const ANTHROPIC_VISION_DEFAULT = "claude-sonnet-4-5-20250929"

const FALLBACK_MODELS: readonly string[] = [
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-5",
  "claude-3-5-sonnet-20241022",
] as const

/**
 * If `ANTHROPIC_VISION_MODEL` is unset, uses Sonnet 4.5 (dated) then unversioned alias, then 3.5.
 */
export function getAnthropicVisionModelCandidates(): string[] {
  const fromEnv = (process.env.ANTHROPIC_VISION_MODEL || "").trim()
  const primary =
    fromEnv && fromEnv !== INVALID_LEGACY ? fromEnv : ANTHROPIC_VISION_DEFAULT
  return [...new Set([primary, ...FALLBACK_MODELS])]
}

export const ANTHROPIC_VISION_MODEL_ID = ANTHROPIC_VISION_DEFAULT
