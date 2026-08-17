"use client";

/**
 * Event scope editor for the /admin/quotes/[quoteId]/edit page.
 *
 * Event quotes are priced outside the move engine, so the edit page
 * used to only expose logistics (date, venue address, coordinator).
 * Every other event field — name, setup/teardown, additional services,
 * truck config, arrival window, luxury flags, pallets/liftgate — was
 * only editable by generating a new quote. Operators asked for full
 * parity with the create form.
 *
 * This section owns its own state hydrated from factors_applied, and
 * calls onChange with a flat patch the details endpoint knows how to
 * merge back into factors_applied. Simple field set — full multi-leg
 * editing (per-leg items, per-leg fleet) stays in the Generate flow
 * because it changes pricing, which the details endpoint cannot
 * safely re-run for events.
 */

import { useEffect, useState } from "react";

export interface EventScopePatch {
  event_name?: string | null;
  event_scope_details?: string | null;
  event_setup_required?: boolean;
  event_setup_hours?: number;
  event_setup_instructions?: string | null;
  event_teardown_required?: boolean;
  event_same_day?: boolean;
  event_return_leg?: boolean;
  event_return_date?: string | null;
  event_additional_services?: string[];
  event_multi?: boolean;
  event_luxury?: boolean;
  event_complex_setup_required?: boolean;
  event_truck_type?: string;
  event_truck_count?: number;
  event_pallets?: number;
  event_pallet_jack?: boolean;
  event_liftgate?: boolean;
  event_dollies?: number;
  event_arrival_window?: string | null;
  event_hard_cutoff?: string | null;
  event_after_hours?: boolean;
  event_is_b2b?: boolean;
  event_b2b_invoice_terms?: "on_completion" | "net_15";
}

interface Props {
  factors: Record<string, unknown>;
  onPatch: (patch: EventScopePatch) => void;
  inputClass: string;
  labelClass: string;
}

const ADDITIONAL_SERVICES = [
  "Furniture assembly at venue",
  "Signage installation",
  "Staging and arrangement",
  "Overnight storage at Yugo facility",
];

const SETUP_HOURS_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "1 hour" },
  { value: 2, label: "2 hours" },
  { value: 3, label: "3 hours" },
  { value: 99, label: "Half-day" },
  { value: 100, label: "Full-day" },
];

const TRUCK_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "sprinter", label: "Sprinter van" },
  { value: "16ft", label: "16 ft truck" },
  { value: "20ft", label: "20 ft truck" },
  { value: "26ft", label: "26 ft truck" },
];

const ARRIVAL_WINDOW_OPTIONS = [
  "Any time on event day",
  "Early morning (6:00 AM – 8:00 AM)",
  "Morning (8:00 AM – 10:00 AM)",
  "Late morning (10:00 AM – 12:00 PM)",
  "Afternoon (12:00 PM – 3:00 PM)",
  "Evening (3:00 PM – 6:00 PM)",
  "After hours (6:00 PM – midnight)",
  "Overnight (midnight – 6:00 AM)",
];

const asBool = (v: unknown, dflt = false): boolean =>
  typeof v === "boolean" ? v : dflt;
const asStr = (v: unknown): string =>
  typeof v === "string" ? v : "";
const asNum = (v: unknown, dflt: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : dflt;

export default function EventScopeSection({
  factors,
  onPatch,
  inputClass,
  labelClass,
}: Props) {
  // Hydrate state from factors_applied. Everything is optional; missing
  // keys fall back to sensible defaults matching QuoteFormClient.
  const [eventName, setEventName] = useState<string>(asStr(factors.event_name));
  const [scopeDetails, setScopeDetails] = useState<string>(
    asStr(factors.event_scope_details) || asStr(factors.scope_details),
  );
  const [setupRequired, setSetupRequired] = useState<boolean>(
    asBool(factors.event_setup_required, false),
  );
  const [setupHours, setSetupHours] = useState<number>(
    asNum(factors.event_setup_hours, 2),
  );
  const [setupInstructions, setSetupInstructions] = useState<string>(
    asStr(factors.event_setup_instructions),
  );
  const [teardownRequired, setTeardownRequired] = useState<boolean>(
    asBool(factors.event_teardown_required, true),
  );
  const [sameDay, setSameDay] = useState<boolean>(
    asBool(factors.event_same_day, false),
  );
  const [returnLeg, setReturnLeg] = useState<boolean>(
    asBool(factors.event_return_leg, true),
  );
  const [returnDate, setReturnDate] = useState<string>(
    asStr(factors.event_return_date),
  );
  const [additionalServices, setAdditionalServices] = useState<string[]>(
    Array.isArray(factors.event_additional_services)
      ? (factors.event_additional_services as string[])
      : [],
  );
  const [luxury, setLuxury] = useState<boolean>(
    asBool(factors.event_luxury, false),
  );
  const [complexSetup, setComplexSetup] = useState<boolean>(
    asBool(factors.event_complex_setup_required, false),
  );
  const [truckType, setTruckType] = useState<string>(
    asStr(factors.event_truck_type) || "sprinter",
  );
  const [truckCount, setTruckCount] = useState<number>(
    asNum(factors.event_truck_count, 1),
  );
  const [pallets, setPallets] = useState<number>(
    asNum(factors.event_pallets, 0),
  );
  const [palletJack, setPalletJack] = useState<boolean>(
    asBool(factors.event_pallet_jack, false),
  );
  const [liftgate, setLiftgate] = useState<boolean>(
    asBool(factors.event_liftgate, false),
  );
  const [dollies, setDollies] = useState<number>(
    asNum(factors.event_dollies, 0),
  );
  const [arrivalWindow, setArrivalWindow] = useState<string>(
    asStr(factors.event_arrival_window),
  );
  const [hardCutoff, setHardCutoff] = useState<string>(
    asStr(factors.event_hard_cutoff),
  );
  const [afterHours, setAfterHours] = useState<boolean>(
    asBool(factors.event_after_hours, false),
  );
  const [isB2b, setIsB2b] = useState<boolean>(
    asBool(factors.event_is_b2b, false),
  );
  const [b2bTerms, setB2bTerms] = useState<"on_completion" | "net_15">(
    factors.event_b2b_invoice_terms === "net_15" ? "net_15" : "on_completion",
  );

  // Push a full patch upstream whenever any field changes so the parent
  // can dirty-check against baseline and enable Save.
  useEffect(() => {
    onPatch({
      event_name: eventName.trim() || null,
      event_scope_details: scopeDetails.trim() || null,
      event_setup_required: setupRequired,
      event_setup_hours: setupHours,
      event_setup_instructions: setupInstructions.trim() || null,
      event_teardown_required: teardownRequired,
      event_same_day: sameDay,
      event_return_leg: returnLeg,
      event_return_date: returnDate.trim() || null,
      event_additional_services: additionalServices,
      event_luxury: luxury,
      event_complex_setup_required: complexSetup,
      event_truck_type: truckType,
      event_truck_count: truckCount,
      event_pallets: pallets,
      event_pallet_jack: palletJack,
      event_liftgate: liftgate,
      event_dollies: dollies,
      event_arrival_window: arrivalWindow.trim() || null,
      event_hard_cutoff: hardCutoff.trim() || null,
      event_after_hours: afterHours,
      event_is_b2b: isB2b,
      event_b2b_invoice_terms: b2bTerms,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    eventName,
    scopeDetails,
    setupRequired,
    setupHours,
    setupInstructions,
    teardownRequired,
    sameDay,
    returnLeg,
    returnDate,
    additionalServices,
    luxury,
    complexSetup,
    truckType,
    truckCount,
    pallets,
    palletJack,
    liftgate,
    dollies,
    arrivalWindow,
    hardCutoff,
    afterHours,
    isB2b,
    b2bTerms,
  ]);

  const toggleService = (svc: string, on: boolean) => {
    setAdditionalServices((prev) =>
      on ? [...prev, svc] : prev.filter((s) => s !== svc),
    );
  };

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Event details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Event name</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. L'Oréal Beauty Event"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className={labelClass}>Service level</label>
            <div className="mt-1 flex rounded-md border border-[var(--brd)] overflow-hidden">
              <button
                type="button"
                onClick={() => setLuxury(false)}
                className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${
                  !luxury
                    ? "bg-[var(--gold)] text-white"
                    : "bg-[var(--bg)] text-[var(--tx3)]"
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setLuxury(true)}
                className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${
                  luxury
                    ? "bg-[var(--gold)] text-white"
                    : "bg-[var(--bg)] text-[var(--tx3)]"
                }`}
              >
                Luxury
              </button>
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass}>Scope details</label>
          <textarea
            value={scopeDetails}
            onChange={(e) => setScopeDetails(e.target.value)}
            rows={2}
            placeholder="e.g. 200 chairs + 30 rounds + AV + décor"
            className={`${inputClass} mt-1 font-normal`}
            style={{ resize: "vertical", minHeight: 60 }}
          />
        </div>
      </div>

      {/* Setup / teardown */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Setup and teardown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-md border border-[var(--brd)]">
            <input
              type="checkbox"
              checked={setupRequired}
              onChange={(e) => setSetupRequired(e.target.checked)}
              className="accent-[var(--gold)] w-4 h-4"
            />
            <span className="text-[12px] text-[var(--tx)]">Setup required at venue</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-md border border-[var(--brd)]">
            <input
              type="checkbox"
              checked={teardownRequired}
              onChange={(e) => setTeardownRequired(e.target.checked)}
              className="accent-[var(--gold)] w-4 h-4"
            />
            <span className="text-[12px] text-[var(--tx)]">Teardown required</span>
          </label>
        </div>
        {(setupRequired || complexSetup) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Setup hours</label>
              <select
                value={setupHours}
                onChange={(e) => setSetupHours(parseInt(e.target.value, 10) || 2)}
                className={`${inputClass} mt-1`}
              >
                {SETUP_HOURS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Setup instructions</label>
              <input
                type="text"
                value={setupInstructions}
                onChange={(e) => setSetupInstructions(e.target.value)}
                placeholder="e.g. dance floor first, then chairs"
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>
        )}
        {luxury && (
          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-md border border-[var(--brd)]">
            <input
              type="checkbox"
              checked={complexSetup}
              onChange={(e) => setComplexSetup(e.target.checked)}
              className="accent-[var(--gold)] w-4 h-4"
            />
            <span className="text-[12px] text-[var(--tx)]">
              Complex staging setup (luxury paid-setup applies)
            </span>
          </label>
        )}
      </div>

      {/* Return leg */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Return leg
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-md border border-[var(--brd)]">
            <input
              type="checkbox"
              checked={returnLeg}
              onChange={(e) => setReturnLeg(e.target.checked)}
              className="accent-[var(--gold)] w-4 h-4"
            />
            <span className="text-[12px] text-[var(--tx)]">Return leg needed</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-md border border-[var(--brd)]">
            <input
              type="checkbox"
              checked={sameDay}
              onChange={(e) => setSameDay(e.target.checked)}
              className="accent-[var(--gold)] w-4 h-4"
            />
            <span className="text-[12px] text-[var(--tx)]">Same-day return</span>
          </label>
          {returnLeg && !sameDay && (
            <div>
              <label className={labelClass}>Return date</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Additional services */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Additional services
        </h3>
        {ADDITIONAL_SERVICES.map((svc) => (
          <label key={svc} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={additionalServices.includes(svc)}
              onChange={(e) => toggleService(svc, e.target.checked)}
              className="accent-[var(--gold)] w-3.5 h-3.5"
            />
            <span className="text-[11px] text-[var(--tx2)]">{svc}</span>
          </label>
        ))}
      </div>

      {/* Fleet */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Fleet
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Truck type</label>
            <select
              value={truckType}
              onChange={(e) => setTruckType(e.target.value)}
              className={`${inputClass} mt-1`}
            >
              {TRUCK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Truck count</label>
            <input
              type="number"
              min={1}
              max={4}
              value={truckCount}
              onChange={(e) =>
                setTruckCount(Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 1)))
              }
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className={labelClass}>Pallets</label>
            <input
              type="number"
              min={0}
              max={20}
              value={pallets}
              onChange={(e) => setPallets(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-md border border-[var(--brd)]">
            <input
              type="checkbox"
              checked={palletJack}
              onChange={(e) => setPalletJack(e.target.checked)}
              className="accent-[var(--gold)] w-4 h-4"
            />
            <span className="text-[12px] text-[var(--tx)]">Pallet jack</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-md border border-[var(--brd)]">
            <input
              type="checkbox"
              checked={liftgate}
              onChange={(e) => setLiftgate(e.target.checked)}
              className="accent-[var(--gold)] w-4 h-4"
            />
            <span className="text-[12px] text-[var(--tx)]">Liftgate</span>
          </label>
          <div>
            <label className={labelClass}>Dollies</label>
            <input
              type="number"
              min={0}
              max={10}
              value={dollies}
              onChange={(e) => setDollies(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
      </div>

      {/* Scheduling */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Scheduling
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Arrival window</label>
            <select
              value={arrivalWindow}
              onChange={(e) => setArrivalWindow(e.target.value)}
              className={`${inputClass} mt-1`}
            >
              <option value="">Any time on event day</option>
              {ARRIVAL_WINDOW_OPTIONS.slice(1).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Hard cutoff (must be off-site by)</label>
            <input
              type="text"
              value={hardCutoff}
              onChange={(e) => setHardCutoff(e.target.value)}
              placeholder="e.g. off Bay St by 7 AM"
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer p-3 rounded-md border border-[var(--brd)]">
          <input
            type="checkbox"
            checked={afterHours}
            onChange={(e) => setAfterHours(e.target.checked)}
            className="accent-[var(--gold)] w-4 h-4"
          />
          <span className="text-[12px] text-[var(--tx)]">
            After-hours or early-morning premium applies
          </span>
        </label>
      </div>

      {/* B2B invoice */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Billing
        </h3>
        <label className="flex items-center gap-2 cursor-pointer p-3 rounded-md border border-[var(--brd)]">
          <input
            type="checkbox"
            checked={isB2b}
            onChange={(e) => setIsB2b(e.target.checked)}
            className="accent-[var(--gold)] w-4 h-4"
          />
          <span className="text-[12px] text-[var(--tx)]">
            Corporate / invoice billing (bypasses card capture)
          </span>
        </label>
        {isB2b && (
          <div>
            <label className={labelClass}>Invoice terms</label>
            <select
              value={b2bTerms}
              onChange={(e) =>
                setB2bTerms(e.target.value === "net_15" ? "net_15" : "on_completion")
              }
              className={`${inputClass} mt-1`}
            >
              <option value="on_completion">Due on completion</option>
              <option value="net_15">Net 15</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
