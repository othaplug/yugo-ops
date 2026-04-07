"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import { Minus, Plus, X } from "@phosphor-icons/react";
import { PRICING_ZONES, TORONTO_CENTER_LNG_LAT } from "@/lib/maps/pricing-zones";
import {
  VERTICAL_CONFIG,
  ADMIN_VERTICAL_OPTIONS,
} from "@/lib/maps/vertical-config";
import type { PricingZone } from "@/lib/maps/pricing-zones";

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

const HAS_MAPBOX =
  MAPBOX_TOKEN &&
  !MAPBOX_TOKEN.startsWith("pk.your-") &&
  MAPBOX_TOKEN !== "pk.your-mapbox-token";

mapboxgl.accessToken = MAPBOX_TOKEN || "pk.invalid";

const PANEL_BG = "#F9EDE4";
const WINE = "#2B0416";
const ROSE = "#66143D";

export interface PartnerPricingMapProps {
  partnerId?: string;
  /** `delivery_verticals.code` — locked for partners */
  partnerVertical?: string;
  isAdmin?: boolean;
}

type LineItem = { name: string; qty: number };

type CoverageEstimateJson = {
  subtotal: number;
  dist_km: number;
  drive_time_min: number | null;
  vertical_name: string;
  vertical_code: string;
  engine_handling: string;
  sample_address: string;
  breakdown: { label: string; amount: number }[];
};

function consolidateItems(raw: LineItem[]): LineItem[] {
  const m = new Map<string, number>();
  for (const { name, qty } of raw) {
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    if (!q) continue;
    m.set(name, (m.get(name) ?? 0) + q);
  }
  return [...m.entries()].map(([name, qty]) => ({ name, qty }));
}

function getQty(items: LineItem[], name: string): number {
  return items
    .filter((i) => i.name === name)
    .reduce((s, i) => s + i.qty, 0);
}

function setNameQty(items: LineItem[], name: string, qty: number): LineItem[] {
  const rest = items.filter((i) => i.name !== name);
  if (qty <= 0) return consolidateItems(rest);
  return consolidateItems([...rest, { name, qty }]);
}

const HANDLING_OPTIONS: { key: string; label: string }[] = [
  { key: "threshold", label: "Threshold" },
  { key: "room_of_choice", label: "Room of choice" },
  { key: "white_glove", label: "White glove" },
  { key: "install", label: "Install" },
];

const CITIES: { name: string; coords: [number, number] }[] = [
  { name: "Mississauga", coords: [-79.6441, 43.589] },
  { name: "Brampton", coords: [-79.7624, 43.7315] },
  { name: "Markham", coords: [-79.337, 43.8561] },
  { name: "Vaughan", coords: [-79.5085, 43.8563] },
  { name: "Hamilton", coords: [-79.8711, 43.2557] },
  { name: "Oakville", coords: [-79.6877, 43.4675] },
  { name: "Oshawa", coords: [-78.8658, 43.8971] },
  { name: "Barrie", coords: [-79.6903, 44.3894] },
  { name: "Kitchener", coords: [-80.4925, 43.4516] },
  { name: "Peterborough", coords: [-78.3197, 44.3091] },
  { name: "St. Catharines", coords: [-79.2469, 43.1594] },
  { name: "London", coords: [-81.2453, 42.9849] },
  { name: "Kingston", coords: [-76.486, 44.2312] },
  { name: "Newmarket", coords: [-79.4613, 44.0592] },
  { name: "Whitby", coords: [-78.9429, 43.8975] },
  { name: "Burlington", coords: [-79.799, 43.3255] },
  { name: "Milton", coords: [-79.8774, 43.5183] },
  { name: "Richmond Hill", coords: [-79.4403, 43.8828] },
  { name: "Pickering", coords: [-79.089, 43.8354] },
  { name: "Ajax", coords: [-79.0204, 43.8509] },
];

function buildZoneGeoJson(zoneIndex: number): GeoJSON.Feature {
  const zone = PRICING_ZONES[zoneIndex];
  const outer = turf.circle(TORONTO_CENTER_LNG_LAT, zone.radiusKm, {
    units: "kilometers",
    steps: 80,
  });
  if (zoneIndex === 0) {
    return outer;
  }
  const innerZone = PRICING_ZONES[zoneIndex - 1];
  const inner = turf.circle(TORONTO_CENTER_LNG_LAT, innerZone.radiusKm, {
    units: "kilometers",
    steps: 80,
  });
  try {
    const diff = turf.difference(
      turf.featureCollection([outer as GeoJSON.Feature<GeoJSON.Polygon>, inner as GeoJSON.Feature<GeoJSON.Polygon>]),
    );
    if (diff) return diff;
  } catch {
    /* fall through */
  }
  return outer;
}

function estimateCacheKey(
  zoneId: string,
  vertical: string,
  handling: string,
  itemsKey: string,
): string {
  return `${zoneId}|${vertical}|${handling}|${itemsKey}`;
}

function bandFromSubtotal(subtotal: number): { low: number; mid: number; high: number } {
  const mid = Math.round(subtotal / 25) * 25;
  const low = Math.round((subtotal * 0.92) / 25) * 25;
  const high = Math.round((subtotal * 1.1) / 25) * 25;
  return { low, mid, high };
}

export default function PartnerPricingMap({
  partnerVertical,
  isAdmin = false,
}: PartnerPricingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const estimateCache = useRef(
    new Map<string, CoverageEstimateJson>(),
  );

  const [selectedVertical, setSelectedVertical] = useState(
    partnerVertical || "",
  );
  const [items, setItems] = useState<LineItem[]>([]);
  const [handling, setHandling] = useState("threshold");
  const [hoveredZone, setHoveredZone] = useState<PricingZone | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [customName, setCustomName] = useState("");
  const [customQty, setCustomQty] = useState(1);

  const [estimate, setEstimate] = useState<{
    status: "idle" | "loading" | "ok" | "error";
    data?: CoverageEstimateJson;
    message?: string;
  }>({ status: "idle" });

  const itemsConsolidated = useMemo(() => consolidateItems(items), [items]);
  const itemsKey = useMemo(
    () =>
      JSON.stringify(
        [...itemsConsolidated].sort((a, b) => a.name.localeCompare(b.name)),
      ),
    [itemsConsolidated],
  );

  useEffect(() => {
    if (partnerVertical) setSelectedVertical(partnerVertical);
  }, [partnerVertical]);

  useEffect(() => {
    if (!hoveredZone || !selectedVertical || itemsConsolidated.length === 0) {
      setEstimate({ status: "idle" });
      return;
    }

    const url = isAdmin
      ? "/api/admin/coverage-estimate"
      : "/api/partner/coverage-estimate";
    const cacheKey = estimateCacheKey(
      hoveredZone.id,
      selectedVertical,
      handling,
      itemsKey,
    );
    const cached = estimateCache.current.get(cacheKey);
    if (cached) setEstimate({ status: "ok", data: cached });
    else setEstimate({ status: "loading" });

    const ac = new AbortController();
    const t = window.setTimeout(() => {
      const body = {
        zone_id: hoveredZone.id,
        vertical_code: selectedVertical,
        handling_type: handling,
        items: itemsConsolidated.map((i) => ({
          description: i.name,
          quantity: i.qty,
        })),
      };

      fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      })
        .then(async (res) => {
          const json = (await res.json().catch(() => ({}))) as Record<
            string,
            unknown
          >;
          if (!res.ok) {
            throw new Error(
              String(json.error || json.detail || `Request failed (${res.status})`),
            );
          }
          return json as CoverageEstimateJson;
        })
        .then((data) => {
          estimateCache.current.set(cacheKey, data);
          setEstimate({ status: "ok", data });
        })
        .catch((e: unknown) => {
          const name =
            typeof e === "object" && e !== null && "name" in e
              ? String((e as { name: string }).name)
              : "";
          if (name === "AbortError") return;
          const msg =
            e instanceof Error ? e.message : "Could not load estimate";
          setEstimate({ status: "error", message: msg });
        });
    }, 380);

    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [hoveredZone?.id, selectedVertical, handling, itemsKey, isAdmin]);

  useEffect(() => {
    if (!mapContainer.current || !HAS_MAPBOX) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: TORONTO_CENTER_LNG_LAT,
      zoom: 8.2,
      minZoom: 6.5,
      maxZoom: 13,
      attributionControl: false,
      maxBounds: [
        [-83.0, 41.5],
        [-75.5, 46.0],
      ],
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      try {
        map.setPaintProperty("water", "fill-color", "#E8DFD5");
      } catch {
        /* optional */
      }
      try {
        map.setPaintProperty("land", "background-color", "#F5F0EB");
      } catch {
        /* optional */
      }
      try {
        map.setPaintProperty("road-primary", "line-color", "#D8CFC4");
        map.setPaintProperty("road-secondary-tertiary", "line-color", "#E0D8CE");
        map.setPaintProperty("road-street", "line-color", "#E8E0D6");
      } catch {
        /* optional */
      }

      for (let i = PRICING_ZONES.length - 1; i >= 0; i--) {
        const zone = PRICING_ZONES[i];
        const shape = buildZoneGeoJson(i);

        map.addSource(`zone-${zone.id}`, {
          type: "geojson",
          data: shape,
        });

        map.addLayer({
          id: `zone-fill-${zone.id}`,
          type: "fill",
          source: `zone-${zone.id}`,
          paint: {
            "fill-color": zone.color,
            "fill-opacity": zone.fillOpacity,
          },
        });

        map.addLayer({
          id: `zone-border-${zone.id}`,
          type: "line",
          source: `zone-${zone.id}`,
          paint: {
            "line-color": zone.color,
            "line-width": 1.2,
            "line-opacity": zone.borderOpacity,
            "line-dasharray": [5, 3],
          },
        });

        map.on("mouseenter", `zone-fill-${zone.id}`, () => {
          map.getCanvas().style.cursor = "pointer";
          try {
            map.setPaintProperty(
              `zone-fill-${zone.id}`,
              "fill-opacity",
              zone.fillOpacity + 0.08,
            );
            map.setPaintProperty(`zone-border-${zone.id}`, "line-width", 2.5);
          } catch {
            /* ignore */
          }
          setHoveredZone(zone);
        });

        map.on("mouseleave", `zone-fill-${zone.id}`, () => {
          map.getCanvas().style.cursor = "";
          try {
            map.setPaintProperty(
              `zone-fill-${zone.id}`,
              "fill-opacity",
              zone.fillOpacity,
            );
            map.setPaintProperty(`zone-border-${zone.id}`, "line-width", 1.2);
          } catch {
            /* ignore */
          }
          setHoveredZone(null);
        });

        map.on("mousemove", `zone-fill-${zone.id}`, (e) => {
          setTooltipPos({ x: e.point.x, y: e.point.y });
          setHoveredZone(zone);
        });
      }

      const markerEl = document.createElement("div");
      markerEl.innerHTML = `
       <div style="
         width: 32px; height: 32px; border-radius: 50%;
         background: ${WINE}; border: 3px solid ${PANEL_BG};
         display: flex; align-items: center; justify-content: center;
         box-shadow: 0 2px 8px rgba(0,0,0,0.2);
         font-family: Georgia, serif; font-size: 9px;
         color: ${PANEL_BG}; letter-spacing: 1px; font-weight: bold;
       ">Y</div>
     `;
      new mapboxgl.Marker(markerEl)
        .setLngLat(TORONTO_CENTER_LNG_LAT)
        .addTo(map);

      map.addSource("cities", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: CITIES.map((c) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: c.coords },
            properties: { name: c.name },
          })),
        },
      });

      map.addLayer({
        id: "city-dots",
        type: "circle",
        source: "cities",
        paint: {
          "circle-radius": 3,
          "circle-color": WINE,
          "circle-opacity": 0.3,
        },
      });

      map.addLayer({
        id: "city-labels",
        type: "symbol",
        source: "cities",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-size": 11,
          "text-offset": [0, -1.2],
          "text-anchor": "bottom",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": WINE,
          "text-opacity": 0.5,
          "text-halo-color": "#F5F0EB",
          "text-halo-width": 2,
        },
      });
    });

    return () => {
      map.remove();
    };
  }, []);

  const adjustLineQty = useCallback((name: string, delta: number) => {
    setItems((prev) => {
      const cur = getQty(prev, name);
      return setNameQty(prev, name, cur + delta);
    });
  }, []);

  const removeLine = useCallback((name: string) => {
    setItems((prev) => prev.filter((i) => i.name !== name));
  }, []);

  const sortedLines = useMemo(() => {
    const cfg = selectedVertical ? VERTICAL_CONFIG[selectedVertical] : null;
    const order = new Map(
      (cfg?.quickAdd ?? []).map((n, i) => [n, i] as const),
    );
    return [...itemsConsolidated].sort((a, b) => {
      const oa = order.has(a.name) ? order.get(a.name)! : 999;
      const ob = order.has(b.name) ? order.get(b.name)! : 999;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });
  }, [itemsConsolidated, selectedVertical]);

  if (!HAS_MAPBOX) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-[#2C3E2D]/15 bg-[#F9EDE4] px-6 py-16 text-center"
        style={{ minHeight: 400 }}
      >
        <p className="text-sm font-medium" style={{ color: WINE }}>
          Map unavailable
        </p>
        <p className="mt-2 max-w-md text-[13px] text-[#5A6B5E] leading-relaxed">
          Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (or NEXT_PUBLIC_MAPBOX_TOKEN) to
          enable the coverage map.
        </p>
      </div>
    );
  }

  const vConfig = selectedVertical ? VERTICAL_CONFIG[selectedVertical] : null;

  return (
    <div className="relative w-full min-h-[560px] sm:min-h-[680px] rounded-xl overflow-hidden border border-[#2C3E2D]/12">
      <div ref={mapContainer} className="w-full h-[560px] sm:h-[680px]" />

      <div
        className="absolute top-3 left-3 w-[min(100%-1.5rem,320px)] max-h-[min(100%-1.5rem,92vh)] z-10 rounded-xl overflow-hidden border border-[#2C3E2D]/12 shadow-lg flex flex-col"
        style={{ background: `${PANEL_BG}/95`, backdropFilter: "blur(14px)" }}
      >
        <div className="px-4 py-3.5 shrink-0" style={{ background: WINE, color: PANEL_BG }}>
          <h2 className="text-xs font-medium tracking-[1.5px] uppercase font-[family-name:var(--font-body)]">
            Delivery pricing map
          </h2>
          <p className="text-[11px] opacity-50 mt-0.5 leading-snug">
            Dimensional pricing from your contract · hover a zone for a sample
            stop in that band
          </p>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 flex flex-col">
          <div className="px-4 py-3.5 border-b border-[#2C3E2D]/10 shrink-0">
            <p className="text-[10px] uppercase tracking-[1.2px] text-[#5A6B5E] font-medium mb-2 font-[family-name:var(--font-body)]">
              Delivery vertical
            </p>
            {isAdmin ? (
              <select
                value={selectedVertical}
                onChange={(e) => {
                  setSelectedVertical(e.target.value);
                  setItems([]);
                  estimateCache.current.clear();
                }}
                className="w-full p-2.5 border border-[#2C3E2D]/15 rounded-lg text-sm bg-white text-[#1a1f1b]"
              >
                <option value="">Select vertical</option>
                {ADMIN_VERTICAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium" style={{ color: WINE }}>
                {vConfig?.label ?? "Not configured"}
              </p>
            )}
          </div>

          <div className="px-4 py-3.5 border-b border-[#2C3E2D]/10 shrink-0">
            <p className="text-[10px] uppercase tracking-[1.2px] text-[#5A6B5E] font-medium mb-2 font-[family-name:var(--font-body)]">
              Line items
              {itemsConsolidated.length > 0 && (
                <span
                  className="ml-2 inline-block text-[9px] px-2 py-0.5 rounded-full font-[family-name:var(--font-body)]"
                  style={{ background: ROSE, color: PANEL_BG }}
                >
                  {itemsConsolidated.reduce((s, i) => s + i.qty, 0)} pcs
                </span>
              )}
            </p>

            <div className="max-h-[100px] overflow-y-auto space-y-1.5 mb-2">
              {sortedLines.length === 0 ? (
                <p className="text-[11px] text-[#5A6B5E] py-1">
                  Add items below to price zones
                </p>
              ) : (
                sortedLines.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 border border-[#2C3E2D]/8"
                    style={{ background: `${PANEL_BG}/90` }}
                  >
                    <span
                      className="font-medium min-w-0 flex-1 truncate"
                      style={{ color: WINE }}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name}`}
                        onClick={() => adjustLineQty(item.name, -1)}
                        className="p-1 rounded border border-[#2C3E2D]/15 text-[#5A6B5E] hover:bg-white"
                      >
                        <Minus size={12} weight="bold" />
                      </button>
                      <span className="w-6 text-center text-[11px] font-semibold tabular-nums">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.name}`}
                        onClick={() => adjustLineQty(item.name, 1)}
                        className="p-1 rounded border border-[#2C3E2D]/15 text-[#5A6B5E] hover:bg-white"
                      >
                        <Plus size={12} weight="bold" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(item.name)}
                      className="p-1 text-[#5A6B5E] hover:text-[#9B3A5A] shrink-0"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {selectedVertical && VERTICAL_CONFIG[selectedVertical] && (
              <div>
                <p className="text-[10px] uppercase tracking-[1.2px] text-[#5A6B5E] font-medium mb-1.5 font-[family-name:var(--font-body)]">
                  Quick add
                </p>
                <div className="max-h-[200px] overflow-y-auto space-y-1 pr-0.5">
                  {VERTICAL_CONFIG[selectedVertical].quickAdd.map((name) => {
                    const q = getQty(items, name);
                    return (
                      <div
                        key={name}
                        className="flex items-center gap-1.5 text-[11px] bg-white/90 border border-[#2C3E2D]/10 rounded-lg px-2 py-1.5"
                      >
                        <span
                          className="flex-1 min-w-0 leading-tight text-[#2B0416]"
                          title={name}
                        >
                          {name}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            aria-label={`${name} minus one`}
                            onClick={() =>
                              setItems((prev) =>
                                setNameQty(prev, name, getQty(prev, name) - 1),
                              )
                            }
                            className="p-1 rounded border border-[#2C3E2D]/15 text-[#5A6B5E] hover:border-[#66143D] hover:text-[#66143D]"
                          >
                            <Minus size={12} weight="bold" />
                          </button>
                          <span className="w-6 text-center font-semibold tabular-nums text-[#2B0416]">
                            {q}
                          </span>
                          <button
                            type="button"
                            aria-label={`${name} plus one`}
                            onClick={() =>
                              setItems((prev) =>
                                setNameQty(prev, name, getQty(prev, name) + 1),
                              )
                            }
                            className="p-1 rounded border border-[#2C3E2D]/15 text-[#5A6B5E] hover:border-[#66143D] hover:text-[#66143D]"
                          >
                            <Plus size={12} weight="bold" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-1.5 mt-3">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Custom item"
                className="flex-1 min-w-0 px-2.5 py-1.5 border border-[#2C3E2D]/15 rounded-lg text-[11px] bg-white"
              />
              <input
                type="number"
                value={customQty}
                min={1}
                onChange={(e) =>
                  setCustomQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className="w-11 px-1 py-1.5 border border-[#2C3E2D]/15 rounded-lg text-[11px] text-center bg-white shrink-0"
              />
              <button
                type="button"
                onClick={() => {
                  const name = customName.trim();
                  if (!name) return;
                  setItems((prev) =>
                    setNameQty(prev, name, getQty(prev, name) + customQty),
                  );
                  setCustomName("");
                  setCustomQty(1);
                }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium font-[family-name:var(--font-body)] shrink-0"
                style={{ background: ROSE, color: PANEL_BG }}
              >
                Add
              </button>
            </div>
          </div>

          <div className="px-4 py-3.5 shrink-0">
            <p className="text-[10px] uppercase tracking-[1.2px] text-[#5A6B5E] font-medium mb-2 font-[family-name:var(--font-body)]">
              Handling
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {HANDLING_OPTIONS.map((h) => (
                <button
                  key={h.key}
                  type="button"
                  onClick={() => setHandling(h.key)}
                  className={`px-2 py-1.5 text-[11px] border rounded-lg transition text-center font-[family-name:var(--font-body)] ${
                    handling === h.key
                      ? "border-[#66143D] bg-[#66143D]/8 text-[#66143D]"
                      : "border-[#2C3E2D]/15 text-[#5A6B5E] hover:border-[#2C3E2D]/25"
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {hoveredZone && (
        <div
          className="absolute z-20 pointer-events-none min-w-[260px] max-w-[min(100vw-2rem,340px)]"
          style={{
            left: tooltipPos.x > 400 ? tooltipPos.x - 280 : tooltipPos.x + 20,
            top: tooltipPos.y - 80,
          }}
        >
          <div
            className="rounded-xl px-4 py-3.5 shadow-2xl"
            style={{ background: WINE, color: PANEL_BG }}
          >
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[1.5px] opacity-50 font-[family-name:var(--font-body)]">
                  {hoveredZone.label}
                </p>
                <p className="text-[10px] opacity-35 mt-0.5 leading-snug">
                  Sample route: Mississauga pickup to a typical stop in this
                  band (Mapbox driving distance).
                </p>
              </div>
              <div
                className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                style={{ backgroundColor: hoveredZone.color }}
              />
            </div>

            {!selectedVertical || itemsConsolidated.length === 0 ? (
              <div className="border-t border-white/10 mt-3 pt-3">
                <p className="text-[11px] opacity-40">
                  Select a vertical and add items to see live pricing
                </p>
              </div>
            ) : estimate.status === "loading" &&
              !estimate.data ? (
              <div className="border-t border-white/10 mt-3 pt-3">
                <p className="text-[11px] opacity-50 animate-pulse">
                  Calculating dimensional estimate…
                </p>
              </div>
            ) : estimate.status === "error" ? (
              <div className="border-t border-white/10 mt-3 pt-3">
                <p className="text-[11px] opacity-70">{estimate.message}</p>
              </div>
            ) : estimate.data ? (
              (() => {
                const d = estimate.data;
                const { low, mid, high } = bandFromSubtotal(d.subtotal);
                const hlabel =
                  HANDLING_OPTIONS.find((x) => x.key === handling)?.label ||
                  handling.replace(/_/g, " ");
                const topLines = d.breakdown.slice(0, 6);
                const more = d.breakdown.length - topLines.length;

                return (
                  <>
                    <div className="mt-3">
                      <p className="text-[26px] font-serif leading-none">
                        ~${mid.toLocaleString()}
                      </p>
                      <p className="text-[11px] opacity-40 mt-1">
                        Band: ${low.toLocaleString()} – ${high.toLocaleString()}{" "}
                        (rounded; actual access &amp; weight may change totals)
                      </p>
                      <p className="text-[10px] opacity-30 mt-1 leading-snug">
                        {d.dist_km} km ·
                        {d.drive_time_min != null
                          ? ` ~${d.drive_time_min} min drive · `
                          : " "}
                        {itemsConsolidated.reduce((s, i) => s + i.qty, 0)} pcs ·{" "}
                        {hlabel} · {d.vertical_name}
                      </p>
                      <p className="text-[9px] opacity-25 mt-1 leading-snug line-clamp-2">
                        Sample drop: {d.sample_address}
                      </p>
                    </div>

                    <div className="border-t border-white/10 mt-3 pt-2 space-y-0.5 max-h-[140px] overflow-hidden">
                      {topLines.map((row, i) => (
                        <div
                          key={`${row.label}-${i}`}
                          className="flex justify-between gap-2 text-[10px] opacity-45"
                        >
                          <span className="truncate min-w-0">{row.label}</span>
                          <span className="shrink-0 tabular-nums">
                            ${Math.round(row.amount).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {more > 0 && (
                        <p className="text-[9px] opacity-30 pt-0.5">
                          + {more} more line{more === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-white/10 mt-2 pt-2">
                      <p className="text-[9px] opacity-25 leading-relaxed">
                        Engine handling key: {d.engine_handling.replace(/_/g, " ")}.
                        Estimates only — confirm with your coordinator. Excludes
                        HST.
                      </p>
                    </div>
                  </>
                );
              })()
            ) : null}
          </div>
        </div>
      )}

      <div
        className="absolute bottom-[52px] left-1/2 -translate-x-1/2 z-10 max-w-[calc(100%-1.5rem)] rounded-lg px-4 py-1.5"
        style={{ background: `${WINE}CC`, backdropFilter: "blur(6px)" }}
      >
        <p className="text-[10px] text-[#F9EDE4]/70 text-center leading-snug whitespace-normal sm:whitespace-nowrap">
          Live dimensional estimates · sample address per zone · excludes HST
        </p>
      </div>

      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 max-w-[calc(100%-1rem)] rounded-xl border border-[#2C3E2D]/12 shadow-lg overflow-x-auto"
        style={{ background: `${PANEL_BG}/95`, backdropFilter: "blur(14px)" }}
      >
        <div className="px-4 py-2.5 flex items-center gap-4 min-w-min">
          {PRICING_ZONES.map((zone) => (
            <div key={zone.id} className="flex items-center gap-2 shrink-0">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: zone.color, opacity: 0.85 }}
              />
              <div>
                <p
                  className="text-[11px] font-medium leading-tight font-[family-name:var(--font-body)]"
                  style={{ color: WINE }}
                >
                  {zone.label}
                </p>
                <p className="text-[9px] text-[#5A6B5E] leading-tight">
                  {zone.surchargeLabel}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
