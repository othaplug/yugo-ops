export interface BadgeDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  condition: (p: CrewProfileStats) => boolean;
}

export interface CrewProfileStats {
  total_jobs: number;
  avg_satisfaction: number;
  damage_rate: number;
  damage_incidents: number;
  consecutive_5stars: number;
  piano_jobs: number;
  piano_damage: number;
  art_jobs: number;
  art_damage: number;
  avg_hours_vs_estimate: number;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: "100_club",
    name: "100 Club",
    icon: "Trophy",
    description: "100+ completed moves",
    condition: (p) => p.total_jobs >= 100,
  },
  {
    id: "5star_streak",
    name: "5-Star Streak",
    icon: "Star",
    description: "10 consecutive 5-star reviews",
    condition: (p) => p.consecutive_5stars >= 10,
  },
  {
    id: "piano_pro",
    name: "Piano Pro",
    icon: "MusicNote",
    description: "10+ piano moves with zero damage",
    condition: (p) => p.piano_jobs >= 10 && p.piano_damage === 0,
  },
  {
    id: "art_handler",
    name: "Art Handler",
    icon: "PaintBrush",
    description: "20+ art/antique moves with zero damage",
    condition: (p) => p.art_jobs >= 20 && p.art_damage === 0,
  },
  {
    id: "efficiency_expert",
    name: "Efficiency Expert",
    icon: "Lightning",
    description: "Consistently finishes ahead of estimate",
    condition: (p) => p.avg_hours_vs_estimate < -0.3 && p.total_jobs >= 20,
  },
  {
    id: "zero_damage",
    name: "Zero Damage",
    icon: "ShieldCheck",
    description: "25+ moves with perfect damage record",
    condition: (p) => p.damage_rate === 0 && p.total_jobs >= 25,
  },
  {
    id: "top_rated",
    name: "Top Rated",
    icon: "Medal",
    description: "4.9+ average rating with 50+ reviews",
    condition: (p) => p.avg_satisfaction >= 4.9 && p.total_jobs >= 50,
  },
];

export function computeBadges(stats: CrewProfileStats): string[] {
  return BADGES.filter((b) => b.condition(stats)).map((b) => b.id);
}
