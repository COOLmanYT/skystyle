-- REVIEW CANDIDATE. Aggregate operations only: no prompts, user activity or secrets.
BEGIN;
CREATE TABLE IF NOT EXISTS public.automatic_runner_invocations(request_id bigint PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.automatic_runner_invocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automatic_runner_invocations FROM anon,authenticated;
GRANT SELECT ON public.automatic_runner_invocations TO service_role;
CREATE OR REPLACE FUNCTION public.invoke_automatic_recommendation_runner()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE secret text; request_id bigint;
BEGIN
  SELECT decrypted_secret INTO STRICT secret FROM vault.decrypted_secrets WHERE name='skystyle_automatic_recommendations_cron_secret';
  IF secret LIKE '%REPLACE_WITH%' OR length(secret)<32 THEN RAISE EXCEPTION 'Sky Style runner authentication is not configured'; END IF;
  SELECT net.http_get(url:='https://skystyle.app/api/cron/automatic-recommendations',headers:=jsonb_build_object('Authorization','Bearer '||secret),timeout_milliseconds:=65000) INTO request_id;
  INSERT INTO public.automatic_runner_invocations(request_id) VALUES(request_id);
  DELETE FROM public.automatic_runner_invocations WHERE created_at<now()-interval '7 days';
  RETURN request_id;
END; $$;
REVOKE ALL ON FUNCTION public.invoke_automatic_recommendation_runner() FROM PUBLIC,anon,authenticated,service_role;
-- Cron's postgres-owned job retains invocation permission. App roles cannot access Vault.

-- SECURITY DEFINER is necessary only to aggregate pg_net extension responses.
-- Fixed queries and empty search_path expose neither response content nor Vault.
CREATE OR REPLACE FUNCTION public.v63_scheduler_health()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
SELECT jsonb_build_object(
  'overdue',(SELECT count(*) FROM public.automated_recommendation_schedules WHERE active AND next_run_at<now()-interval '10 minutes'),
  'stuck',(SELECT count(*) FROM public.automated_recommendation_runs WHERE status='running' AND lease_ends_at<now()),
  'pendingDelivery',(SELECT count(*) FROM public.automated_recommendation_runs WHERE delivery_pending),
  'httpFailures',(SELECT count(*) FROM public.automatic_runner_invocations i JOIN net._http_response r ON r.id=i.request_id WHERE i.created_at>now()-interval '1 hour' AND (r.status_code>=400 OR r.timed_out OR r.error_msg IS NOT NULL)),
  'unanswered',(SELECT count(*) FROM public.automatic_runner_invocations i LEFT JOIN net._http_response r ON r.id=i.request_id WHERE i.created_at BETWEEN now()-interval '1 hour' AND now()-interval '2 minutes' AND r.id IS NULL));
$$;
REVOKE ALL ON FUNCTION public.v63_scheduler_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v63_scheduler_health() TO service_role;
COMMIT;
