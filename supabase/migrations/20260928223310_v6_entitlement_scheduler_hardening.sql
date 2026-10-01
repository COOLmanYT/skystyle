BEGIN;
REVOKE EXECUTE ON FUNCTION
  public.claim_due_automated_recommendation_schedules(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.claim_due_automated_recommendation_schedules(integer)
  TO service_role;
CREATE INDEX v6_account_entitlements_plan_idx
  ON public.v6_account_entitlements(plan);
CREATE INDEX v6_pro_periods_configured_by_idx
  ON public.v6_pro_periods(configured_by);
COMMIT;
