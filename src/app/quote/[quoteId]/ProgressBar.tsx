"use client";

import React from "react";
import { Check } from "@phosphor-icons/react";
import { FOREST } from "./quote-shared";
import { ESTATE_ON_WINE } from "./estate-quote-ui";

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
  /** Residential Estate — wine bar, rose accents, cream labels */
  estateMode?: boolean;
}

const ESTATE_ROSE = "#66143D";

export default function ProgressBar({ currentStep, onStepClick, estateMode = false }: Props) {
  return (
    <div
      className={`sticky top-0 z-10 px-4 py-3 overflow-x-auto border-b ${
        estateMode ? "border-[#66143D]/40 bg-[#2B0416]" : "border-[#2C3E2D]/10 bg-white"
      }`}
    >
      <ol role="list" className="flex items-center justify-center gap-1 md:gap-2 min-w-max" aria-label="Booking steps">
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const isComplete = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;

          const labelColor = estateMode
            ? isComplete || isCurrent
              ? ESTATE_ON_WINE.primary
              : ESTATE_ON_WINE.faded
            : isComplete
              ? FOREST
              : isCurrent
                ? FOREST
                : "#AAA";

          const connector = estateMode ? (
            <span
              className="w-4 h-px shrink-0 bg-[#66143D]"
              aria-hidden="true"
            />
          ) : (
            <span className="text-[10px] md:text-[11px] shrink-0" style={{ color: `${FOREST}25` }} aria-hidden="true">
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
                    estateMode ? "uppercase tracking-wider" : ""
                  }`}
                  style={{
                    color: labelColor,
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  {isComplete ? (
                    <Check
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: estateMode ? ESTATE_ROSE : FOREST }}
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
