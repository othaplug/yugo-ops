"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Circle, Sparkle } from "@phosphor-icons/react";

const BG = "#FAF8F5";
const GOLD = "#2C3E2D";
const TEXT = "#2B3927";

type ProfileResponse = {
  email?: string | null;
  phone?: string | null;
  billing_email?: string | null;
};

function storageKey(orgId: string) {
  return `yugo-partner-onboarding-dismissed-${orgId}`;
}

export default function PartnerOnboardingChecklist({
  orgId,
  orgName,
  orgType,
  onDismiss,
}: {
  orgId: string;
  orgName: string;
  orgType: string;
  onDismiss: () => void;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [deliveryCount, setDeliveryCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [portalExplored, setPortalExplored] = useState(false);

  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        localStorage.getItem(storageKey(orgId))
      ) {
        setSuppressed(true);
      }
    } finally {
      setHydrated(true);
    }
  }, [orgId]);

  useEffect(() => {
    if (!hydrated || suppressed) return;
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const [profRes, dashRes] = await Promise.all([
          fetch("/api/partner/profile"),
          fetch("/api/partner/dashboard"),
        ]);
        if (!profRes.ok) {
          const j = await profRes.json().catch(() => ({}));
          throw new Error(
            (j as { error?: string }).error || "Could not load profile",
          );
        }
        if (!dashRes.ok) {
          const j = await dashRes.json().catch(() => ({}));
          throw new Error(
            (j as { error?: string }).error || "Could not load dashboard",
          );
        }
        const p = (await profRes.json()) as ProfileResponse;
        const d = (await dashRes.json()) as { deliveriesCount?: number };
        if (!cancelled) {
          setProfile(p);
          setDeliveryCount(
            typeof d.deliveriesCount === "number" ? d.deliveriesCount : 0,
          );
        }
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, suppressed, orgId]);

  const profileDone = Boolean(
    profile &&
    String(profile.phone ?? "").trim() &&
    String(profile.email ?? "").trim(),
  );
  const deliveryDone = deliveryCount !== null && deliveryCount > 0;
  const billingDone = Boolean(
    profile && String(profile.billing_email ?? "").trim(),
  );

  const items = useMemo(
    () => [
      {
        id: "profile",
        label: "Profile set up",
        description: "Add phone and email for your organization",
        done: profileDone,
      },
      {
        id: "delivery",
        label: "First delivery scheduled",
        description: "Book or complete at least one delivery",
        done: deliveryDone,
      },
      {
        id: "billing",
        label: "Billing configured",
        description: "Set a billing email for statements and invoices",
        done: billingDone,
      },
      {
        id: "portal",
        label: "Portal explored",
        description: "You’re ready, finish here when you’ve looked around",
        done: portalExplored,
      },
    ],
    [profileDone, deliveryDone, billingDone, portalExplored],
  );

  const completed = items.filter((i) => i.done).length;
  const progress = Math.round((completed / items.length) * 100);

  const handleDismiss = useCallback(() => {
    setPortalExplored(true);
    try {
      localStorage.setItem(storageKey(orgId), "1");
    } catch {
      /* ignore quota */
    }
    onDismiss();
  }, [orgId, onDismiss]);

  if (!hydrated || suppressed) return null;

  return (
    <div
      className="rounded-2xl border-2 p-5 shadow-sm"
      data-partner-type={orgType}
      style={{
        backgroundColor: BG,
        borderColor: GOLD,
        color: TEXT,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${GOLD}22` }}
        >
          <Sparkle
            className="h-6 w-6"
            style={{ color: GOLD }}
            weight="fill"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className="text-lg font-semibold leading-tight tracking-tight"
            style={{ color: TEXT }}
          >
            Welcome{orgName ? `, ${orgName}` : ""}
          </h2>
          <p className="mt-1 text-sm opacity-90">
            Complete these steps to get the most from your partner portal.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div
          className="mb-1 flex items-center justify-between text-xs font-medium"
          style={{ color: TEXT }}
        >
          <span>Progress</span>
          <span>
            {completed}/{items.length}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, backgroundColor: GOLD }}
          />
        </div>
      </div>

      {loadError && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {loadError}
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <span className="mt-0.5 shrink-0" aria-hidden>
              {item.done ? (
                <CheckCircle
                  className="h-6 w-6"
                  style={{ color: GOLD }}
                  weight="fill"
                />
              ) : (
                <Circle className="h-6 w-6 text-black/25" weight="duotone" />
              )}
            </span>
            <div>
              <p className="font-semibold leading-snug" style={{ color: TEXT }}>
                {item.label}
              </p>
              <p className="text-sm opacity-80">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-black/10 pt-4">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          style={{ color: TEXT, backgroundColor: `${GOLD}33` }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
