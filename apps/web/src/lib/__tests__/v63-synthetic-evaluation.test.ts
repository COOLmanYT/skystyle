/** Contract evaluation only. These synthetic provider responses do not measure
 * real model quality, token consumption or cost. */
import { getStyleRecommendation } from "../ai";
import { newWardrobeItem } from "../wardrobe";
import { DEFAULT_COMFORT } from "../comfort";
import { mockWeatherData } from "../../__tests__/mocks";
const mockCompletion = jest.fn();
jest.mock("openai", () => ({ __esModule:true, default:class {
  chat={completions:{create:(input:unknown)=>mockCompletion(input)}};
} }));
const shirt={...newWardrobeItem("11111111-1111-4111-8111-111111111111","Cotton shirt"),category:"top" as const};
const jacket={...newWardrobeItem("22222222-2222-4222-8222-222222222222","Rain jacket"),category:"outerwear" as const,waterproofing:"waterproof" as const};
const cases = [
  "cold morning", "hot afternoon", "rainy commute", "dry commute", "missing rain", "zero rain",
  "missing UV", "zero UV", "unknown waterproofing", "warm jacket", "unavailable shirt", "empty wardrobe",
  "run cold", "run warm", "fabric dislike", "coverage preference", "footwear restriction", "dress code",
  "full forecast", "partial forecast", "unavailable forecast", "overnight", "Sydney DST", "24 hour window",
];
describe("6.3 synthetic recommendation contract evaluation (24 cases)",()=>{
  it.each(cases)("%s",async(name)=>{
    const owned=[shirt,{...jacket,waterproofing:name==="unknown waterproofing"?"unknown" as const:jacket.waterproofing}].filter(item=>name!=="empty wardrobe" && !(name==="unavailable shirt"&&item.id===shirt.id));
    const missing=name==="empty wardrobe"||name==="unavailable shirt";
    const details={slots:owned.map(item=>({id:item.category,label:"Invented provider label",category:item.category,itemId:item.id})),gaps:missing?["A suitable top is unavailable."]:[],bring:[jacket.label,"Unowned shoes"],changes:["Wear unowned boots"]};
    mockCompletion.mockResolvedValue({choices:[{message:{content:JSON.stringify({outfit:"Provider prose mentioning unowned clothes",reasoning:"Provider weather reasoning",details})},finish_reason:"stop"}]});
    const context={comfort:{...DEFAULT_COMFORT,temperature:name==="run cold"?"cold" as const:name==="run warm"?"warm" as const:"neutral" as const,
      fabricDislikes:name==="fabric dislike"?"wool":"",coverage:name==="coverage preference"?"covered shoulders":"",footwearRestrictions:name==="footwear restriction"?"no heels":"",dressCode:name==="dress code"?"smart casual":""},
      window:{start:"2026-10-03T22:00:00Z",end:name==="24 hour window"?"2026-10-04T22:00:00Z":name==="overnight"?"2026-10-04T04:00:00Z":"2026-10-04T01:00:00Z",timeZone:"Australia/Sydney"}};
    const hours=name==="unavailable forecast"?[]:(name==="partial forecast"?[0]:[0,1,2]).map(hour=>({time:new Date(Date.parse(context.window.start)+hour*3600000).toISOString(),temp:hour===0?12:25,description:"clear",rainChance:0,windSpeed:10}));
    const weather={...mockWeatherData,temp:name==="cold morning"?5:name==="hot afternoon"?35:20,rainChance:name==="missing rain"?null:name==="rainy commute"?80:0,uvIndex:name==="missing UV"?null:0,hourly:hours};
    const result=await getStyleRecommendation({weather,closetItems:owned.map(item=>item.label),wardrobeItems:owned,structuredOutfit:true,forceCloset:true,unitPreference:"metric",userApiKey:"synthetic-only-key",byokProvider:"openai",recommendationContext:context});
    expect(result.details?.slots.map(slot=>slot.label)).toEqual(owned.map(item=>item.label));
    expect(result.outfit).not.toContain("unowned");expect(result.details?.bring).not.toContain("Unowned shoes");
    expect(result.details?.changes.join(" ")).not.toContain("unowned");expect(result.chargeable).toBe(!missing);
    const request=mockCompletion.mock.calls.at(-1)![0];const prompt=request.messages[1].content;
    expect(prompt).toContain("Explicit comfort controls");expect(prompt).toContain("override conflicting inferred feedback");
    expect(prompt).toContain("Day window");expect(request.max_tokens).toBeGreaterThanOrEqual(1200);
    if(name==="partial forecast")expect(prompt).toContain("partial");if(name==="unavailable forecast")expect(prompt).toContain("unavailable");
  });
});
