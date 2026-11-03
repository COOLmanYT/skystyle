export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth, DEMO_USER_ID } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { readWardrobe } from "@/lib/wardrobe-server";
import { newWardrobeItem } from "@/lib/wardrobe";
import { randomUUID } from "node:crypto";
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id === DEMO_USER_ID) return NextResponse.json({ items: [], persistence: "unavailable-in-demo" });
  const { data, error } = await supabaseAdmin.from("closet").select("*").eq("user_id",session.user.id).maybeSingle();
  if (error) return NextResponse.json({error:"Could not load closet."},{status:503});
  return NextResponse.json({ items:data?.items ?? [], ...(data?.revision !== undefined ? {revision:data.revision,wardrobeItems:data.wardrobe_items} : {}) });
}
async function mutate(req: NextRequest, action: "add" | "delete" | "replace") {
  const session=await auth();
  if (!session?.user?.id) return NextResponse.json({error:"Unauthorized"},{status:401});
  if (session.user.id===DEMO_USER_ID) return NextResponse.json({error:"Cloud closet storage requires a real account."},{status:403});
  const body=await req.json().catch(()=>null);
  if (!body || action!=="replace" && (typeof body.item!=="string" || !body.item.trim())) return NextResponse.json({error:"item is required"},{status:400});
  if (action==="replace" && (!Array.isArray(body.items) || body.items.length>500 || body.items.some((item:unknown)=>typeof item!=="string"))) return NextResponse.json({error:"items must be an array of up to 500 entries"},{status:400});
  if (action==="replace" && (!Number.isSafeInteger(body.revision) || body.revision < 0)) return NextResponse.json({error:"Reload your closet before replacing it; a valid revision is required."},{status:428});
  try {
    await syncPublicUser(session); const current=await readWardrobe(session.user.id);
    const item=typeof body.item==="string" ? body.item.trim().slice(0,200) : "";
    let operation;
    if(action==="add") {
      if(current.wardrobeItems.some(value=>value.label.toLowerCase()===item.toLowerCase())) return NextResponse.json(current);
      operation={type:"add",item:newWardrobeItem(randomUUID(),item)};
    } else if(action==="delete") {
      const ids=current.wardrobeItems.filter(value=>value.label===item).map(value=>value.id);
      if(!ids.length)return NextResponse.json(current);
      operation={type:"delete",ids};
    } else {
      // A description-only replacement cannot distinguish duplicate structured
      // items. Require the item editor rather than silently deleting their IDs.
      const labels=current.wardrobeItems.map(value=>value.label.toLowerCase());
      if(new Set(labels).size!==labels.length)return NextResponse.json({error:"Some clothes share a description. Use the item editor to preserve their separate details.",current},{status:409});
      const normalized=body.items.map((value:string)=>value.trim().slice(0,200)).filter(Boolean);
      const items=[...new Map(normalized.map((value:string)=>[value.toLowerCase(),value])).values()];
      operation={type:"replace",items};
    }
    const {data,error}=await supabaseAdmin.rpc("v63_mutate_wardrobe",{p_user_id:session.user.id,p_expected_revision:action==="replace"?body.revision:current.revision,p_operation:operation});
    if(error) { if(error.message.includes("wardrobe_conflict")) return NextResponse.json({error:"Closet changed elsewhere. Review and retry.",current:await readWardrobe(session.user.id)},{status:409}); throw error; }
    return NextResponse.json(data);
  } catch { return NextResponse.json({error:"Could not save closet. Please retry."},{status:503}); }
}
export const POST=(req:NextRequest)=>mutate(req,"add");
export const DELETE=(req:NextRequest)=>mutate(req,"delete");
export const PATCH=(req:NextRequest)=>mutate(req,"replace");
