-- REVIEW CANDIDATE: requires the existing V6 foundation but never activates it.
-- Drain all old scheduler workers before installing and deploying the new runner.
BEGIN;
ALTER TABLE public.automated_recommendation_runs
  ADD COLUMN IF NOT EXISTS occurrence_id uuid,
  ADD COLUMN IF NOT EXISTS occurrence_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS usage_receipt jsonb,
  ADD COLUMN IF NOT EXISTS legacy_plan text,
  ADD COLUMN IF NOT EXISTS delivery_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generation_started boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS auto_runs_occurrence_idx ON public.automated_recommendation_runs(occurrence_id);
CREATE INDEX IF NOT EXISTS auto_runs_schedule_idx ON public.automated_recommendation_runs(schedule_id);
CREATE INDEX IF NOT EXISTS auto_runs_delivery_idx ON public.automated_recommendation_runs(created_at) WHERE delivery_pending;
ALTER TABLE public.user_inbox ADD COLUMN IF NOT EXISTS automatic_occurrence_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS inbox_auto_occurrence_idx ON public.user_inbox(automatic_occurrence_id);
REVOKE ALL ON public.automated_recommendation_runs FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.automated_recommendation_runs TO service_role;

CREATE OR REPLACE FUNCTION public.v63_begin_auto_run(p_schedule_id uuid,p_occurrence_id uuid,p_occurrence_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE schedule public.automated_recommendation_schedules%ROWTYPE; run public.automated_recommendation_runs%ROWTYPE; fresh bigint;
BEGIN
  SELECT * INTO STRICT schedule FROM public.automated_recommendation_schedules WHERE id=p_schedule_id FOR UPDATE;
  IF NOT schedule.active OR schedule.next_run_at<>p_occurrence_at THEN RETURN jsonb_build_object('action','skip'); END IF;
  INSERT INTO public.automated_recommendation_runs(schedule_id,user_id,status,occurrence_id,occurrence_at,generation_started)
    VALUES(schedule.id,schedule.user_id,'running',p_occurrence_id,p_occurrence_at,true) ON CONFLICT(occurrence_id) DO NOTHING;
  GET DIAGNOSTICS fresh = ROW_COUNT;
  SELECT * INTO STRICT run FROM public.automated_recommendation_runs WHERE occurrence_id=p_occurrence_id FOR UPDATE;
  IF run.schedule_id<>schedule.id OR run.user_id<>schedule.user_id OR run.occurrence_at<>p_occurrence_at THEN RAISE EXCEPTION 'occurrence_mismatch'; END IF;
  IF run.status<>'running' THEN RETURN jsonb_build_object('action','skip'); END IF;
  IF fresh=0 AND run.lease_ends_at>clock_timestamp() THEN
    UPDATE public.automated_recommendation_schedules SET locked_at=NULL WHERE id=schedule.id;
    RETURN jsonb_build_object('action','busy');
  END IF;
  UPDATE public.automated_recommendation_runs SET lease_token=gen_random_uuid(),lease_ends_at=clock_timestamp()+interval '2 minutes'
    WHERE id=run.id RETURNING * INTO run;
  RETURN jsonb_build_object('action',CASE WHEN fresh>0 THEN 'generate' WHEN run.recommendation IS NOT NULL THEN 'finalize' ELSE 'abandon' END,'run',to_jsonb(run));
END; $$;

CREATE OR REPLACE FUNCTION public.v63_stage_auto_result(p_run_id uuid,p_token uuid,p_weather jsonb,p_recommendation jsonb,p_receipt jsonb,p_legacy_plan text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF jsonb_typeof(p_recommendation) IS DISTINCT FROM 'object' OR jsonb_typeof(p_recommendation->'outfit') IS DISTINCT FROM 'string' OR jsonb_typeof(p_recommendation->'reasoning') IS DISTINCT FROM 'string' OR length(trim(COALESCE(p_recommendation->>'reasoning','')))=0 OR length(trim(COALESCE(p_recommendation->>'outfit','')))=0 THEN RAISE EXCEPTION 'invalid_output'; END IF;
  UPDATE public.automated_recommendation_runs SET weather=p_weather,recommendation=p_recommendation,usage_receipt=p_receipt,legacy_plan=p_legacy_plan
    WHERE id=p_run_id AND status='running' AND lease_token=p_token AND lease_ends_at>clock_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION 'run_lease_lost'; END IF;
  UPDATE public.automated_recommendation_schedules SET locked_at=NULL WHERE id=(SELECT schedule_id FROM public.automated_recommendation_runs WHERE id=p_run_id);
END; $$;

CREATE OR REPLACE FUNCTION public.v63_finish_auto_run(p_run_id uuid,p_token uuid,p_next_run timestamptz,p_success boolean,p_error text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE run public.automated_recommendation_runs%ROWTYPE; schedule public.automated_recommendation_schedules%ROWTYPE;
  profile public.users%ROWTYPE; controls public.user_access_controls%ROWTYPE; receipt jsonb; charge boolean; mode boolean; schedule_current boolean;
BEGIN
  IF p_success IS NULL OR p_next_run IS NULL THEN RAISE EXCEPTION 'invalid_finalization'; END IF;
  SELECT * INTO STRICT run FROM public.automated_recommendation_runs WHERE id=p_run_id;
  SELECT * INTO STRICT profile FROM public.users WHERE id=run.user_id FOR UPDATE;
  SELECT * INTO schedule FROM public.automated_recommendation_schedules WHERE id=run.schedule_id FOR UPDATE;
  SELECT * INTO STRICT run FROM public.automated_recommendation_runs WHERE id=p_run_id FOR UPDATE;
  IF run.status<>'running' THEN RETURN jsonb_build_object('status',run.status); END IF;
  IF p_token IS NULL OR run.lease_token IS DISTINCT FROM p_token OR run.lease_ends_at<=clock_timestamp() THEN RAISE EXCEPTION 'run_lease_lost'; END IF;
  schedule_current := schedule.id IS NOT NULL AND schedule.active AND schedule.next_run_at=run.occurrence_at;
  IF NOT COALESCE(schedule_current,false) THEN p_success:=false; END IF;
  IF p_success AND (run.recommendation IS NULL OR run.weather IS NULL) THEN RAISE EXCEPTION 'output_not_persisted'; END IF;
  IF p_success AND run.usage_receipt IS NULL AND NOT profile.is_dev AND run.legacy_plan IS DISTINCT FROM (CASE WHEN profile.is_pro THEN 'pro' ELSE 'free' END) THEN p_success:=false; END IF;
  SELECT * INTO controls FROM public.user_access_controls WHERE user_id=run.user_id FOR UPDATE;
  IF profile.pending_deletion OR controls.banned_at IS NOT NULL OR controls.app_blocked AND
    (controls.app_blocked_until IS NULL OR controls.app_blocked_until>clock_timestamp()) THEN p_success:=false; END IF;
  SELECT enabled INTO STRICT mode FROM public.v6_entitlement_rollout WHERE singleton;
  IF p_success AND run.usage_receipt IS NOT NULL AND public.v6_effective_plan(run.user_id)<>run.legacy_plan AND NOT profile.is_dev THEN p_success:=false; END IF;
  charge := p_success AND COALESCE((run.recommendation->>'chargeable')::boolean,true);
  IF run.usage_receipt IS NOT NULL THEN
    IF NOT mode THEN RAISE EXCEPTION 'accounting_mode_changed'; END IF;
    receipt:=public.v6_settle_usage(run.user_id,run.occurrence_id,charge,CASE WHEN charge THEN NULL ELSE 0 END);
    IF charge AND receipt->>'status'<>'committed' THEN p_success:=false; END IF;
  ELSE
    IF mode AND p_success THEN RAISE EXCEPTION 'accounting_mode_changed'; END IF;
    IF charge AND NOT profile.is_dev THEN
      IF run.legacy_plan='pro' THEN
        IF NOT profile.is_pro THEN p_success:=false;
        ELSE
          UPDATE public.credits SET current_balance=CASE WHEN last_reset_date=(clock_timestamp() AT TIME ZONE 'UTC')::date THEN current_balance-1 ELSE 49 END,last_reset_date=(clock_timestamp() AT TIME ZONE 'UTC')::date
            WHERE user_id=run.user_id AND (last_reset_date<>(clock_timestamp() AT TIME ZONE 'UTC')::date OR current_balance>0);
          IF NOT FOUND THEN p_success:=false; END IF;
        END IF;
      ELSIF run.legacy_plan='free' THEN
        INSERT INTO public.daily_usage(user_id,usage_date) VALUES(run.user_id,(clock_timestamp() AT TIME ZONE 'UTC')::date) ON CONFLICT(user_id,usage_date) DO NOTHING;
        UPDATE public.daily_usage SET ai_uses=ai_uses+1 WHERE user_id=run.user_id AND usage_date=(clock_timestamp() AT TIME ZONE 'UTC')::date AND ai_uses<LEAST(20,COALESCE(controls.app_daily_ai_limit,20));
        IF NOT FOUND THEN p_success:=false; END IF;
      ELSE p_success:=false; END IF;
    END IF;
  END IF;
  UPDATE public.automated_recommendation_runs SET status=CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    error=CASE WHEN p_success THEN NULL ELSE COALESCE(p_error,'Automatic recommendation could not be completed. No result was delivered.') END,
    completed_at=clock_timestamp(),delivery_pending=true,lease_token=NULL,lease_ends_at=NULL WHERE id=run.id RETURNING * INTO run;
  UPDATE public.automated_recommendation_schedules SET active=recurrence<>'once',next_run_at=p_next_run,locked_at=NULL,
    last_run_at=CASE WHEN p_success THEN clock_timestamp() ELSE last_run_at END,updated_at=clock_timestamp()
    WHERE id=run.schedule_id AND schedule_current;
  RETURN jsonb_build_object('status',run.status);
END; $$;

CREATE OR REPLACE FUNCTION public.v63_deliver_auto_run(p_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE run public.automated_recommendation_runs%ROWTYPE;
BEGIN
  SELECT * INTO STRICT run FROM public.automated_recommendation_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT run.delivery_pending OR run.status='running' THEN RETURN; END IF;
  INSERT INTO public.user_inbox(user_id,category,title,body,metadata,automatic_occurrence_id)
    VALUES(run.user_id,CASE WHEN run.status='completed' THEN 'recommendation' ELSE 'error' END,
      CASE WHEN run.status='completed' THEN 'Automatic recommendation ready' ELSE 'Automatic recommendation failed' END,
      CASE WHEN run.status='completed' THEN run.recommendation->>'outfit' ELSE run.error END,
      CASE WHEN run.status='completed' THEN jsonb_build_object('scheduleId',run.schedule_id,'runId',run.id,'weather',run.weather,'recommendation',run.recommendation) ELSE jsonb_build_object('scheduleId',run.schedule_id,'runId',run.id) END,run.occurrence_id)
    ON CONFLICT(automatic_occurrence_id) DO NOTHING;
  UPDATE public.automated_recommendation_runs SET delivery_pending=false WHERE id=run.id;
END; $$;
REVOKE ALL ON FUNCTION public.v63_begin_auto_run(uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.v63_stage_auto_result(uuid,uuid,jsonb,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.v63_finish_auto_run(uuid,uuid,timestamptz,boolean,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.v63_deliver_auto_run(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v63_begin_auto_run(uuid,uuid,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.v63_stage_auto_result(uuid,uuid,jsonb,jsonb,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.v63_finish_auto_run(uuid,uuid,timestamptz,boolean,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.v63_deliver_auto_run(uuid) TO service_role;
COMMIT;
