-- Sky Style exact automatic-recommendation scheduler
--
-- One-time production setup:
--   1. In Supabase Dashboard > Integrations > Cron, enable pg_cron.
--   2. In Database > Extensions, enable pg_net.
--   3. Replace the placeholder below with the SAME high-entropy CRON_SECRET
--      configured in the Vercel web project, then run this script in the
--      Supabase SQL Editor.
--
-- Do not commit the actual secret. Vault encrypts it at rest.

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'skystyle_automatic_recommendations_cron_secret'
  ) then
    perform vault.create_secret(
      'REPLACE_WITH_THE_SAME_VALUE_AS_VERCEL_CRON_SECRET',
      'skystyle_automatic_recommendations_cron_secret',
      'Authorizes Supabase Cron to invoke Sky Style automatic recommendations.'
    );
  end if;
end;
$$;

create or replace function public.invoke_automatic_recommendation_runner()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  request_id bigint;
  runner_secret text;
begin
  select decrypted_secret
  into strict runner_secret
  from vault.decrypted_secrets
  where name = 'skystyle_automatic_recommendations_cron_secret';

  select net.http_get(
    url := 'https://skystyle.app/api/cron/automatic-recommendations',
    headers := jsonb_build_object('Authorization', 'Bearer ' || runner_secret)
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_automatic_recommendation_runner() from public, anon, authenticated;

-- Re-running the script is safe: replace the old named job with this one.
select cron.unschedule('skystyle-automatic-recommendations')
where exists (select 1 from cron.job where jobname = 'skystyle-automatic-recommendations');

select cron.schedule(
  'skystyle-automatic-recommendations',
  '* * * * *',
  $$select public.invoke_automatic_recommendation_runner();$$
);

-- Verification queries:
-- select schedule, jobname, command from cron.job where jobname = 'skystyle-automatic-recommendations';
-- select * from cron.job_run_details order by start_time desc limit 20;
