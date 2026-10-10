import { getWeather,weatherFetch,weatherCache } from "../weather";
describe("bounded weather provider collection",()=>{
  beforeEach(()=>weatherCache.clear());
  it("attaches a five second request deadline and bounds an unresponsive collection",async()=>{
    const timeout=AbortSignal.timeout.bind(AbortSignal);
    const deadlines=jest.spyOn(AbortSignal,"timeout").mockImplementation(ms=>timeout(Math.ceil(ms/1000)));
    const fetchMock=jest.spyOn(global,"fetch").mockImplementation(()=>new Promise<Response>(()=>{}));
    await expect(getWeather(51.501,-0.141)).rejects.toThrow("took too long");
    expect(deadlines).toHaveBeenCalledWith(5000);expect(deadlines).toHaveBeenCalledWith(8000);
    expect(fetchMock.mock.calls.every(([,options])=>options?.signal instanceof AbortSignal)).toBe(true);
  });
  it("reuses OpenWeather metadata without a second provider collection",async()=>{
    const fetchMock=jest.spyOn(global,"fetch").mockImplementation(async input=>{
      const url=String(input);
      if(url.includes("/weather?"))return{ok:true,json:async()=>({main:{temp:20,feels_like:20,humidity:70},name:"Test station",wind:{speed:3,deg:90},coord:{lat:51.5,lon:-0.1}})} as Response;
      if(url.includes("api.openweathermap.org/data/2.5/forecast?"))return{ok:true,json:async()=>({list:[{pop:0.8}]})} as Response;
      return{ok:false,status:503} as Response;
    });
    const result=await getWeather(51.5,-0.1);
    expect(result.stationName).toBe("Test station");expect(result.uvIndex).toBeNull();expect(result.rainChance).toBe(80);
    expect(fetchMock.mock.calls.filter(([input])=>String(input).includes("/weather?")).length).toBe(1);
    expect(fetchMock.mock.calls.filter(([input])=>String(input).includes("api.openweathermap.org/data/2.5/forecast?")).length).toBe(1);
  });
  it("preserves a caller's options while attaching an abort signal",async()=>{
    const fetchMock=jest.spyOn(global,"fetch").mockResolvedValue({ok:true} as Response);
    await weatherFetch("https://example.com",{next:{revalidate:600},headers:{Accept:"application/json"}});
    expect(fetchMock.mock.calls[0][1]).toMatchObject({next:{revalidate:600},headers:{Accept:"application/json"}});
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
