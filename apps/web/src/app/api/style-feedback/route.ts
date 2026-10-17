import { auth, DEMO_USER_ID } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { parseCloudStyleFeedback } from "@/lib/style-feedback";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id === DEMO_USER_ID) {
    return Response.json({ storageMode: "local", entries: [], summary: "", cloudAvailable: false }, { headers: noStore });
  }
  try {
    const { data: settings, error } = await supabaseAdmin.from("settings")
      .select("feedback_storage_mode").eq("user_id", session.user.id).maybeSingle();
    if (error) throw error;
    if (settings?.feedback_storage_mode !== "cloud") {
      // A failed transfer may have saved a private row before changing settings.
      // Read its version only, never its content, so a retry can safely resume.
      const { data: version, error: versionError } = await supabaseAdmin.from("style_feedback_preferences")
        .select("updated_at").eq("user_id", session.user.id).maybeSingle();
      if (versionError) throw versionError;
      return Response.json({ storageMode: "local", entries: [], summary: "", cloudAvailable: true,
        updatedAt: version?.updated_at ?? null }, { headers: noStore });
    }
    const { data, error: feedbackError } = await supabaseAdmin.from("style_feedback_preferences")
      .select("entries, summary, updated_at").eq("user_id", session.user.id).maybeSingle();
    if (feedbackError) throw feedbackError;
    return Response.json({ storageMode: "cloud", entries: data?.entries ?? [], summary: data?.summary ?? "",
      updatedAt: data?.updated_at ?? null, cloudAvailable: true }, { headers: noStore });
  } catch {
    return Response.json({ error: "Unable to load cloud feedback. Your device feedback has not been changed." }, { status: 503 });
  }
}

/** Cloud data is never taken from a user_id in the body; the session owns every operation. */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id === DEMO_USER_ID) return Response.json({ error: "Demo feedback is local only." }, { status: 409 });
  const body: unknown = await request.json().catch(() => null);
  const data = parseCloudStyleFeedback(body);
  if (!data) return Response.json({ error: "Invalid feedback data or storage capacity exceeded. No old feedback was removed." }, { status: 400 });
  const expectedUpdatedAt = (body as Record<string, unknown>).expectedUpdatedAt ?? null;
  if (expectedUpdatedAt !== null && (typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt)))) {
    return Response.json({ error: "Invalid feedback version." }, { status: 400 });
  }
  try {
    await syncPublicUser(session);
    const userId = session.user.id;
    const updatedAt = new Date(Math.max(Date.now(), typeof expectedUpdatedAt === "string" ? Date.parse(expectedUpdatedAt) + 1 : 0)).toISOString();
    const table = supabaseAdmin.from("style_feedback_preferences");
    const write = expectedUpdatedAt === null
      ? table.upsert({ user_id: userId, ...data, updated_at: updatedAt }, { onConflict: "user_id", ignoreDuplicates: true })
      : table.update({ ...data, updated_at: updatedAt }).eq("user_id", userId).eq("updated_at", expectedUpdatedAt);
    const { data: saved, error } = await write.select("updated_at").maybeSingle();
    if (error) throw error;
    if (!saved) return Response.json({ error: "Feedback changed on another device. Refresh to load the latest copy before saving." }, { status: 409 });
    // Switch only after the data was accepted. Failure leaves the local copy intact.
    const { error: settingsError } = await supabaseAdmin.from("settings")
      .upsert({ user_id: userId, feedback_storage_mode: "cloud" }, { onConflict: "user_id" });
    if (settingsError) return Response.json({ error: "Feedback was saved privately, but the storage switch failed. Your device copy was kept; retry the switch.", updatedAt: saved.updated_at }, { status: 503 });
    return Response.json({ success: true, storageMode: "cloud", updatedAt: saved.updated_at }, { headers: noStore });
  } catch {
    return Response.json({ error: "Unable to save cloud feedback. Keep your local copy and retry." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.storageMode !== "local") return Response.json({ error: "Use the cloud-save action to enable cloud storage." }, { status: 400 });
  if (session.user.id === DEMO_USER_ID) return Response.json({ success: true, storageMode: "local" });
  try {
    const { error } = await supabaseAdmin.from("settings")
      .upsert({ user_id: session.user.id, feedback_storage_mode: "local" }, { onConflict: "user_id" });
    if (error) throw error;
    const { error: deleteError } = await supabaseAdmin.from("style_feedback_preferences").delete().eq("user_id", session.user.id);
    if (deleteError) throw deleteError;
    return Response.json({ success: true, storageMode: "local" }, { headers: noStore });
  } catch {
    return Response.json({ error: "Unable to complete the switch. Your device copy has been kept; retry to remove the cloud copy." }, { status: 503 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id === DEMO_USER_ID) return Response.json({ success: true });
  try {
    const { error } = await supabaseAdmin.from("style_feedback_preferences").delete().eq("user_id", session.user.id);
    if (error) throw error;
    return Response.json({ success: true }, { headers: noStore });
  } catch {
    return Response.json({ error: "Unable to delete cloud feedback. Please retry." }, { status: 503 });
  }
}
