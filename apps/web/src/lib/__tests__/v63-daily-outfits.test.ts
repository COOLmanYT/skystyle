import { newWardrobeItem, parseWardrobeItem } from "../wardrobe";
import { parseOutfitDetails, replaceOutfitSlot, ownedRecommendation } from "../outfits";
import { parseRecommendationContext, matchWindowForecast } from "../recommendation-context";
import { requireUsableRecommendation } from "../recommendation-validation";
import { meanMeasurements } from "../weather-measurements";
import { averageSources } from "../weather";
import { mockWeatherData } from "../../__tests__/mocks";
import { dailyWindowError } from "../comfort";
const shirt=newWardrobeItem("11111111-1111-4111-8111-111111111111","Linen shirt");
const other={...shirt,id:"22222222-2222-4222-8222-222222222222",label:"Cotton shirt"};
const details={slots:[{id:"top",category:"top",label:"provider label",itemId:shirt.id}],gaps:[],bring:[],changes:[]};
describe("6.3 recommendation boundaries",()=>{
  it.each([null,{outfit:"",reasoning:"valid"},{outfit:"valid",reasoning:""},{outfit:"Unable to generate outfit recommendation.",reasoning:"raw response"}])("rejects unusable output %p",value=>expect(()=>requireUsableRecommendation(value)).toThrow());
  it("preserves real zero and excludes missing or invalid measurements",()=>{expect(meanMeasurements([null,80,undefined])).toBe(80);expect(meanMeasurements([0,80])).toBe(40);expect(meanMeasurements([null,NaN,Infinity])).toBeNull();});
  it("does not dilute rain with missing observations or mix daily and hourly probabilities",()=>{
    const result=averageSources([{...mockWeatherData, source:"test",rainChance:null,uvIndex:null},{...mockWeatherData, source:"test",rainChance:80,rainPeriod:"hour",uvIndex:6},{...mockWeatherData, source:"test",rainChance:10,rainPeriod:"day",uvIndex:null}],mockWeatherData);
    expect(result.rainChance).toBe(80);expect(result.uvIndex).toBe(6);expect(result.rainPeriod).toBe("hour");
  });
  it("normalises owned labels and rejects fabricated IDs, unavailable items and duplicate slots",()=>{
    expect(parseOutfitDetails(details,[shirt],true).slots[0].label).toBe(shirt.label);
    expect(()=>parseOutfitDetails(details,[{...shirt,available:false}],true)).toThrow();
    expect(()=>parseOutfitDetails(details,[],true)).toThrow();
    expect(()=>parseOutfitDetails({...details,slots:[details.slots[0],details.slots[0]]},[shirt],true)).toThrow();
    expect(()=>parseOutfitDetails({...details,slots:[{...details.slots[0],itemId:null}]},[shirt],true)).toThrow();
  });
  it("swaps exactly one slot without altering the checklist or other slots",()=>{
    const payload={...ownedRecommendation(parseOutfitDetails(details,[shirt],true)),slots:[{id:"top",category:"top" as const,label:shirt.label,itemId:shirt.id},{id:"shoes",category:"footwear" as const,label:"Sneakers",itemId:null}],bring:["Umbrella"],changes:["Remove a layer"]};
    const result=replaceOutfitSlot(payload,"top",{...other,category:"top"});expect(result.slots[1]).toEqual(payload.slots[1]);expect(result.bring).toEqual(payload.bring);expect(result.changes).toEqual(payload.changes);expect(result.slots[0].itemId).toBe(other.id);
    expect(()=>replaceOutfitSlot(payload,"top",{...other,available:false})).toThrow();
    expect(()=>replaceOutfitSlot(payload,"top",{...other,category:"footwear"})).toThrow();
  });
  it("requires structured wardrobe attributes and a positive window up to 24 hours",()=>{
    expect(parseWardrobeItem(shirt)).toEqual(shirt);expect(()=>parseWardrobeItem({...shirt,available:"yes"})).toThrow();
    expect(parseRecommendationContext({window:{start:"2026-10-03T23:00:00+10:00",end:"2026-10-04T08:00:00+11:00",timeZone:"Australia/Sydney"}}).ok).toBe(true);
    expect(parseRecommendationContext({window:{start:"2026-10-03T23:00:00Z",end:"2026-10-05T08:00:00Z",timeZone:"UTC"}}).ok).toBe(false);
    expect(parseRecommendationContext({event:{at:"2026-10-04T08:00:00Z",timeZone:"UTC"},window:{start:"2026-10-04T07:00:00Z",end:"2026-10-04T09:00:00Z",timeZone:"UTC"}}).ok).toBe(false);
  });
  it("labels forecast holes and coverage limits",()=>{
    const window={start:"2026-10-04T00:00:00Z",end:"2026-10-04T03:00:00Z",timeZone:"UTC"};
    const hourly=[0,1,2].map(hour=>({time:`2026-10-04T0${hour}:00:00Z`,temp:20,description:"clear",rainChance:0,windSpeed:0}));
    expect(matchWindowForecast(hourly,window).status).toBe("full");expect(matchWindowForecast([hourly[0],hourly[2]],window).status).toBe("partial");expect(matchWindowForecast([],window).status).toBe("unavailable");
  });
  it("blocks incomplete and invalid client windows instead of silently omitting them", () => {
    expect(dailyWindowError(false, "", "")).toBe("");
    expect(dailyWindowError(true, "2026-10-04T08:00", "")).toContain("both");
    expect(dailyWindowError(true, "bad", "bad")).toContain("after");
    expect(dailyWindowError(true, "2026-10-04T08:00Z", "2026-10-04T08:00Z")).toContain("after");
    expect(dailyWindowError(true, "2026-10-04T08:00Z", "2026-10-05T08:01Z")).toContain("24 hours");
    expect(dailyWindowError(true, "2026-10-04T08:00Z", "2026-10-05T08:00Z")).toBe("");
    expect(dailyWindowError(true, "2026-10-03T23:00:00+10:00", "2026-10-04T08:00:00+11:00")).toBe("");
  });
});
