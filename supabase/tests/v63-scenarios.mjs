import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function runV63Scenarios({sql,value,rpc,account,parallel,check,reserve}) {
  await sql(await readFile(new URL('./v63-isolated-base.sql',import.meta.url),'utf8'));
  const wardrobeSql=await readFile(new URL('../review/v63-daily-outfits.sql',import.meta.url),'utf8');
  const migratedUser=await account();
  await sql(`INSERT INTO public.closet(user_id,items) VALUES('${migratedUser}','["Blue shirt"]');`);
  await sql(wardrobeSql);
  await sql(await readFile(new URL('../review/v63-scheduled-finalization.sql',import.meta.url),'utf8'));
  await sql(await readFile(new URL('../review/v63-scheduler-diagnostics.sql',import.meta.url),'utf8'));
  const literal=data=>`'${JSON.stringify(data).replaceAll("'","''")}'::jsonb`;
  const item=(label='Shirt')=>({id:randomUUID(),label,category:'top',colour:'blue',warmth:'light',waterproofing:'unknown',available:true});
  const mutate=(user,revision,operation)=>rpc(`public.v63_mutate_wardrobe('${user}',${revision},${literal(operation)})`);
  const payload={outfit:'Blue shirt',reasoning:'Comfortable for the weather.',slots:[],gaps:[],bring:[],changes:[]};
  await check('6.3 wardrobe backfill preserves IDs on repeated installation',async()=>{
    const before=await mutate(migratedUser,0,{type:'initialize'});await sql(wardrobeSql);
    assert.deepEqual(await mutate(migratedUser,0,{type:'initialize'}),before);
  });
  await check('6.3 concurrent closet edits conflict and retry preserves both changes',async()=>{
    const user=await account(),a=item('Shirt'),b=item('Jacket');
    const results=await parallel(i=>mutate(user,0,{type:'add',item:i===0?a:b}),2);
    assert.equal(results.filter(row=>row.ok).length,1);assert(results.find(row=>!row.ok).error.includes('wardrobe_conflict'));
    const lost=results[0].ok?b:a;const result=await mutate(user,1,{type:'add',item:lost});
    assert.equal(result.revision,2);assert.deepEqual(new Set(result.items),new Set(['Shirt','Jacket']));
    await assert.rejects(mutate(user,2,{type:'add',item:{...item(),label:null}}),/invalid_wardrobe_item/);
  });
  await check('6.3 saved outfits isolate owners, replay saves and reject stale revisions',async()=>{
    const user=await account(),other=await account(),id=randomUUID();
    const add=()=>rpc(`public.v63_mutate_outfit('${user}','${id}',0,'add','Daily',${literal(payload)})`);
    const results=await parallel(add);assert(results.every(row=>row.ok));
    await assert.rejects(rpc(`public.v63_mutate_outfit('${other}','${id}',0,'delete','',NULL)`),/outfit_conflict/);
    await rpc(`public.v63_mutate_outfit('${user}','${id}',0,'update','Updated',${literal(payload)})`);
    await assert.rejects(rpc(`public.v63_mutate_outfit('${user}','${id}',0,'update','Stale',${literal(payload)})`),/outfit_conflict/);
    await sql(`DELETE FROM public.users WHERE id='${user}';`);
    assert.equal(await value(`SELECT to_json(count(*)) FROM public.saved_outfits WHERE id='${id}';`),0);
  });
  const start=async(user=undefined)=>{
    user??=await account();const schedule=randomUUID(),occurrence=randomUUID();
    const at='2026-10-01T22:00:00Z';
    await sql(`INSERT INTO public.automated_recommendation_schedules(id,user_id,next_run_at) VALUES('${schedule}','${user}','${at}');`);
    const begun=await rpc(`public.v63_begin_auto_run('${schedule}','${occurrence}','${at}')`);
    assert.equal(begun.action,'generate');return{user,schedule,occurrence,at,run:begun.run};
  };
  const stage=(fixture,chargeable=true,receipt=null,plan='free')=>sql(`SET ROLE service_role; SELECT public.v63_stage_auto_result('${fixture.run.id}','${fixture.run.lease_token}','{"temp":20}',${literal({...payload,chargeable})},${receipt?literal(receipt):'NULL'},'${plan}');`);
  const finish=(fixture,success=true)=>rpc(`public.v63_finish_auto_run('${fixture.run.id}','${fixture.run.lease_token}','2026-10-04T22:00:00Z',${success})`);
  const usage=user=>value(`SELECT to_json(COALESCE(sum(ai_uses),0)) FROM public.daily_usage WHERE user_id='${user}';`);
  await check('6.3 scheduler persists before charging and concurrent retries settle once',async()=>{
    const f=await start();await assert.rejects(finish(f),/output_not_persisted/);assert.equal(await usage(f.user),0);
    await stage(f);const results=await parallel(()=>finish(f));assert(results.every(row=>row.ok&&row.result.status==='completed'));assert.equal(await usage(f.user),1);
    await parallel(()=>sql(`SET ROLE service_role; SELECT public.v63_deliver_auto_run('${f.run.id}');`));
    assert.equal(await value(`SELECT to_json(count(*)) FROM public.user_inbox WHERE automatic_occurrence_id='${f.occurrence}';`),1);
  });
  await check('6.3 finalization storage failure rolls back charging and retains recoverable output',async()=>{
    const f=await start();await stage(f);
    await sql("CREATE FUNCTION public.v63_test_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic_storage_failure'; END$$; CREATE TRIGGER v63_test_fault BEFORE UPDATE ON public.automated_recommendation_runs FOR EACH ROW EXECUTE FUNCTION public.v63_test_fault();");
    try{await assert.rejects(finish(f),/synthetic_storage_failure/);assert.equal(await usage(f.user),0);}finally{await sql('DROP TRIGGER v63_test_fault ON public.automated_recommendation_runs; DROP FUNCTION public.v63_test_fault();');}
    assert.equal((await finish(f)).status,'completed');assert.equal(await usage(f.user),1);
  });
  await check('6.3 expired worker recovers output while stale worker cannot finish',async()=>{
    const f=await start();await stage(f);
    assert.equal((await rpc(`public.v63_begin_auto_run('${f.schedule}','${f.occurrence}','${f.at}')`)).action,'busy');
    await sql(`UPDATE public.automated_recommendation_runs SET lease_ends_at=now()-interval '1 second' WHERE id='${f.run.id}';`);
    const recovered=await rpc(`public.v63_begin_auto_run('${f.schedule}','${f.occurrence}','${f.at}')`);assert.equal(recovered.action,'finalize');
    await assert.rejects(finish(f),/run_lease_lost/);f.run=recovered.run;assert.equal((await finish(f)).status,'completed');
  });
  await check('6.3 interrupted generation is abandoned; wardrobe gaps use no allowance',async()=>{
    const interrupted=await start();await sql(`UPDATE public.automated_recommendation_runs SET lease_ends_at=now()-interval '1 second' WHERE id='${interrupted.run.id}';`);
    const abandoned=await rpc(`public.v63_begin_auto_run('${interrupted.schedule}','${interrupted.occurrence}','${interrupted.at}')`);assert.equal(abandoned.action,'abandon');interrupted.run=abandoned.run;
    assert.equal((await finish(interrupted,false)).status,'failed');assert.equal(await usage(interrupted.user),0);
    const gap=await start();await stage(gap,false);assert.equal((await finish(gap)).status,'completed');assert.equal(await usage(gap.user),0);
  });
  await check('6.3 blocked accounts release V6 reservations and retries cannot charge',async()=>{
    await sql('UPDATE public.v6_entitlement_rollout SET enabled=true;');
    try{
      const f=await start(),receipt=await reserve(f.user,f.occurrence);await stage(f,true,receipt);
      await sql(`INSERT INTO public.user_access_controls(user_id,app_blocked) VALUES('${f.user}',true);`);
      assert.equal((await finish(f)).status,'failed');assert.equal(await usage(f.user),0);
      assert.equal(await value(`SELECT to_json(status) FROM public.v6_usage_reservations WHERE request_id='${f.occurrence}';`),'released');
      assert.equal((await finish(f)).status,'failed');
    }finally{await sql('UPDATE public.v6_entitlement_rollout SET enabled=false;');}
  });
  await check('6.3 V6 successful and incomplete results commit or refund atomically',async()=>{
    await sql('UPDATE public.v6_entitlement_rollout SET enabled=true;');
    try{for(const charge of [true,false]){const f=await start(),receipt=await reserve(f.user,f.occurrence);await stage(f,charge,receipt);assert.equal((await finish(f)).status,'completed');assert.equal(await usage(f.user),charge?1:0);}}
    finally{await sql('UPDATE public.v6_entitlement_rollout SET enabled=false;');}
  });
  await check('6.3 canceled or rescheduled work cannot charge or overwrite the new schedule',async()=>{
    for(const canceled of [true,false]){const f=await start();await stage(f);
      await sql(`UPDATE public.automated_recommendation_schedules SET active=${!canceled},next_run_at='2026-10-10T22:00:00Z' WHERE id='${f.schedule}';`);
      assert.equal((await finish(f)).status,'failed');assert.equal(await usage(f.user),0);
      assert.equal(await value(`SELECT to_json(next_run_at) FROM public.automated_recommendation_schedules WHERE id='${f.schedule}';`),'2026-10-11T09:00:00+11:00');
    }
  });
  await check('6.3 changed legacy plan or lowered account cap prevents a stale charge',async()=>{
    const f=await start();await stage(f);await sql(`UPDATE public.users SET is_pro=true WHERE id='${f.user}';`);assert.equal((await finish(f)).status,'failed');assert.equal(await usage(f.user),0);
    const capped=await start();await stage(capped);await sql(`INSERT INTO public.user_access_controls(user_id,app_daily_ai_limit) VALUES('${capped.user}',0);`);assert.equal((await finish(capped)).status,'failed');assert.equal(await usage(capped.user),0);
  });
  await check('6.3 legacy Pro finalization debits one credit once',async()=>{
    const user=await account();await sql(`UPDATE public.users SET is_pro=true WHERE id='${user}';INSERT INTO public.credits(user_id,current_balance,last_reset_date) VALUES('${user}',10,(now() AT TIME ZONE 'UTC')::date);`);
    const f=await start(user);await stage(f,true,null,'pro');await parallel(()=>finish(f));
    assert.equal(await value(`SELECT to_json(current_balance) FROM public.credits WHERE user_id='${user}';`),9);
  });
  await check('6.3 browser roles cannot access private tables or service-only RPCs',async()=>{
    const user=await account();
    for(const role of ['anon','authenticated']){
      for(const table of ['closet','saved_outfits','automated_recommendation_runs','automatic_runner_invocations'])await assert.rejects(sql(`SET ROLE ${role};SELECT * FROM public.${table};`),/permission denied/);
      for(const call of [`v63_mutate_wardrobe('${user}',0,'{"type":"initialize"}')`,`v63_scheduler_health()`])await assert.rejects(sql(`SET ROLE ${role};SELECT public.${call};`),/permission denied/);
    }
  });
  await check('6.3 scheduler rejects placeholder authentication and reports failures as aggregates',async()=>{
    await sql("INSERT INTO vault.decrypted_secrets VALUES('skystyle_automatic_recommendations_cron_secret','REPLACE_WITH_A_REAL_LONG_AUTHENTICATION_SECRET');");
    await assert.rejects(sql('SELECT public.invoke_automatic_recommendation_runner();'),/authentication is not configured/);
    await sql("UPDATE vault.decrypted_secrets SET decrypted_secret=repeat('x',40);SELECT public.invoke_automatic_recommendation_runner();INSERT INTO net._http_response VALUES(9001,401,false,NULL);");
    const result=await rpc('public.v63_scheduler_health()');assert.equal(result.httpFailures,1);assert(!JSON.stringify(result).includes('secret'));
  });
}
