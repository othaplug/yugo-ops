export interface DeliveryScoreInput {
  arrivedLate?: boolean;
  damageReported?: boolean;
  endCustomerRating?: number | null;
  scopeChange?: boolean;
}

export interface DeliveryScoreResult {
  score: number;
  breakdown: {
    onTime: boolean;
    damageFree: boolean;
    satisfactionScore: number;
    noScopeChange: boolean;
  };
}

export function calculateDeliveryScore(input: DeliveryScoreInput): DeliveryScoreResult {
  let score = 100;

  const onTime = !input.arrivedLate;
  const damageFree = !input.damageReported;
  const rating = input.endCustomerRating ?? 5;
  const noScopeChange = !input.scopeChange;

  if (!onTime) score -= 20;
  if (!damageFree) score -= 30;
  score -= (5 - Math.max(0, Math.min(5, rating))) * 10;
  if (!noScopeChange) score -= 5;

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      onTime,
      damageFree,
      satisfactionScore: rating,
      noScopeChange,
    },
  };
}

export function scoreLabel(score: number): string {
  if (score >= 95) return "Excellent";
  if (score >= 85) return "Good";
  if (score >= 70) return "Fair";
  return "Needs Improvement";
}

export function scoreColor(score: number): string {
  if (score >= 95) return "#22c55e";
  if (score >= 85) return "var(--gold)";
  if (score >= 70) return "#f59e0b";
  return "#ef4444";
}
