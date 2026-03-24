import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { crewMemberMatchesSessionToken } from "@/lib/crew-session-validate";
import { BADGES, computeBadges } from "@/lib/crew/badges";

export async function GET(req: NextRequest) {
  const token =
    req.headers.get("x-crew-token") ||
    req.cookies.get(CREW_COOKIE_NAME)?.value ||
    req.nextUrl.searchParams.get("token") ||
    "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const crewMember = verifyCrewToken(token);
  if (!crewMember) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionOk = await crewMemberMatchesSessionToken(crewMember);
  if (!sessionOk) {
    return NextResponse.json(
      { error: "Session no longer valid. Please log in again.", code: "CREW_SESSION_STALE" },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  // Get crew profile
  const { data: profile } = await supabase
    .from("crew_profiles")
    .select("*")
    .eq("user_id", crewMember.crewMemberId)
    .maybeSingle();

  // Get this month's jobs
  const { data: monthMoves } = await supabase
    .from("moves")
    .select("id, status, tip_amount, satisfaction_rating")
    .contains("assigned_members", [crewMember.name])
    .eq("status", "completed")
    .gte("completed_at", monthStart);

  const { data: monthDeliveries } = await supabase
    .from("deliveries")
    .select("id, status")
    .contains("crew_members", [crewMember.name])
    .eq("status", "completed")
    .gte("completed_at", monthStart);

  const monthJobs = (monthMoves?.length ?? 0) + (monthDeliveries?.length ?? 0);
  const monthTips = (monthMoves ?? []).reduce((s, m) => s + (Number(m.tip_amount) || 0), 0);
  const monthRatings = (monthMoves ?? [])
    .filter((m) => m.satisfaction_rating)
    .map((m) => Number(m.satisfaction_rating));
  const monthAvgRating =
    monthRatings.length > 0
      ? monthRatings.reduce((a, b) => a + b, 0) / monthRatings.length
      : null;

  // Leaderboard: all crew this month
  const { data: allProfiles } = await supabase
    .from("crew_profiles")
    .select("name, total_jobs, avg_satisfaction, total_tips_earned, badges, monthly_jobs, monthly_ratings, monthly_tips")
    .order("avg_satisfaction", { ascending: false })
    .limit(10);

  const currentMonth = now.toISOString().slice(0, 7);
  const leaderboardRaw = (allProfiles ?? [])
    .map((p) => {
      const mJobs = (p.monthly_jobs as Record<string, number>)?.[currentMonth] || 0;
      const mRating = (p.monthly_ratings as Record<string, number>)?.[currentMonth] || p.avg_satisfaction || 0;
      const mTips = (p.monthly_tips as Record<string, number>)?.[currentMonth] || 0;
      return {
        name: p.name,
        monthJobs: mJobs,
        avgRating: mRating,
        monthTips: mTips,
        badges: (p.badges as string[]) || [],
      };
    })
    .filter((p) => p.monthJobs > 0 || p.avgRating > 0)
    .sort((a, b) => b.avgRating - a.avgRating);

  const myRankIndex = leaderboardRaw.findIndex((e) => e.name === crewMember.name);
  const yourRankThisMonth = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const leaderboard = leaderboardRaw.slice(0, 15);

  // Compute badges
  const earnedBadgeIds: string[] = profile
    ? computeBadges({
        total_jobs: profile.total_jobs || 0,
        avg_satisfaction: profile.avg_satisfaction || 0,
        damage_rate: profile.damage_rate || 0,
        damage_incidents: profile.damage_incidents || 0,
        consecutive_5stars: profile.consecutive_5stars || 0,
        piano_jobs: profile.piano_jobs || 0,
        piano_damage: profile.piano_damage || 0,
        art_jobs: profile.art_jobs || 0,
        art_damage: profile.art_damage || 0,
        avg_hours_vs_estimate: profile.avg_hours_vs_estimate || 0,
      })
    : [];

  const earnedBadges = BADGES.filter((b) => earnedBadgeIds.includes(b.id));

  const { data: crewRow } = await supabase.from("crews").select("name").eq("id", crewMember.teamId).maybeSingle();

  return NextResponse.json({
    teamName: crewRow?.name ?? "Team",
    crewMemberName: crewMember.name,
    yourRankThisMonth,
    profile: {
      totalJobs: profile?.total_jobs || 0,
      avgRating: profile?.avg_satisfaction || 0,
      damageIncidents: profile?.damage_incidents || 0,
      onTimeRate: profile?.on_time_rate || 0,
    },
    thisMonth: {
      jobs: monthJobs,
      tips: monthTips,
      avgRating: monthAvgRating,
      avgTipPerJob: monthJobs > 0 ? Math.round(monthTips / monthJobs) : 0,
    },
    badges: earnedBadges,
    leaderboard,
  });
}
