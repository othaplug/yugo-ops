"use client";

import React from "react";
import { Check } from "@phosphor-icons/react";
import { FOREST } from "./quote-shared";

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
}

export default function ProgressBar({ currentStep, onStepClick }: Props) {
  return (
    <div
      className="sticky top-0 z-10 px-4 py-3 border-b border-[#2C3E2D]/10 overflow-x-auto bg-white"
    >
      <ol role="list" className="flex items-center justify-center gap-1 md:gap-2 min-w-max" aria-label="Booking steps">
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const isComplete = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;

          return (
            <React.Fragment key={step.key}>
              {i > 0 && (
                <span className="text-[10px] md:text-[11px] shrink-0" style={{ color: `${FOREST}25` }} aria-hidden="true">
                  ·
                </span>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => onStepClick?.(stepNum)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Step ${stepNum}: ${step.label}${isComplete ? " (completed)" : isCurrent ? " (current)" : ""}`}
                  className="flex shrink-0 items-center gap-1 md:gap-1.5 text-[11px] md:text-[12px] font-medium transition-colors hover:opacity-80 whitespace-nowrap"
                  style={{
                    color: isComplete ? FOREST : isCurrent ? FOREST : "#AAA",
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  {isComplete ? (
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: FOREST }} aria-hidden="true" />
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
