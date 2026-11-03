-- REVIEW CANDIDATE: install only with the matching scheduler acceptance checks.
-- No schedule, secret, allowance, claim, or application rollout changes.
-- NULL means idle; a bigint means pg_net enqueued an HTTP request.
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
REVOKE ALL ON FUNCTION public.invoke_automatic_recommendation_runner() FROM PUBLIC,anon,authenticated,service_role;
-- The postgres-owned cron job retains permission; application roles cannot read Vault.
