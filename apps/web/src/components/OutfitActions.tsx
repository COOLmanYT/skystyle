"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import MarkdownRenderer from "./MarkdownRenderer";
import { replaceOutfitSlot, type OutfitPayload, type SavedOutfit } from "@/lib/outfits";
import type { WardrobeItem } from "@/lib/wardrobe";
import type { ByokProvider } from "@/lib/ai";
export default function OutfitActions({payload,onChange,temporary=false,apiKey,provider,saved,onSaved,wardrobeItems}: {
  payload:OutfitPayload;onChange:(payload:OutfitPayload)=>void;temporary?:boolean;apiKey?:string;provider?:ByokProvider;saved?:SavedOutfit;onSaved?:(outfit:SavedOutfit)=>void;wardrobeItems?:WardrobeItem[];
}) {
  const [items,setItems]=useState<WardrobeItem[]>([]),[slotId,setSlotId]=useState(""),[itemId,setItemId]=useState("");
  const [title,setTitle]=useState(saved?.title??"My everyday outfit"),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [wardrobeLoaded,setWardrobeLoaded]=useState(false);
  const [savedRevision,setSavedRevision]=useState(saved?.revision??0);
  const requestId=useRef<string|null>(null), saveId=useRef<string|null>(null);
  useEffect(()=>{if(wardrobeItems !== undefined || temporary)return;let current=true;fetch("/api/wardrobe").then(async response=>{if(!response.ok)throw new Error();const data=await response.json();if(current){setItems(data.wardrobeItems??[]);setWardrobeLoaded(true);}}).catch(()=>{if(current)setMessage("Wardrobe choices are unavailable. Reload to retry.");});return()=>{current=false;};},[wardrobeItems,temporary]);
  const signature=JSON.stringify(payload);
  useEffect(()=>{requestId.current=null;saveId.current=null;},[signature,apiKey,provider]);
  const slot=payload.slots.find(slot=>slot.id===slotId);
  const wardrobe=wardrobeItems ?? items;
  const candidates=wardrobe.filter(item=>item.available&&item.id!==slot?.itemId&&(!slot||slot.category==="other"||item.category==="other"||item.category===slot.category));
  async function save() {
    setBusy(true);setMessage("");
    try {
      if(temporary){setMessage("Demo outfit kept for this page visit. Sign in to save across devices.");return;}
      saveId.current ??= crypto.randomUUID();
      const response=await fetch("/api/outfits",{method:saved?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:saved?.id??saveId.current,revision:savedRevision,title,payload})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not save outfit.");
      setSavedRevision(data.revision??0);onSaved?.(data);setMessage("Saved. Open Saved outfits to reuse or manage it.");
    }catch(failure){setMessage(failure instanceof Error?failure.message:"Could not save outfit. Please retry.");}finally{setBusy(false);}
  }
  async function swap() {
    setBusy(true);setMessage("");
    try {
      requestId.current ??= crypto.randomUUID();
      const response=await fetch("/api/outfits/swap",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":requestId.current},body:JSON.stringify({payload,slotId,...(apiKey?{userApiKey:apiKey,byokProvider:provider}:{})})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not replace this item.");onChange(data.payload);setItemId("");saveId.current=null;requestId.current=null;setMessage("One item replaced. Save to keep this version.");
    }catch(failure){setMessage(failure instanceof Error?failure.message:"Could not complete swap. Please retry.");}finally{setBusy(false);}
  }
  const style={background:"var(--background)",borderColor:"var(--card-border)"};
  return <section className="outfit-actions space-y-3 rounded-xl border p-4" style={{borderColor:"var(--card-border)"}} aria-label="Save and adjust outfit">
    {payload.slots.some(slot=>slot.itemId && (wardrobeItems !== undefined || wardrobeLoaded) && !wardrobe.some(item=>item.id===slot.itemId && item.available)) && <p role="status" className="text-sm">Some saved items are deleted or unavailable. Choose replacements before wearing this outfit.</p>}
    {payload.gaps.length>0&&<p role="status" className="text-sm">Wardrobe or comfort gaps: {payload.gaps.join("; ")}. This incomplete result uses no recommendation allowance.</p>}
    {payload.bring.length>0&&<div><h3 className="text-sm font-medium">Bring</h3><ul className="list-disc pl-5 text-sm">{payload.bring.map((value,index)=><li key={index}><MarkdownRenderer content={value} className="text-sm" wardrobeItems={wardrobe} closetItems={wardrobe.map(item=>item.label)} recommendationLinks={wardrobeItems !== undefined || wardrobeLoaded} /></li>)}</ul></div>}
    {payload.changes.length>0&&<div><h3 className="text-sm font-medium">Through your day</h3><ul className="list-disc pl-5 text-sm">{payload.changes.map((value,index)=><li key={index}><MarkdownRenderer content={value} className="text-sm" wardrobeItems={wardrobe} closetItems={wardrobe.map(item=>item.label)} recommendationLinks={wardrobeItems !== undefined || wardrobeLoaded} /></li>)}</ul></div>}
    <label className="block text-sm">Outfit name<input maxLength={80} value={title} onChange={e=>{setTitle(e.target.value);saveId.current=null;}} className="form-control mt-1" style={style}/></label>
    <div className="flex flex-wrap gap-4 text-sm"><button disabled={busy||!title.trim()} type="button" onClick={()=>void save()} className="control-button underline">{saved?"Save changes":"Save outfit"}</button><Link href="/outfits" className="control-button underline">Saved outfits</Link></div>
    {payload.slots.length>0&&<fieldset className="space-y-2"><legend className="text-sm font-medium">Replace one item</legend><select aria-label="Outfit item to replace" value={slotId} onChange={e=>{setSlotId(e.target.value);setItemId("");requestId.current=null;}} className="form-control" style={style}><option value="">Choose an outfit item</option>{payload.slots.map(slot=><option key={slot.id} value={slot.id}>{slot.label}</option>)}</select>
      <select aria-label="Available wardrobe replacement" value={itemId} onChange={e=>setItemId(e.target.value)} className="form-control" style={style}><option value="">Choose a wardrobe replacement</option>{candidates.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select><div className="flex flex-wrap gap-4 text-xs"><button type="button" disabled={busy||!slotId||!itemId} onClick={()=>{const item=wardrobe.find(item=>item.id===itemId);if(item){try{onChange(replaceOutfitSlot(payload,slotId,item));setItemId("");saveId.current=null;setMessage("Replaced without AI. Save to keep your changes.");}catch(failure){setMessage(failure instanceof Error?failure.message:"This replacement is unavailable. Choose another item.");}}}} className="control-button underline">Manual swap · free</button><button type="button" disabled={busy||!slotId||temporary} onClick={()=>void swap()} className="control-button underline">AI swap · one follow-up</button></div></fieldset>}
    {message&&<p role="status" className="text-xs">{message}</p>}
  </section>;
}
