"use client";

import { useEffect, useState } from "react";
import { HandWaving, Lock, Check } from "@phosphor-icons/react";
import { ModalDialogFrame } from "@/components/ui/ModalDialogFrame";

type LoginTrackInfo = {
  orgOnboardingActive: boolean;
  portalWelcomeCompleted: boolean;
};

type TourMode = "standard" | "pm";

const STANDARD_FEATURES: { title: string; desc: string }[] = [
  {
    title: "Track Deliveries Live",
    desc: "GPS tracking with real-time crew locations on a map",
  },
  {
    title: "Schedule & Calendar",
    desc: "View upcoming deliveries in calendar view, schedule new ones",
  },
  {
    title: "Share Tracking Links",
    desc: "Send live tracking links to your end clients via email",
  },
  {
    title: "Invoices & Monthly Report",
    desc: "View invoices, monthly performance, and SLA report",
  },
];

const PM_FEATURES: { title: string; desc: string }[] = [
  {
    title: "Buildings & Moves",
    desc: "See your portfolio, units, and tenant move activity in one place",
  },
  {
    title: "Calendar & Scheduling",
    desc: "Plan moves and keep your teams aligned across properties",
  },
  {
    title: "Statements & Reporting",
    desc: "Review performance, statements, and monthly summaries",
  },
  {
    title: "Secure Access",
    desc: "Your property management portal is private to your organization",
  },
];

export function PartnerPortalWelcomeTour({
  contactName,
  mode,
  disabled = false,
}: {
  contactName: string;
  mode: TourMode;
  /** e.g. preview/sample portal — skip intro */
  disabled?: boolean;
}) {
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(0);

  useEffect(() => {
    if (disabled) return;
    const run = async () => {
      try {
        const res = await fetch("/api/partner/login-track");
        if (!res.ok) return;
        const info = (await res.json()) as LoginTrackInfo;
        if (info.orgOnboardingActive && !info.portalWelcomeCompleted) {
          setShowWelcome(true);
        }
      } catch {
        /* graceful fail */
      }
    };
    void run();
  }, [disabled]);

  const featureList = mode === "pm" ? PM_FEATURES : STANDARD_FEATURES;

  const completeWelcome = async () => {
    setShowWelcome(false);
    setWelcomeStep(0);
    try {
      await fetch("/api/partner/portal-welcome/complete", { method: "POST" });
      try {
        localStorage.setItem("yugo-welcome-seen", "1");
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  };

  if (!showWelcome) return null;

  return (
    <ModalDialogFrame
      zClassName="z-[99999]"
      className="items-center justify-center"
      backdropClassName=""
      panelClassName="bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)] border border-[var(--yu3-line)] shadow-[var(--yu3-shadow-lg)] rounded-[var(--yu3-r-xl)] w-full max-w-[520px] mx-4 overflow-hidden modal-card"
      ariaModal
    >
      <div className="flex justify-center gap-2 pt-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === welcomeStep ? 24 : 8,
              height: 8,
              background:
                i === welcomeStep
                  ? "#2C3E2D"
                  : i < welcomeStep
                    ? "#2C3E2D"
                    : "rgba(44, 62, 45, 0.2)",
            }}
          />
        ))}
      </div>

      <div className="p-8 pb-6">
        {welcomeStep === 0 && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#2C3E2D]/6 border border-[#2C3E2D]/15 flex items-center justify-center">
              <HandWaving
                size={36}
                weight="duotone"
                color="#2C3E2D"
                aria-hidden
              />
            </div>
            <h2 className="font-hero text-[36px] font-semibold text-[var(--tx)] mb-2">
              Welcome to Yugo, {contactName}!
            </h2>
            <p className="text-[var(--text-base)] text-[var(--tx3)] leading-relaxed max-w-[380px] mx-auto">
              Your dedicated partner portal is ready. Let&apos;s take a quick
              tour of what you can do here.
            </p>
          </div>
        )}

        {welcomeStep === 1 && (
          <div>
            <h3 className="font-hero text-[26px] font-semibold text-[var(--tx)] mb-5">
              Here&apos;s what you can do
            </h3>
            <div className="space-y-3">
              {featureList.map((item) => (
                <div
                  key={item.title}
                  className="p-3 rounded-xl border border-[var(--brd)]/30"
                >
                  <div className="text-[13px] font-semibold text-[var(--tx)]">
                    {item.title}
                  </div>
                  <div className="text-[12px] text-[var(--tx3)] mt-0.5">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {welcomeStep === 2 && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFF5F5] border border-[#FED7D7] flex items-center justify-center">
              <Lock size={28} color="#E53E3E" />
            </div>
            <h3 className="font-hero text-[26px] font-semibold text-[var(--tx)] mb-2">
              Secure your account
            </h3>
            <p className="text-[var(--text-base)] text-[var(--tx3)] leading-relaxed max-w-[360px] mx-auto mb-4">
              For your security, we strongly recommend changing your password to
              something personal and memorable.
            </p>
            <a
              href="/update-password"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-[#E53E3E] text-white hover:bg-[#C53030] transition-colors"
            >
              <Lock size={14} />
              Change Password Now
            </a>
            <button
              type="button"
              onClick={() => setWelcomeStep(3)}
              className="block mx-auto mt-3 text-[12px] text-[#5C5853] hover:text-[#454545] transition-colors"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              I&apos;ll do this later
            </button>
          </div>
        )}

        {welcomeStep === 3 && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0FFF4] border border-[#C6F6D5] flex items-center justify-center">
              <Check size={28} color="#2D6A4F" weight="bold" />
            </div>
            <h3 className="font-hero text-[26px] font-semibold text-[var(--tx)] mb-2">
              You&apos;re all set!
            </h3>
            <p className="text-[var(--text-base)] text-[var(--tx3)] leading-relaxed max-w-[360px] mx-auto">
              Your portal is ready. If you need help at any time, reach out to
              your Yugo account manager.
            </p>
          </div>
        )}
      </div>

      <div className="px-8 pb-8">
        {welcomeStep < 3 ? (
          <div className="flex gap-3">
            {welcomeStep > 0 && (
              <button
                type="button"
                onClick={() => setWelcomeStep(welcomeStep - 1)}
                className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:bg-[var(--bg2)] transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => setWelcomeStep(welcomeStep + 1)}
              className="flex-1 py-3 rounded-xl text-[13px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors"
            >
              {welcomeStep === 0 ? "Get started" : "Next"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void completeWelcome()}
            className="w-full py-3 rounded-xl text-[13px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors"
          >
            Go to Dashboard
          </button>
        )}
      </div>
    </ModalDialogFrame>
  );
}
