/** Disposable local PostgreSQL tests. Never accepts a URL or production host.
 * Supply --pg-bin <absolute directory containing initdb/pg_ctl/psql>. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { randomUUID, createHash } from 'node:crypto';
const binIndex = process.argv.indexOf('--pg-bin');
assert(binIndex > 0 && process.argv[binIndex + 1], 'Provide --pg-bin; no remote database URL is supported');
const bin = resolve(process.argv[binIndex + 1]);
const exe = (name) => join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
const cluster = await mkdtemp(join(tmpdir(), 'skystyle-v6-pg-'));
assert(resolve(cluster).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')));
const port = await new Promise((res, rej) => { const server = createServer(); server.once('error', rej); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => res(value)); }); });
const env = { ...process.env, PGHOST:'127.0.0.1', PGPORT:String(port), PGUSER:'postgres', PGPASSWORD:'', PGDATABASE:'postgres', PGSERVICE:'', PGSSLMODE:'disable' };
delete env.PGSERVICE;
delete env.PGSERVICEFILE;
function run(file, args, input = '', timeout = 45000) {
  return new Promise((res, rej) => {
    // On Windows pg_ctl's detached server can inherit pipe handles, preventing
    // "close" even after pg_ctl exits. Its server output goes to server.log.
    const detached = file === exe('pg_ctl');
    const child = spawn(file, args, { env, windowsHide:true, stdio:detached ? 'ignore' : ['pipe','pipe','pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); rej(new Error(`${file} timed out`)); }, timeout);
    child.stdout?.on('data', value => { stdout += value; }); child.stderr?.on('data', value => { stderr += value; });
    child.once('error', error => { clearTimeout(timer); rej(error); });
    child.once('close', code => { clearTimeout(timer); code === 0 ? res(stdout.trim()) : rej(new Error(stderr.trim() || `Local command exited ${code}`)); });
    child.stdin?.on('error', () => {}); child.stdin?.end(input);
  });
}
let database = 'postgres', started = false, count = 0;
const sql = (query) => run(exe('psql'), ['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','postgres','-d',database], query);
const value = async (query) => JSON.parse(await sql(`SET TIME ZONE 'Australia/Sydney'; ${query}`));
const rpc = (query) => value(`SET ROLE service_role; SELECT ${query};`);
const fingerprint = createHash('sha256').update('synthetic test input').digest('hex');
const reserve = (user, id=randomUUID(), purpose='recommendation', key=null, credit=false) =>
  rpc(`public.v6_reserve_usage('${user}','${id}','${fingerprint}','${purpose}',${credit},${key ? `'${key}'` : 'NULL'},false)`);
async function account(dev=false) { const id=randomUUID(); await sql(`INSERT INTO public.users(id,name,is_dev) VALUES('${id}','isolated-v6-fixture',${dev});`); return id; }
async function parallel(work, number=16) { return Promise.all(Array.from({length:number},(_,index)=>work(index).then(result=>({ok:true,result}),error=>({ok:false,error:error.message})))); }
async function check(name, work) { await work(); count++; console.log(`PASS ${name}`); }
const base = await readFile(new URL('./isolated-base.sql',import.meta.url),'utf8');
const foundation = await readFile(new URL('../migrations/20260928221124_v6_entitlement_foundation.sql',import.meta.url),'utf8');
assert.equal(createHash('sha256').update(foundation).digest('hex').toUpperCase(),'2E5EA8B6DC0223AF895A418CA6CDB79B6C9B4AE910EF3F1941EC0586E2A8B998','Frozen approved SQL must remain unchanged');
try {
  await run(exe('initdb'), ['-D',join(cluster,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8']);
  started=true; // Also clean up if pg_ctl starts the server but loses its reply.
  await run(exe('pg_ctl'), ['start','-D',join(cluster,'data'),'-l',join(cluster,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','-t','30']);
  await sql('CREATE DATABASE skystyle_v6_isolated;'); database='skystyle_v6_isolated';
  await sql(base + '\n' + foundation);
  console.log(await sql('SELECT version();'));
  // Exact approved functions and actual simultaneous PostgreSQL connections.
  await sql('UPDATE public.v6_entitlement_rollout SET enabled=true;');
  await check('concurrent initialization grants exactly ten once', async () => {
    const user=await account(); const results=await parallel(()=>rpc(`public.v6_initialize_account('${user}')`).catch(async error=> { // void RPC emits no JSON
      if (error instanceof SyntaxError) return null; throw error;
    })); assert(results.every(row=>row.ok));
    assert.equal(await value(`SELECT to_json(sum(remaining)) FROM public.v6_credit_lots WHERE user_id='${user}';`),10);
  });
  await check('20 simultaneous recommendations admit only five', async () => {
    const user=await account(); const results=await parallel(()=>reserve(user),20); const accepted=results.filter(row=>row.ok);
    assert.equal(accepted.length,5); assert(results.filter(row=>!row.ok).every(row=>row.error.includes('daily_usage_limit')));
    await Promise.all(accepted.map(row=>rpc(`public.v6_settle_usage('${user}','${row.result.requestId}',true)`)));
    assert.equal(await value(`SELECT to_json(ai_uses) FROM public.daily_usage WHERE user_id='${user}';`),5);
  });
  await check('duplicate reserve/settle never reruns or increments twice', async () => {
    const user=await account(), id=randomUUID(); const results=await parallel(()=>reserve(user,id));
    assert(results.every(row=>row.ok)); assert.equal(results.filter(row=>row.result.created).length,1);
    await parallel(()=>rpc(`public.v6_settle_usage('${user}','${id}',true)`));
    assert.equal(await value(`SELECT to_json(ai_uses) FROM public.daily_usage WHERE user_id='${user}';`),1);
  });
  await check('simultaneous API reservations cannot overspend and partial refunds stay once-only', async () => {
    const user=await account(), key=randomUUID(); await rpc(`public.v6_initialize_account('${user}')`).catch(error=>{ if (!(error instanceof SyntaxError)) throw error; });
    await sql(`INSERT INTO public.api_keys(id,user_id,credits_remaining) VALUES('${key}','${user}',0);`);
    const results=await parallel(()=>reserve(user,randomUUID(),'api_recweather',key)); const accepted=results.filter(row=>row.ok);
    assert.equal(accepted.length,3); assert(results.filter(row=>!row.ok).every(row=>row.error.includes('insufficient_credits')));
    await Promise.all(accepted.map(row=>rpc(`public.v6_settle_usage('${user}','${row.result.requestId}',true,2)`)));
    await Promise.all(accepted.map(row=>rpc(`public.v6_settle_usage('${user}','${row.result.requestId}',true,2)`)));
    assert.equal(await value(`SELECT to_json(sum(remaining)) FROM public.v6_credit_lots WHERE user_id='${user}';`),4);
  });
  await check('concurrent new keys honor three slots and never multiply grants', async () => {
    const user=await account(); const results=await parallel(()=>rpc(`to_json(public.v6_create_api_key('${user}','${randomUUID()}','${'a'.repeat(32)}:${'b'.repeat(128)}','sk_live_abcd'))`));
    assert.equal(results.filter(row=>row.ok).length,3);
    assert(results.filter(row=>!row.ok).every(row=>row.error.includes('api_key_plan_limit')));
    assert.equal(await value(`SELECT to_json(sum(credits_remaining)) FROM public.api_keys WHERE user_id='${user}';`),0);
    assert.equal(await value(`SELECT to_json(sum(remaining)) FROM public.v6_credit_lots WHERE user_id='${user}';`),10);
  });
  await check('parallel admin retries create one period and one grant', async () => {
    const admin=await account(true), user=await account(), period=randomUUID();
    const results=await parallel(()=>rpc(`public.v6_set_pro_period('${admin}','${user}','${period}',date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',(date_trunc('month',now() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC')`));
    assert(results.every(row=>row.ok)); assert.equal(await value(`SELECT to_json(sum(remaining)) FROM public.v6_credit_lots WHERE user_id='${user}';`),50);
  });
  await check('simultaneous model switches cap at two and a failure releases its slot', async () => {
    const user=await account();
    const switched=()=>rpc(`public.v6_reserve_usage('${user}','${randomUUID()}','${fingerprint}','recommendation',false,NULL,true)`);
    const results=await parallel(switched), accepted=results.filter(row=>row.ok);
    assert.equal(accepted.length,2); assert(results.filter(row=>!row.ok).every(row=>row.error.includes('daily_model_switch_limit')));
    await rpc(`public.v6_settle_usage('${user}','${accepted[0].result.requestId}',false)`);
    await switched();
  });
  // Additional proposed SQL is tested locally only; never automatically applied.
  await sql(await readFile(new URL('../review/v6-atomic-key-revocation.sql',import.meta.url),'utf8'));
  await check('pending key revocation refunds into the same archived legacy lot', async()=>{
    const user=await account(), key=randomUUID();
    await sql(`INSERT INTO public.api_keys(id,user_id,credits_remaining) VALUES('${key}','${user}',20);`);
    const receipt=await reserve(user,randomUUID(),'api_recweather',key);
    await parallel(()=>rpc(`public.v6_revoke_api_key('${user}','${key}')`));
    assert.deepEqual(await value(`SELECT json_build_object('remaining',remaining,'archived',archived) FROM public.v6_credit_lots WHERE user_id='${user}';`),{remaining:20,archived:true});
    assert.equal((await rpc(`public.v6_settle_usage('${user}','${receipt.requestId}',true)`)).status,'released');
    await assert.rejects(reserve(user,randomUUID(),'api_recweather',key),/api_key_unavailable/);
    for (const role of ['anon','authenticated']) await assert.rejects(value(`SET ROLE ${role}; SELECT public.v6_revoke_api_key('${user}','${key}');`),/permission denied/);
  });
  await check('revocation and settlement are linearizable on the account lock', async()=>{
    for(let attempt=0;attempt<4;attempt++) {
      const user=await account(), key=randomUUID();
      await sql(`INSERT INTO public.api_keys(id,user_id,credits_remaining) VALUES('${key}','${user}',20);`);
      const receipt=await reserve(user,randomUUID(),'api_recweather',key);
      const [settlement]=await Promise.all([rpc(`public.v6_settle_usage('${user}','${receipt.requestId}',true)`),rpc(`public.v6_revoke_api_key('${user}','${key}')`)]);
      assert.deepEqual(await value(`SELECT json_build_object('remaining',remaining,'archived',archived) FROM public.v6_credit_lots WHERE user_id='${user}';`),{remaining:settlement.status==='committed'?17:20,archived:true});
    }
  });
  await check('the rollback fixture passes on the exact unmodified functions',async()=>{
    // Its final post-rollback check expects the inactive baseline.
    await sql('UPDATE public.v6_entitlement_rollout SET enabled=false;');
    await sql(await readFile(new URL('./v6-entitlements-regression.sql',import.meta.url),'utf8'));
  });
  // Clock injection is TEST ONLY in a second disposable database. The frozen
  // migration above remains byte-identical. Do not call this production QA.
  database='postgres'; await sql('CREATE DATABASE skystyle_v6_clock_test;'); database='skystyle_v6_clock_test';
  const noRoles=base.replace(/CREATE ROLE[^;]+;/g,'');
  const clock="CREATE FUNCTION public.v6_test_clock() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('skystyle.test_time',true),'')::timestamptz,clock_timestamp()); $$;";
  await sql(noRoles+'\n'+clock+'\n'+foundation.replace(/\b(?:clock_timestamp|now)\(\)/g,'public.v6_test_clock()'));
  await sql('UPDATE public.v6_entitlement_rollout SET enabled=true;');
  const timed = (at,query) => value(`SET skystyle.test_time='${at}'; SET ROLE service_role; SELECT ${query};`);
  await check('monthly quota serializes across simultaneous requests at a controlled date', async () => {
    const user=await account();
    await sql(`INSERT INTO public.daily_usage(user_id,usage_date,ai_uses) VALUES('${user}','2026-09-01',59);`);
    const results=await parallel(()=>timed('2026-09-29T12:00:00Z',`public.v6_reserve_usage('${user}','${randomUUID()}','${fingerprint}','recommendation')`),20);
    assert.equal(results.filter(row=>row.ok).length,1);
    assert(results.filter(row=>!row.ok).every(row=>row.error.includes('monthly_usage_limit')));
  });
  await check('UTC midnight resets daily quota but retains monthly consumption', async()=>{
    const user=await account(); for(let i=0;i<5;i++) await timed('2026-09-29T23:59:59Z',`public.v6_reserve_usage('${user}','${randomUUID()}','${fingerprint}','recommendation')`);
    await assert.rejects(timed('2026-09-29T23:59:59Z',`public.v6_reserve_usage('${user}','${randomUUID()}','${fingerprint}','recommendation')`),/daily_usage_limit/);
    await timed('2026-09-30T00:00:00Z',`public.v6_reserve_usage('${user}','${randomUUID()}','${fingerprint}','recommendation')`);
    assert.equal(await value(`SELECT to_json(sum(ai_uses)) FROM public.daily_usage WHERE user_id='${user}';`),6);
  });
  await check('month/year rollover drops old caps; failed late work refunds its original day', async()=>{
    const user=await account(); await timed('2026-12-31T23:59:59Z',`public.v6_initialize_account('${user}')`).catch(error=>{ if (!(error instanceof SyntaxError)) throw error; });
    await sql(`INSERT INTO public.daily_usage(user_id,usage_date,ai_uses) VALUES('${user}','2026-12-30',59);`);
    const id=randomUUID(); await timed('2026-12-31T23:59:59Z',`public.v6_reserve_usage('${user}','${id}','${fingerprint}','recommendation')`);
    await assert.rejects(timed('2026-12-31T23:59:59Z',`public.v6_reserve_usage('${user}','${randomUUID()}','${fingerprint}','recommendation')`),/monthly_usage_limit/);
    await timed('2027-01-01T00:00:00Z',`public.v6_reserve_usage('${user}','${randomUUID()}','${fingerprint}','recommendation')`);
    await timed('2027-01-01T00:00:01Z',`public.v6_settle_usage('${user}','${id}',false)`);
    assert.deepEqual(await value(`SELECT json_agg(json_build_object('date',usage_date,'used',ai_uses) ORDER BY usage_date) FROM public.daily_usage WHERE user_id='${user}';`),[{date:'2026-12-30',used:59},{date:'2026-12-31',used:0},{date:'2027-01-01',used:1}]);
  });
  await check('Pro period end is exclusive and expired grants cannot fund work', async()=>{
    const admin=await account(true), user=await account(), period=randomUUID();
    await timed('2028-01-31T12:00:00Z',`public.v6_set_pro_period('${admin}','${user}','${period}','2028-01-31T12:00:00Z','2028-02-29T12:00:00Z')`);
    assert.equal(await timed('2028-02-29T11:59:59Z',`to_json(public.v6_effective_plan('${user}',public.v6_test_clock()))`),'pro');
    assert.equal(await timed('2028-02-29T12:00:00Z',`to_json(public.v6_effective_plan('${user}',public.v6_test_clock()))`),'free');
    const id=randomUUID(); await assert.rejects(timed('2028-02-29T12:00:00Z',`public.v6_reserve_usage('${user}','${id}','${fingerprint}','followup',true)`),/insufficient_credits/);
  });
  await check('explicit renewal creates one new grant and leaves the expired grant expired', async()=>{
    const admin=await account(true), user=await account(), first=randomUUID(), renewal=randomUUID();
    await timed('2028-01-31T12:00:00Z',`public.v6_set_pro_period('${admin}','${user}','${first}','2028-01-31T12:00:00Z','2028-02-29T12:00:00Z')`);
    await parallel(()=>timed('2028-02-29T12:00:00Z',`public.v6_set_pro_period('${admin}','${user}','${renewal}','2028-02-29T12:00:00Z','2028-03-29T12:00:00Z')`));
    assert.equal(await timed('2028-02-29T12:00:00Z',`to_json(public.v6_effective_plan('${user}',public.v6_test_clock()))`),'pro');
    assert.equal(await value(`SELECT to_json(count(*)) FROM public.v6_credit_lots WHERE user_id='${user}' AND kind='pro_grant';`),2);
    const id=randomUUID(); await timed('2028-02-29T12:00:00Z',`public.v6_reserve_usage('${user}','${id}','${fingerprint}','followup',true)`);
    await timed('2028-02-29T12:00:01Z',`public.v6_settle_usage('${user}','${id}',true)`);
    assert.deepEqual(await value(`SELECT json_agg(json_build_object('kind',kind,'remaining',remaining) ORDER BY expires_at) FROM public.v6_credit_lots WHERE user_id='${user}';`),[{kind:'pro_grant',remaining:50},{kind:'pro_grant',remaining:49}]);
  });
  console.log(JSON.stringify({passed:count, productionTouched:false, exactMigrationConcurrent:true, proposedRevocationSqlTestedLocally:true, rolloverClockInjectedOnly:true, fixtureCluster:cluster}));
} finally {
  if (started) await run(exe('pg_ctl'),['stop','-D',join(cluster,'data'),'-m','fast','-w','-t','30']);
  // Keep the stopped synthetic cluster/logs for inspection; never delete a
  // caller-provided path or touch any production database.
}
