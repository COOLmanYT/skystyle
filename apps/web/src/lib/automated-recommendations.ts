import { supabaseAdmin } from "@/lib/supabase";
import { getStyleRecommendation, StyleRecommendation } from "@/lib/ai";
import { getWeather, WeatherData } from "@/lib/weather";

export type AutomaticRecurrence = "once" | "daily" | "weekly";

export interface AutomaticRecommendationSchedule {
  id: string;
  user_id: string;
  label: string;
  latitude: number;
  longitude: number;
  unit_preference: "metric" | "imperial";
  prompt: string | null;
  recurrence: AutomaticRecurrence;
  time_zone: string;
  next_run_at: string;
}

function nextRunAt(schedule: AutomaticRecommendationSchedule): string {
  if (schedule.recurrence === "once") return new Date().toISOString();
  // Advance the calendar day in the user's chosen zone, not a fixed 24-hour
  // duration, so a daily schedule remains at its chosen wall-clock time across DST.
  const date = new Date(schedule.next_run_at);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: schedule.time_zone || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const localCalendar = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + (schedule.recurrence === "weekly" ? 7 : 1), Number(parts.hour), Number(parts.minute), Number(parts.second)));
  const target = { year: localCalendar.getUTCFullYear(), month: localCalendar.getUTCMonth() + 1, day: localCalendar.getUTCDate(), hour: localCalendar.getUTCHours(), minute: localCalendar.getUTCMinutes(), second: localCalendar.getUTCSeconds() };
  let candidate = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second);
  // Two passes account for the offset changing at the DST boundary.
  for (let pass = 0; pass < 2; pass += 1) {
    const zoned = Object.fromEntries(formatter.formatToParts(new Date(candidate)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const renderedAsUtc = Date.UTC(Number(zoned.year), Number(zoned.month) - 1, Number(zoned.day), Number(zoned.hour), Number(zoned.minute), Number(zoned.second));
    candidate += Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second) - renderedAsUtc;
  }
  return new Date(candidate).toISOString();
}

async function addInboxMessage(
  userId: string,
  category: "recommendation" | "error",
  title: string,
  body: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin.from("user_inbox").insert({
    user_id: userId,
    category,
    title,
    body,
    metadata,
  });
  if (error) throw error;
}

async function failRun(
  schedule: AutomaticRecommendationSchedule,
  runId: string,
  message: string
): Promise<void> {
  const [{ error: runError }, { error: scheduleError }] = await Promise.all([
    supabaseAdmin
      .from("automated_recommendation_runs")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", runId),
    supabaseAdmin
      .from("automated_recommendation_schedules")
      .update({ locked_at: null, active: schedule.recurrence !== "once", updated_at: new Date().toISOString() })
      .eq("id", schedule.id),
  ]);
  if (runError) throw runError;
  if (scheduleError) throw scheduleError;
  await addInboxMessage(
    schedule.user_id,
    "error",
    `Automatic recommendation failed: ${schedule.label}`,
    message,
    { scheduleId: schedule.id, runId }
  );
}

export async function runAutomaticRecommendationSchedule(
  schedule: AutomaticRecommendationSchedule
): Promise<{ status: "completed" | "failed"; error?: string }> {
  const { data: run, error: runInsertError } = await supabaseAdmin
    .from("automated_recommendation_runs")
    .insert({ schedule_id: schedule.id, user_id: schedule.user_id, status: "running" })
    .select("id")
    .single();
  if (runInsertError || !run?.id) {
    await supabaseAdmin
      .from("automated_recommendation_schedules")
      .update({ locked_at: null, updated_at: new Date().toISOString() })
      .eq("id", schedule.id);
    throw runInsertError ?? new Error("Unable to create automatic recommendation run.");
  }

  try {
    const [controlResult, settingsResult, closetResult, profileResult] = await Promise.all([
      supabaseAdmin.from("user_access_controls").select("app_blocked").eq("user_id", schedule.user_id).maybeSingle(),
      supabaseAdmin.from("settings").select("custom_system_prompt").eq("user_id", schedule.user_id).maybeSingle(),
      supabaseAdmin.from("closet").select("items").eq("user_id", schedule.user_id).maybeSingle(),
      supabaseAdmin.from("users").select("is_dev").eq("id", schedule.user_id).maybeSingle(),
    ]);
    for (const result of [controlResult, settingsResult, closetResult, profileResult]) {
      if (result.error) throw result.error;
    }
    if (controlResult.data?.app_blocked) throw new Error("Automatic recommendations are disabled for this account.");

    const weather: WeatherData = await getWeather(schedule.latitude, schedule.longitude);
    const recommendation: StyleRecommendation = await getStyleRecommendation({
      weather,
      closetItems: Array.isArray(closetResult.data?.items) ? closetResult.data.items : [],
      unitPreference: schedule.unit_preference,
      customSystemPrompt: settingsResult.data?.custom_system_prompt ?? undefined,
      clientCustomPrompt: schedule.prompt ?? undefined,
      forceCloset: false,
      shareLocation: false,
      isDev: profileResult.data?.is_dev ?? false,
    });

    const completedAt = new Date().toISOString();
    const nextRun = nextRunAt(schedule);
    const [{ error: runUpdateError }, { error: scheduleUpdateError }] = await Promise.all([
      supabaseAdmin
        .from("automated_recommendation_runs")
        .update({ status: "completed", weather, recommendation, completed_at: completedAt })
        .eq("id", run.id),
      supabaseAdmin
        .from("automated_recommendation_schedules")
        .update({
          active: schedule.recurrence !== "once",
          next_run_at: nextRun,
          locked_at: null,
          last_run_at: completedAt,
          updated_at: completedAt,
        })
        .eq("id", schedule.id),
    ]);
    if (runUpdateError) throw runUpdateError;
    if (scheduleUpdateError) throw scheduleUpdateError;
    await addInboxMessage(
      schedule.user_id,
      "recommendation",
      `Automatic recommendation ready: ${schedule.label}`,
      recommendation.outfit,
      { scheduleId: schedule.id, runId: run.id, weather, recommendation }
    );
    return { status: "completed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automatic recommendation failed.";
    try {
      await failRun(schedule, run.id, message);
    } catch (persistError) {
      console.error("[automatic-recommendations] Failed to persist job failure:", persistError);
    }
    return { status: "failed", error: message };
  }
}

export async function claimAndRunAutomaticRecommendations(maxJobs = 25) {
  const { data, error } = await supabaseAdmin.rpc("claim_due_automated_recommendation_schedules", { max_jobs: maxJobs });
  if (error) throw error;
  const schedules = (data ?? []) as AutomaticRecommendationSchedule[];
  // Run sequentially. This avoids bursting external weather/AI providers and makes
  // an individual provider failure independent from the rest of the claimed jobs.
  const results = [] as Awaited<ReturnType<typeof runAutomaticRecommendationSchedule>>[];
  for (const schedule of schedules) {
    results.push(await runAutomaticRecommendationSchedule(schedule));
  }
  return {
    claimed: schedules.length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
  };
}
