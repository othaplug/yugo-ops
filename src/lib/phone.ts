/**
 * Global phone formatting: display as (123) 456-7890, store as digits only.
 */

/** Placeholder for phone inputs — use everywhere for consistency. */
export const PHONE_PLACEHOLDER = "(123) 456-7890";

/** Normalize to digits only (last 10 for US). Use for storage, API, and tel: links. */
export function normalizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

/**
 * Format for display as (123) 456-7890.
 * Accepts any string (digits, dashes, parens); uses last 10 digits.
 * Returns "" if no digits; otherwise partial format for &lt;10 digits, full for 10.
 */
export function formatPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "").slice(-10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Count digits in str between start (inclusive) and end (exclusive). Used for cursor placement. */
export function countDigitsInRange(str: string, start: number, end: number): number {
  let count = 0;
  for (let i = start; i < end && i < str.length; i++) {
    if (/\d/.test(str[i]!)) count++;
  }
  return count;
}

/** Index in formatted string where cursor should go so that exactly digitIndex digits appear before it. */
export function getPhoneCursorPosition(formatted: string, digitIndex: number): number {
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      if (count === digitIndex) return i + 1;
      count++;
    }
  }
  return formatted.length;
}
