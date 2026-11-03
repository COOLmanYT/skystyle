import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runV63Scenarios } from './v63-scenarios.mjs';

// Single-connection SQL compatibility checks. This is not concurrency acceptance.
// All identities, tables, credits and HTTP responses are disposable local fixtures.
const db = new PGlite();
let passed = 0;
const sql = async query => {
  await db.exec('RESET ROLE; SET TIME ZONE \'Australia/Sydney\';');
  try { return await db.exec(query); }
  finally { await db.exec('RESET ROLE;'); }
};
const value = async query => Object.values((await sql(query)).at(-1).rows[0])[0];
const rpc = query => value(`SET ROLE service_role; SELECT ${query};`);
const account = async () => {
  const id = randomUUID();
  await sql(`INSERT INTO public.users(id,name) VALUES('${id}','synthetic-local');`);
  return id;
};
const check = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
const parallel = async (work, number = 16) => {
  // Deliberately serialized: use run-entitlements.mjs for real connection races.
  const results = [];
  for (let i=0; i<number; i++) {
    try { results.push({ ok:true, result:await work(i) }); }
    catch(error) { results.push({ ok:false, error:error.message }); }
  }
  return results;
};
const reserve = (user,id) => rpc(`public.v6_reserve_usage('${user}','${id}','${'a'.repeat(64)}','recommendation',false,NULL,false)`);
try {
  await sql(await readFile(new URL('./isolated-base.sql',import.meta.url),'utf8'));
  await sql(await readFile(new URL('../migrations/20260928221124_v6_entitlement_foundation.sql',import.meta.url),'utf8'));
  await runV63Scenarios({ sql,value,rpc,account,parallel,check,reserve });
  const legacyUser = await account();
  const keptId = randomUUID();
  const keptItem = {id:keptId,label:'Keep',category:'top',colour:'blue',warmth:'light',waterproofing:'unknown',available:true};
  await rpc(`public.v63_mutate_wardrobe('${legacyUser}',0,'${JSON.stringify({type:'add',item:keptItem})}')`);
  await sql(`UPDATE public.closet SET items='["Keep","Legacy added","Legacy added"]' WHERE user_id='${legacyUser}';`);
  await sql(await readFile(new URL('../review/v65-writer-cutover.sql',import.meta.url),'utf8'));
  await check('cutover reconciles old writes without losing metadata or duplicating IDs',async () => {
    const result = await rpc(`public.v63_mutate_wardrobe('${legacyUser}',0,'{"type":"initialize"}')`);
    assert.equal(result.revision,2);
    assert.deepEqual(result.items,['Keep','Legacy added','Legacy added']);
    assert.deepEqual(result.wardrobeItems[0],keptItem);
    assert.equal(new Set(result.wardrobeItems.map(item=>item.id)).size,3);
  });
  await check('cutover rejects old writers and preserves revision-aware operations', async () => {
    const user = await account();
    await assert.rejects(sql(`SET ROLE service_role; INSERT INTO public.closet(user_id,items) VALUES('${user}','["Old writer"]');`),/wardrobe_writer_outdated/);
    const item = {id:randomUUID(),label:'New shirt',category:'top',colour:'blue',warmth:'light',waterproofing:'unknown',available:true};
    const operation = JSON.stringify({type:'add',item});
    const added = await rpc(`public.v63_mutate_wardrobe('${user}',0,'${operation}')`);
    assert.equal(added.revision,1);
    await assert.rejects(sql(`SET ROLE service_role; UPDATE public.closet SET items='[]' WHERE user_id='${user}';`),/wardrobe_writer_outdated/);
    const unchanged = await rpc(`public.v63_mutate_wardrobe('${user}',1,'{"type":"initialize"}')`);
    assert.deepEqual(unchanged,added);
    const removed = await rpc(`public.v63_mutate_wardrobe('${user}',1,'{"type":"delete","ids":["${item.id}"]}')`);
    assert.equal(removed.revision,2); assert.deepEqual(removed.items,[]);
  });
  console.log(`${passed} SQL smoke scenarios passed; not multi-connection or production acceptance.`);
} finally { await db.close(); }
