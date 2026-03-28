/**
 * Extract date-like strings from free text (month names + numeric patterns).
 */
export function detectMultipleDates(text: string): string[] {
  if (!text || !text.trim()) return [];
  const monthNames =
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?/gi;
  const datePatterns = text.match(monthNames) || [];
  const numericDates = text.match(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g) || [];
  const isoLike = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  return [...new Set([...datePatterns, ...numericDates, ...isoLike].map((s) => s.trim()))];
}
