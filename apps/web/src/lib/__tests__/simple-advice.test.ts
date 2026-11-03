import { getStyleRecommendation } from '../ai';
import { mockWeatherData } from '../../__tests__/mocks';
const mockCreate = jest.fn();
jest.mock('openai', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: (...args: unknown[]) => mockCreate(...args) } } })) }));
beforeEach(() => {
  mockCreate.mockImplementation(async (request: { messages: {content: string}[] }) => ({ choices: [{ message: { content: JSON.stringify({ outfit: 'Shirt, jeans and shoes.', reasoning: request.messages.some(m => m.content.includes('MUST be an empty string')) ? '' : 'Light layers suit mild weather.' }) }, finish_reason: 'stop' }] }));
});
test('the Simple planning prompt must produce output accepted by validation', async () => {
  await expect(getStyleRecommendation({ weather: mockWeatherData, closetItems: [], unitPreference: 'metric', isDev: true, modelId: 'gpt-4o', planningData: { complexity: 0, slots: [{ startTime: '09:00', endTime: '10:00', environment: 'outside', temperature: '' }] } })).resolves.toHaveProperty('outfit');
});
