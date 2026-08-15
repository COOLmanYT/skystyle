import { NextRequest, NextResponse } from "next/server";
import { claimAndRunAutomaticRecommendations } from "@/lib/automated-recommendations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await claimAndRunAutomaticRecommendations();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[automatic-recommendations] Runner failed:", error);
    return NextResponse.json({ error: "Automatic recommendation runner failed." }, { status: 500 });
  }
}
