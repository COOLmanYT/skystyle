-- Applied to production on 10 October 2026 as repair_automatic_runner_timeout_and_secret_guard.
-- Function-only repair: no secret values, schedule changes, or 6.3 schema installation.

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

  IF runner_secret LIKE '%REPLACE_WITH%' OR length(runner_secret)<32 THEN
    RAISE EXCEPTION 'Sky Style runner authentication is not configured';
  END IF;

  select net.http_get(
    url := 'https://skystyle.app/api/cron/automatic-recommendations',
    headers := jsonb_build_object('Authorization', 'Bearer ' || runner_secret),
    timeout_milliseconds := 65000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_automatic_recommendation_runner() from public, anon, authenticated;
