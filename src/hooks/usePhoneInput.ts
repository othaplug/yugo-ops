"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { formatPhone, countDigitsInRange, getPhoneCursorPosition } from "@/lib/phone";

/**
 * Use with a controlled phone input so the value is formatted as (123) 456-7890
 * while the user types. Preserves cursor position across formatting.
 *
 * Usage:
 *   const phoneInputRef = usePhoneInput(phone, setPhone);
 *   <input ref={phoneInputRef.ref} type="tel" value={phone} onChange={phoneInputRef.onChange} ... />
 */
export function usePhoneInput(value: string, setValue: (v: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextCursorRef = useRef<number | null>(null);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const raw = input.value.replace(/\D/g, "").slice(-10);
      const formatted = formatPhone(raw);
      setValue(formatted);
      const digitCountBeforeCursor = countDigitsInRange(input.value, 0, input.selectionStart ?? 0);
      nextCursorRef.current = getPhoneCursorPosition(formatted, digitCountBeforeCursor);
    },
    [setValue]
  );

  useLayoutEffect(() => {
    if (nextCursorRef.current !== null && inputRef.current) {
      const pos = nextCursorRef.current;
      inputRef.current.setSelectionRange(pos, pos);
      nextCursorRef.current = null;
    }
  });

  return { ref: inputRef, onChange };
}
