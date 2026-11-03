import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/** Runs against the isolated PostgreSQL engine supplied by the test runner. */
export async function runIdleSchedulerScenarios({ sql, value, account, check }) {
  const user = await account();
  const schedule = randomUUID();
  const run = randomUUID();
  await sql(`
    CREATE TABLE net.fixture_http_calls(id bigint GENERATED ALWAYS AS IDENTITY, timeout_ms integer);
    CREATE OR REPLACE FUNCTION net.http_get(url text,headers jsonb,timeout_milliseconds integer)
      RETURNS bigint LANGUAGE plpgsql AS $$DECLARE request_id bigint; BEGIN
        IF url <> 'https://skystyle.app/api/cron/automatic-recommendations'
          OR headers->>'Authorization' <> 'Bearer ' || repeat('x',40)
          OR timeout_milliseconds <> 65000 THEN RAISE EXCEPTION 'invalid_fixture_request'; END IF;
        INSERT INTO net.fixture_http_calls(timeout_ms) VALUES(timeout_milliseconds) RETURNING id INTO request_id;
        RETURN request_id;
      END; $$;
    INSERT INTO public.automated_recommendation_schedules(id,user_id,next_run_at)
      VALUES('${schedule}','${user}',now()+interval '1 day');
    INSERT INTO public.automated_recommendation_runs(id,user_id,schedule_id,status,delivery_pending)
      VALUES('${run}','${user}','${schedule}','completed',false);
  `);
  const invoke = () => value("SELECT json_build_object('request',public.invoke_automatic_recommendation_runner());");
  const calls = () => value('SELECT to_json(count(*)) FROM net.fixture_http_calls;');
  for (const source of ['automatic-recommendations-cron.sql', 'review/idle-scheduler-invocation.sql', 'review/v63-scheduler-diagnostics.sql']) {
    const text = await readFile(new URL(`../${source}`, import.meta.url), 'utf8');
    const definition = text.match(/CREATE OR REPLACE FUNCTION public\.invoke_automatic_recommendation_runner\(\)[\s\S]*?END;\s*\$\$;/i)?.[0];
    assert(definition, `Missing scheduler definition in ${source}`);
    await sql(definition);
    const reset = () => sql(`
      UPDATE public.automated_recommendation_schedules SET active=false,locked_at=NULL;
      UPDATE public.automated_recommendation_runs SET delivery_pending=false;
      TRUNCATE public.automatic_runner_invocations,net.fixture_http_calls RESTART IDENTITY;
      DELETE FROM vault.decrypted_secrets;
      INSERT INTO vault.decrypted_secrets VALUES('skystyle_automatic_recommendations_cron_secret',repeat('x',40));
    `);
    await check(`${source}: 1440 idle ticks enqueue no HTTP and do not need Vault`, async () => {
      await reset(); await sql('DELETE FROM vault.decrypted_secrets;');
      assert.equal(await value('SELECT to_json(count(*) FILTER (WHERE request_id IS NOT NULL)) FROM (SELECT public.invoke_automatic_recommendation_runner() AS request_id FROM generate_series(1,1440)) ticks;'), 0);
      assert.equal(await calls(), 0);
    });
    await check(`${source}: future, inactive and freshly locked work stays idle`, async () => {
      await reset();
      await sql(`UPDATE public.automated_recommendation_schedules SET active=true,next_run_at=now()+interval '1 day' WHERE id='${schedule}';`);
      assert.equal((await invoke()).request, null);
      await sql(`UPDATE public.automated_recommendation_schedules SET active=false,next_run_at=now()-interval '1 minute' WHERE id='${schedule}';`);
      assert.equal((await invoke()).request, null);
      await sql(`UPDATE public.automated_recommendation_schedules SET active=true,locked_at=now() WHERE id='${schedule}';`);
      assert.equal((await invoke()).request, null); assert.equal(await calls(), 0);
    });
    await check(`${source}: due work and expired locks wake without claiming or rescheduling`, async () => {
      for (const lock of ['NULL', "now()-interval '11 minutes'"]) {
        await reset();
        await sql(`UPDATE public.automated_recommendation_schedules SET active=true,next_run_at=now()-interval '1 minute',locked_at=${lock} WHERE id='${schedule}';`);
        const snapshot = () => value(`SELECT json_build_object('next',next_run_at,'locked',locked_at) FROM public.automated_recommendation_schedules WHERE id='${schedule}';`);
        const before = await snapshot();
        assert.equal((await invoke()).request, 1); assert.equal(await calls(), 1);
        assert.deepEqual(await snapshot(), before);
        assert.equal(await value('SELECT to_json(count(*)) FROM public.automatic_runner_invocations;'), 1);
      }
    });
    await check(`${source}: delivery retries wake even without a due schedule`, async () => {
      await reset();
      await sql(`UPDATE public.automated_recommendation_runs SET status='completed',delivery_pending=true WHERE id='${run}';`);
      assert.equal((await invoke()).request, 1); assert.equal(await calls(), 1);
      await reset();
      await sql(`UPDATE public.automated_recommendation_runs SET status='running',delivery_pending=true WHERE id='${run}';`);
      assert.equal((await invoke()).request, null); assert.equal(await calls(), 0);
    });
    await check(`${source}: legacy schemas work without optional delivery or diagnostics tables`, async () => {
      await reset();
      await sql('ALTER TABLE public.automated_recommendation_runs RENAME COLUMN delivery_pending TO fixture_delivery_pending; ALTER TABLE public.automatic_runner_invocations RENAME TO fixture_runner_invocations;');
      try {
        assert.equal((await invoke()).request, null);
        await sql(`UPDATE public.automated_recommendation_schedules SET active=true,next_run_at=now()-interval '1 minute' WHERE id='${schedule}';`);
        assert.equal((await invoke()).request, 1);
      } finally {
        await sql('ALTER TABLE public.automated_recommendation_runs RENAME COLUMN fixture_delivery_pending TO delivery_pending; ALTER TABLE public.fixture_runner_invocations RENAME TO automatic_runner_invocations;');
      }
    });
    await check(`${source}: due work rejects invalid secrets without HTTP`, async () => {
      await reset();
      await sql(`UPDATE public.automated_recommendation_schedules SET active=true,next_run_at=now()-interval '1 minute' WHERE id='${schedule}';`);
      for (const secret of ["NULL", "'REPLACE_WITH_SAME_SECRET_AS_VERCEL_LONG_VALUE'", "'short'"]) {
        await sql(`UPDATE vault.decrypted_secrets SET decrypted_secret=${secret};`);
        await assert.rejects(invoke(), /authentication is not configured/);
      }
      assert.equal(await calls(), 0);
    });
  }
  await sql(await readFile(new URL('../review/idle-scheduler-invocation.sql', import.meta.url), 'utf8'));
  await check('scheduler invocation remains forbidden to application roles', async () => {
    for (const role of ['anon','authenticated','service_role']) {
      await assert.rejects(sql(`SET ROLE ${role}; SELECT public.invoke_automatic_recommendation_runner();`), /permission denied/);
    }
  });
}
