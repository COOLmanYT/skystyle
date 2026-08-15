import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";

const RECURRENCES = new Set(["once", "daily", "weekly"]);

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  await syncPublicUser(session);
  return session.user.id;
}

export async function GET() {
  const userId = await currentUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [schedulesResult, runsResult] = await Promise.all([
    supabaseAdmin.from("automated_recommendation_schedules").select("*").eq("user_id", userId).order("next_run_at"),
    supabaseAdmin.from("automated_recommendation_runs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (schedulesResult.error || runsResult.error) {
    return NextResponse.json({ error: "Failed to load automatic recommendations." }, { status: 500 });
  }
  return NextResponse.json({ schedules: schedulesResult.data ?? [], runs: runsResult.data ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await currentUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const runAt = validDate(body?.runAt);
  const latitude = body?.latitude;
  const longitude = body?.longitude;
  const recurrence = body?.recurrence;
  if (!runAt || typeof latitude !== "number" || typeof longitude !== "number" || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || !RECURRENCES.has(String(recurrence))) {
    return NextResponse.json({ error: "A valid date, manual latitude/longitude, and recurrence are required." }, { status: 400 });
  }
  if (Date.parse(runAt) <= Date.now()) return NextResponse.json({ error: "The first automatic recommendation must be scheduled in the future." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("automated_recommendation_schedules")
    .insert({
      user_id: userId,
      label: typeof body?.label === "string" ? body.label.trim().slice(0, 80) || "Scheduled recommendation" : "Scheduled recommendation",
      latitude,
      longitude,
      unit_preference: body?.unitPreference === "imperial" ? "imperial" : "metric",
      prompt: typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 1_000) || null : null,
      run_at: runAt,
      recurrence,
      time_zone: typeof body?.timeZone === "string" ? body.timeZone.slice(0, 80) : "UTC",
      next_run_at: runAt,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const userId = await currentUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Schedule id is required." }, { status: 400 });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.active === "boolean") updates.active = body.active;
  if (typeof body.label === "string") updates.label = body.label.trim().slice(0, 80);
  if (typeof body.prompt === "string") updates.prompt = body.prompt.trim().slice(0, 1_000) || null;
  if (RECURRENCES.has(String(body.recurrence))) updates.recurrence = body.recurrence;
  const runAt = validDate(body.runAt);
  if (runAt && Date.parse(runAt) > Date.now()) {
    updates.run_at = runAt;
    updates.next_run_at = runAt;
    updates.locked_at = null;
  }
  const { data, error } = await supabaseAdmin
    .from("automated_recommendation_schedules")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}
