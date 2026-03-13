import { NextRequest, NextResponse } from "next/server";
import { runEtaCheck } from "@/app/api/eta/check/route";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { processed, results } = await runEtaCheck();
    return NextResponse.json({ processed, results });
  } catch (error) {
    console.error("ETA cron error:", error);
    return NextResponse.json({ error: "ETA check failed" }, { status: 500 });
  }
}
