import { mockWeatherData } from '../../__tests__/mocks';
const mockOpenAI = jest.fn(), mockGemini = jest.fn(), mockMistral = jest.fn();
jest.mock('openai', () => ({ __esModule:true, default:jest.fn(() => ({chat:{completions:{create:(...args:unknown[])=>mockOpenAI(...args)}}})) }));
jest.mock('@google/generative-ai', () => ({ GoogleGenerativeAI:jest.fn(() => ({getGenerativeModel:({model}:{model:string})=>({generateContent:(...args:unknown[])=>mockGemini(model,...args)})})) }));
jest.mock('@mistralai/mistralai', () => ({ Mistral:jest.fn(() => ({chat:{complete:(...args:unknown[])=>mockMistral(...args)}})) }));
const raw=JSON.stringify({outfit:'Shirt, jeans and shoes.',reasoning:'Suitable for mild weather.'});
beforeEach(()=>{
  jest.resetModules();
  process.env.OPENAI_API_KEY='synthetic-openai';process.env.GEMINI_API_KEY='synthetic-gemini';process.env.MISTRAL_API_KEY='synthetic-mistral';
  mockOpenAI.mockReset().mockResolvedValue({choices:[{message:{content:raw},finish_reason:'stop'}]});
  mockGemini.mockReset().mockResolvedValue({response:{text:()=>raw}});
  mockMistral.mockReset().mockResolvedValue({choices:[{message:{content:raw}}]});
});
function ai(){return jest.requireActual<typeof import('../ai')>('../ai');}

test.each(['initial','followup'])('%s keeps wardrobe and custom styling input out of system authority',async(kind)=>{
  const marker='UNTRUSTED_STYLE_SENTINEL';
  const shared={weather:mockWeatherData,unitPreference:'metric' as const,isPro:true,closetItems:[marker],customSystemPrompt:marker};
  if(kind==='initial')await ai().getStyleRecommendation(shared);
  else await ai().getFollowUpRecommendation({...shared,previousOutfit:'Shirt',previousReasoning:'Mild',followUpMessage:'Warmer'});
  const {messages}=mockOpenAI.mock.calls[0][0];
  expect(messages.find((message:{role:string})=>message.role==='system').content).not.toContain(marker);
  expect(messages.find((message:{role:string})=>message.role==='user').content).toContain(marker);
});
test('a default Free recommendation never attempts OpenAI',async()=>{
  const result=await ai().getStyleRecommendation({weather:mockWeatherData,closetItems:[],unitPreference:'metric',isPro:false});
  expect(result.modelUsed).toBe('gemini-2.5-flash');expect(mockOpenAI).not.toHaveBeenCalled();
});
test('Free fallback remains inside the Free catalogue',async()=>{
  mockGemini.mockRejectedValue(new Error('synthetic provider outage'));
  const result=await ai().getStyleRecommendation({weather:mockWeatherData,closetItems:[],unitPreference:'metric',isPro:false});
  expect(result.modelUsed).toBe('mistral-small-latest');
  expect(mockOpenAI).not.toHaveBeenCalled();
  expect(mockMistral).toHaveBeenCalledWith(expect.objectContaining({model:'mistral-small-latest'}));
});
test('no Free provider cannot silently use a Pro-only key',async()=>{
  delete process.env.GEMINI_API_KEY;delete process.env.MISTRAL_API_KEY;
  await expect(ai().getStyleRecommendation({weather:mockWeatherData,closetItems:[],unitPreference:'metric',isPro:false})).rejects.toThrow();
  expect(mockOpenAI).not.toHaveBeenCalled();
});
test('a Pro default retains its OpenAI priority',async()=>{
  expect((await ai().getStyleRecommendation({weather:mockWeatherData,closetItems:[],unitPreference:'metric',isPro:true})).modelUsed).toBe('gpt-4o');
});
test('explicit hosted model selection also respects trusted plan access',async()=>{
  await expect(ai().getStyleRecommendation({weather:mockWeatherData,closetItems:[],unitPreference:'metric',isPro:false,modelId:'gpt-4o'})).rejects.toThrow();
  expect(mockOpenAI).not.toHaveBeenCalled();
});
test('Free follow-ups use the Free default',async()=>{
  expect((await ai().getFollowUpRecommendation({weather:mockWeatherData,previousOutfit:'Shirt',previousReasoning:'Mild',followUpMessage:'Warmer',unitPreference:'metric',isPro:false})).modelUsed).toBe('gemini-2.5-flash');
  expect(mockOpenAI).not.toHaveBeenCalled();
});
test('Dev defaults retain Pro model access',async()=>{
  expect((await ai().getStyleRecommendation({weather:mockWeatherData,closetItems:[],unitPreference:'metric',isDev:true})).modelUsed).toBe('gpt-4o');
});
test('Pro BYOK retains its provider despite a different hosted default',async()=>{
  const result=await ai().getStyleRecommendation({weather:mockWeatherData,closetItems:[],unitPreference:'metric',isPro:true,userApiKey:'synthetic-user-key',byokProvider:'openai',modelId:'gemini-2.5-flash'});
  expect(result.modelUsed).toBe('gpt-4o');expect(mockGemini).not.toHaveBeenCalled();
});
test('a BYOK failure never retries with a hosted provider',async()=>{
  mockOpenAI.mockRejectedValue(new Error('synthetic user quota exhausted'));
  await expect(ai().getStyleRecommendation({weather:mockWeatherData,closetItems:[],unitPreference:'metric',isPro:true,userApiKey:'synthetic-user-key',byokProvider:'openai'})).rejects.toThrow('synthetic user quota exhausted');
  expect(mockOpenAI).toHaveBeenCalledTimes(1);expect(mockGemini).not.toHaveBeenCalled();expect(mockMistral).not.toHaveBeenCalled();
});
