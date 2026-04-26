/**
 * One sentence per client-facing subject: drop em-dash or ASCII " -- " kickers
 * (everything from that separator onward).
 */
export function normalizeEmailSubject(subject: string): string {
  const trimmed = subject.trim()
  if (!trimmed) return trimmed
  let s = trimmed
  const em = s.indexOf("—")
  if (em >= 0) {
    s = s.slice(0, em).trim()
  }
  const dbl = s.indexOf(" -- ")
  if (dbl >= 0) {
    s = s.slice(0, dbl).trim()
  }
  return s
}
