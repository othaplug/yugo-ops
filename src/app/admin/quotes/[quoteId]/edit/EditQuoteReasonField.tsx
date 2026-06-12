"use client";

import {
  QUOTE_UPDATE_REASONS,
  type QuoteUpdateReasonValue,
} from "./quote-update-reasons";

interface Props {
  reasonValue: QuoteUpdateReasonValue | "";
  reasonFreeText: string;
  onReasonValueChange: (v: QuoteUpdateReasonValue | "") => void;
  onReasonFreeTextChange: (v: string) => void;
  /** Reused so the field matches the surrounding form styling. */
  inputClass: string;
  labelClass: string;
}

/**
 * Curated reason-for-update field shown above the bottom save button on
 * the edit quote page. Required only at "Save & resend" time — the
 * parent enforces that in handleSendUpdate / handleSaveAndResend.
 *
 * The dropdown lives in ./quote-update-reasons.ts so the option list
 * stays in sync with the HubSpot deal-property values.
 */
export default function EditQuoteReasonField({
  reasonValue,
  reasonFreeText,
  onReasonValueChange,
  onReasonFreeTextChange,
  inputClass,
  labelClass,
}: Props) {
  return (
    <div className="border-t border-[var(--brd)] pt-4 space-y-3">
      <div>
        <label className={labelClass}>
          Reason for Update{" "}
          <span className="font-normal text-[var(--tx3)]">
            (required when you click Save &amp; resend — shown in the
            client email and HubSpot)
          </span>
        </label>
        <select
          value={reasonValue}
          onChange={(e) =>
            onReasonValueChange(
              (e.target.value as QuoteUpdateReasonValue) || "",
            )
          }
          className={inputClass}
        >
          <option value="">Select a reason…</option>
          {QUOTE_UPDATE_REASONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {reasonValue === "other" && (
        <div>
          <label className={labelClass}>
            Describe the change{" "}
            <span className="font-normal text-[var(--tx3)]">
              (this exact text is shown to the client)
            </span>
          </label>
          <input
            type="text"
            value={reasonFreeText}
            onChange={(e) => onReasonFreeTextChange(e.target.value)}
            placeholder="e.g. Switched packing service from full to partial"
            className={inputClass}
          />
        </div>
      )}
    </div>
  );
}
