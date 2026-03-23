export interface LeadScore {
  score: number;
  factors: string[];
  priority: "hot" | "warm" | "cold";
}

export function computeLeadScore(quote: {
  status: string;
  custom_price?: number;
  tiers?: Record<string, { total?: number }>;
  viewed_at?: string | null;
  move_date?: string | null;
  service_type?: string;
  created_at: string;
}): LeadScore {
  let score = 0;
  const factors: string[] = [];

  // Quote value — higher value quotes are more important (up to 25 points)
  const value = extractValue(quote);
  if (value !== null) {
    if (value >= 5000) {
      score += 25;
      factors.push("High-value quote ($5k+)");
    } else if (value >= 2000) {
      score += 15;
      factors.push("Mid-value quote ($2k+)");
    } else if (value >= 500) {
      score += 8;
      factors.push("Standard quote value");
    }
  }

  // Has been viewed (+20)
  if (quote.viewed_at) {
    score += 20;
    factors.push("Quote viewed by client");
  }

  // Move date within 14 days (+15)
  if (quote.move_date) {
    const moveDate = new Date(quote.move_date);
    const now = new Date();
    const daysUntilMove = (moveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilMove >= 0 && daysUntilMove <= 14) {
      score += 15;
      factors.push("Move date within 14 days");
    } else if (daysUntilMove >= 0 && daysUntilMove <= 30) {
      score += 8;
      factors.push("Move date within 30 days");
    }
  }

  // Service type bonus — office moves score higher (+10)
  if (quote.service_type === "office_move") {
    score += 10;
    factors.push("Office move (high-value service)");
  } else if (quote.service_type === "white_glove") {
    score += 8;
    factors.push("White glove service");
  }

  // Quote freshness — newer quotes get higher scores (up to 15 points)
  const ageMs = Date.now() - new Date(quote.created_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 1) {
    score += 15;
    factors.push("Created today");
  } else if (ageDays <= 3) {
    score += 12;
    factors.push("Created within 3 days");
  } else if (ageDays <= 7) {
    score += 8;
    factors.push("Created this week");
  } else if (ageDays <= 14) {
    score += 4;
    factors.push("Created within 2 weeks");
  }

  // Already accepted/declined quotes get capped
  if (quote.status === "accepted") {
    score = Math.min(score, 20);
    factors.length = 0;
    factors.push("Already accepted");
  } else if (quote.status === "declined" || quote.status === "expired") {
    score = Math.min(score, 10);
    factors.length = 0;
    factors.push(quote.status === "declined" ? "Declined" : "Expired");
  }

  score = Math.min(100, Math.max(0, score));

  const priority: LeadScore["priority"] =
    score >= 60 ? "hot" : score >= 30 ? "warm" : "cold";

  return { score, factors, priority };
}

function extractValue(quote: {
  custom_price?: number;
  tiers?: Record<string, { total?: number }>;
}): number | null {
  if (quote.custom_price) return quote.custom_price;
  if (quote.tiers && typeof quote.tiers === "object") {
    const totals = Object.values(quote.tiers)
      .map((t) => t?.total)
      .filter((v): v is number => v != null);
    if (totals.length > 0) return Math.max(...totals);
  }
  return null;
}
