import type { MapboxDirectionRoute } from "./route-types";

type TorontoRule = {
  condition: (time: Date, route: MapboxDirectionRoute) => boolean;
  action: "avoid" | "warn";
  reason: string;
  alternative?: string;
};

function stepNames(route: MapboxDirectionRoute): string[] {
  const steps = route.legs?.[0]?.steps || [];
  return steps.map((s) => `${s.name || ""} ${s.maneuver?.instruction || ""}`);
}

function stepsText(route: MapboxDirectionRoute): string {
  return stepNames(route).join(" ").toLowerCase();
}

const TORONTO_ROUTING_RULES: TorontoRule[] = [
  {
    condition: (time, route) => {
      const hour = time.getHours();
      const t = stepsText(route);
      const usesDvp = t.includes("don valley") || t.includes("dvp");
      return usesDvp && hour >= 15 && hour <= 19;
    },
    action: "avoid",
    reason: "DVP is often heavily congested during afternoon rush.",
    alternative: "Bayview or surface streets may be more predictable.",
  },
  {
    condition: (time, route) => {
      const hour = time.getHours();
      const t = stepsText(route);
      return t.includes("gardiner") && hour >= 7 && hour <= 9;
    },
    action: "warn",
    reason: "Gardiner can be slow eastbound during the morning rush.",
  },
  {
    condition: (_time, route) => {
      const steps = route.legs?.[0]?.steps || [];
      return steps.some((s) => {
        const n = (s.name || "").toLowerCase();
        return n.includes("king st") && !n.includes("king st e") && !n.includes("king st w");
      });
    },
    action: "warn",
    reason: "King Street has transit priority; expect slower progress in a truck.",
    alternative: "Queen, Richmond, or Adelaide may flow better.",
  },
];

export function applyTorontoIntelligence(route: MapboxDirectionRoute, departureTime: Date = new Date()): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const rule of TORONTO_ROUTING_RULES) {
    if (!rule.condition(departureTime, route)) continue;
    const line =
      rule.action === "avoid"
        ? `${rule.reason} ${rule.alternative || ""}`.trim()
        : rule.reason;
    if (seen.has(line)) continue;
    seen.add(line);
    warnings.push(line);
  }
  return warnings;
}
