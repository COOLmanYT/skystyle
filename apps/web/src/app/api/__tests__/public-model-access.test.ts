import { POST as recommend } from '../v1/recommend/route';
import { POST as recweather } from '../v1/recweather/route';
import { getStyleRecommendation } from '@/lib/ai';
import { mockWeatherData } from '../../../__tests__/mocks';
import type { NextRequest } from 'next/server';
let mockAccess: 'free' | 'pro' | undefined;
jest.mock('@/lib/api-middleware', () => ({
  withApiAuth: (handler: (request: NextRequest, context: unknown) => unknown) => (request: NextRequest) => handler(request, { userId:'synthetic', apiKeyId:'synthetic', startedAt:0, modelAccess:mockAccess }),
  apiOptionsHandler: jest.fn(),
}));
jest.mock('@/lib/ai', () => ({ getStyleRecommendation:jest.fn() }));
jest.mock('@/lib/weather', () => ({ getWeather:async()=>jest.requireActual('../../../__tests__/mocks').mockWeatherData, publicMeasurements:()=>({}) }));
beforeEach(()=>{
  (getStyleRecommendation as jest.Mock).mockResolvedValue({outfit:'Shirt and jeans',reasoning:'Mild weather',modelUsed:'synthetic'});
});
test.each([['recommend',recommend],['recweather',recweather]] as const)('%s reads model access from server context',async(_name,route)=>{
  for(const access of ['free','pro',undefined] as const){
    mockAccess=access;
    const request={json:async()=>({lat:-37.8,lon:145,isPro:access!=='pro',weather:mockWeatherData})} as unknown as NextRequest;
    expect((await route(request)).status).toBe(200);
    expect(getStyleRecommendation).toHaveBeenLastCalledWith(expect.objectContaining({isPro:access==='pro',isDev:false}));
  }
});
