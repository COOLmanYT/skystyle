import { canUseFeature, getDailyLimitsInfo } from '../daily-usage';
import { supabaseAdmin } from '../supabase';
jest.mock('../supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

let override: number | null = null, controlError = false;
const controlsRead = jest.fn();
beforeEach(() => {
  override = null; controlError = false;
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
    const query = { select: () => query, eq: () => query,
      single: async () => ({ data: { ai_uses: 1, follow_ups: 0, closet_uses: 0, source_picks: 0, model_switches: 0 }, error: null }),
      maybeSingle: async () => { controlsRead(); return { data: { app_daily_ai_limit: override }, error: controlError ? { message: 'synthetic unavailable controls' } : null }; },
    };
    expect(['daily_usage','user_access_controls']).toContain(table);
    return query;
  });
});
test.each([0, 2, 20, 30, null])('Free display and enforcement use the same effective cap: %s', async value => {
  override = value;
  const admission = await canUseFeature('synthetic','ai_uses',false);
  const display = await getDailyLimitsInfo('synthetic',false);
  expect(display.ai.limit).toBe(admission.limit);
  expect(display.ai.limit).toBe(value === null ? 20 : Math.min(20,value));
});
test('a Pro override also appears in the display', async () => {
  override = 7;
  expect((await getDailyLimitsInfo('synthetic',true)).ai.limit).toBe(7);
});
test('control failures must not display a larger allowance', async () => {
  controlError = true;
  await expect(getDailyLimitsInfo('synthetic',false)).rejects.toBeDefined();
});
test.each([[false,true,false,null],[false,false,true,200]] as const)('dev/demo allowances bypass account overrides', async (isPro,isDev,isDemo,expected) => {
  override = 0;
  expect((await getDailyLimitsInfo('synthetic',isPro,isDev,isDemo)).ai.limit).toBe(expected);
  expect(controlsRead).not.toHaveBeenCalled();
});
