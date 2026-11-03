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

CREATE OR REPLACE FUNCTION public.invoke_automatic_recommendation_runner()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  secret text;
  request_id bigint;
  pending_delivery boolean := false;
BEGIN
  -- Match the atomic claim's eligibility without taking its locks or changing it.
  -- Keep the minute tick: newly due work and expired locks still wake promptly.
  IF NOT EXISTS (
    SELECT 1 FROM public.automated_recommendation_schedules
    WHERE active AND next_run_at <= now()
      AND (locked_at IS NULL OR locked_at < now() - interval '10 minutes')
  ) THEN
    -- The live legacy schema may not yet have durable delivery columns. Resolve
    -- this optional query only when installed, retaining its partial-index path.
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid = 'public.automated_recommendation_runs'::regclass
        AND attname = 'delivery_pending' AND NOT attisdropped
    ) THEN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.automated_recommendation_runs
        WHERE delivery_pending AND status <> ''running'')' INTO pending_delivery;
    END IF;
    IF NOT pending_delivery THEN RETURN NULL; END IF;
  END IF;

  SELECT decrypted_secret INTO STRICT secret FROM vault.decrypted_secrets
    WHERE name='skystyle_automatic_recommendations_cron_secret';
  IF secret IS NULL OR secret LIKE '%REPLACE_WITH%' OR length(secret)<32 THEN
    RAISE EXCEPTION 'Sky Style runner authentication is not configured';
  END IF;
  SELECT net.http_get(url:='https://skystyle.app/api/cron/automatic-recommendations',
    headers:=jsonb_build_object('Authorization','Bearer '||secret),
    timeout_milliseconds:=65000) INTO request_id;

  -- Retain diagnostics when installed; stay compatible with the legacy schema.
  IF to_regclass('public.automatic_runner_invocations') IS NOT NULL THEN
    INSERT INTO public.automatic_runner_invocations(request_id) VALUES(request_id);
    DELETE FROM public.automatic_runner_invocations WHERE created_at<now()-interval '7 days';
  END IF;
  RETURN request_id;
END; $$;

revoke all on function public.invoke_automatic_recommendation_runner() from public, anon, authenticated, service_role;

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
