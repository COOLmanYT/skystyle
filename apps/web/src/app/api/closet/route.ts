export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth, DEMO_USER_ID } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { syncPublicUser } from "@/lib/sync-user";
import { readWardrobe } from "@/lib/wardrobe-server";
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
  if (action==="replace" && !Number.isSafeInteger(body.revision)) return NextResponse.json({error:"Reload your closet before replacing it; a revision is required."},{status:428});
  try {
    await syncPublicUser(session); const current=await readWardrobe(session.user.id);
    let items=current.items;
    const item=typeof body.item==="string" ? body.item.trim().slice(0,200) : "";
    if(action==="add" && !items.some(value=>value.toLowerCase()===item.toLowerCase())) items=[...items,item];
    if(action==="delete") items=items.filter(value=>value!==item);
    if(action==="replace") items=body.items.map((value:string)=>value.trim().slice(0,200)).filter(Boolean);
    items=[...new Map(items.map(value=>[value.toLowerCase(),value])).values()];
    const {data,error}=await supabaseAdmin.rpc("v63_mutate_wardrobe",{p_user_id:session.user.id,p_expected_revision:action==="replace"?body.revision:current.revision,p_operation:{type:"replace",items}});
    if(error) { if(error.message.includes("wardrobe_conflict")) return NextResponse.json({error:"Closet changed elsewhere. Review and retry.",current:await readWardrobe(session.user.id)},{status:409}); throw error; }
    return NextResponse.json(data);
  } catch { return NextResponse.json({error:"Could not save closet. Please retry."},{status:503}); }
}
export const POST=(req:NextRequest)=>mutate(req,"add");
export const DELETE=(req:NextRequest)=>mutate(req,"delete");
export const PATCH=(req:NextRequest)=>mutate(req,"replace");
