"use client";

import React from "react";
import { Check } from "@phosphor-icons/react";
import { FOREST } from "./quote-shared";
import { ESTATE_ON_WINE } from "./estate-quote-ui";
import { SIGNATURE_ON_SHELL, SIGNATURE_CTA } from "./signature-quote-ui";
import type { PremiumShellKind } from "./quote-premium-shell";

const STEPS = [
  { key: "plan", label: "Plan" },
  { key: "customize", label: "Customize" },
  { key: "protect", label: "Protect" },
  { key: "confirm", label: "Confirm" },
  { key: "book", label: "Book" },
] as const;

interface Props {
  currentStep: number;
  onStepClick?: (stepNum: number) => void;
  /** @deprecated use premiumShellKind */
  estateMode?: boolean;
  /** Residential Estate (wine) or Signature (green): dark bar, cream labels */
  premiumShellKind?: PremiumShellKind;
}

const ESTATE_ROSE = "#66143D";

export default function ProgressBar({
  currentStep,
  onStepClick,
  estateMode = false,
  premiumShellKind: premiumShellKindProp,
}: Props) {
  const kind: PremiumShellKind =
    premiumShellKindProp ??
    (estateMode ? "wine" : "none");
  const premium = kind !== "none";
  const shellInk = kind === "signature" ? SIGNATURE_ON_SHELL : ESTATE_ON_WINE;
  const barBg =
    kind === "signature" ? "#15261A" : kind === "wine" ? "#2B0416" : undefined;
  const barBorder =
    kind === "signature"
      ? "border-[#4A6B52]/40"
      : kind === "wine"
        ? "border-[#66143D]/40"
        : "border-[#2C3E2D]/10";
  const checkAccent = kind === "signature" ? SIGNATURE_CTA : ESTATE_ROSE;
  const connectorClass =
    kind === "signature"
      ? "w-4 h-px shrink-0 bg-[#4A6B52]"
      : kind === "wine"
        ? "w-4 h-px shrink-0 bg-[#66143D]"
        : null;

  return (
    <div
      className={`sticky top-0 z-10 px-4 py-3 overflow-x-auto border-b ${
        premium ? `${barBorder}` : "border-[#2C3E2D]/10 bg-white"
      }`}
      style={premium ? { backgroundColor: barBg } : undefined}
    >
      <ol
        role="list"
        className="flex items-center justify-center gap-1 md:gap-2 min-w-max"
        aria-label="Booking steps"
      >
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const isComplete = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;

          const labelColor = premium
            ? isComplete || isCurrent
              ? shellInk.primary
              : kind === "signature"
                ? shellInk.muted
                : shellInk.faded
            : isComplete
              ? FOREST
              : isCurrent
                ? FOREST
                : "#AAA";

          const connector = premium ? (
            <span className={connectorClass ?? ""} aria-hidden="true" />
          ) : (
            <span
              className="text-[10px] md:text-[11px] shrink-0"
              style={{ color: `${FOREST}25` }}
              aria-hidden="true"
            >
              ·
            </span>
          );

          return (
            <React.Fragment key={step.key}>
              {i > 0 && connector}
              <li>
                <button
                  type="button"
                  onClick={() => onStepClick?.(stepNum)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Step ${stepNum}: ${step.label}${isComplete ? " (completed)" : isCurrent ? " (current)" : ""}`}
                  className={`flex shrink-0 items-center gap-1 md:gap-1.5 text-[11px] md:text-[12px] font-medium transition-colors hover:opacity-80 whitespace-nowrap ${
                    premium ? "uppercase tracking-wider" : ""
                  }`}
                  style={{
                    color: labelColor,
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  {isComplete ? (
                    <Check
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: checkAccent }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span>{step.label}</span>
                </button>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}
