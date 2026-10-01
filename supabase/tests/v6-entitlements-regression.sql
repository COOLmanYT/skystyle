-- Rollback-only verification. Never use real users or leave rollout enabled.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $test$
DECLARE
    u uuid := gen_random_uuid();
    admin_id uuid := gen_random_uuid();
    legacy_id uuid := gen_random_uuid();
    pro_id uuid := gen_random_uuid();
    k uuid := gen_random_uuid();
    req uuid;
    period_id uuid := gen_random_uuid();
    old_key uuid := gen_random_uuid();
    r jsonb;
    n bigint;
    i integer;
    at_start timestamptz := date_trunc('month', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    at_end timestamptz;
    utc_today date := (clock_timestamp() AT TIME ZONE 'UTC')::date;
    fingerprint text := repeat('a',64);
    sample_hash text := repeat('a',32) || ':' || repeat('b',128);
BEGIN
    ASSERT NOT (SELECT enabled OR checkout_enabled FROM public.v6_entitlement_rollout), 'rollout must be inactive before test';
    INSERT INTO public.users(id,name,is_dev,is_pro) VALUES
        (u,'v6-rollback-fixture',false,false),
        (admin_id,'v6-rollback-fixture',true,false),
        (legacy_id,'v6-rollback-fixture',false,false),
        (pro_id,'v6-rollback-fixture',false,true);
    BEGIN
        PERFORM public.v6_initialize_account(u);
        RAISE EXCEPTION 'inactive initialization was accepted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'v6_not_active' THEN RAISE; END IF;
    END;
    -- Only this uncommitted test transaction sees the enabled flag.
    UPDATE public.v6_entitlement_rollout SET enabled=true WHERE singleton;
    SET LOCAL ROLE service_role;
    PERFORM public.v6_initialize_account(u);
    PERFORM public.v6_initialize_account(u);
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=u)=10, 'signup must be once-only';
    ASSERT (SELECT count(*) FROM public.v6_credit_lots WHERE user_id=u)=1, 'duplicate signup lot';

    PERFORM public.v6_create_api_key(u,k,sample_hash,'sk_live_test');
    ASSERT (SELECT credits_remaining FROM public.api_keys WHERE id=k)=0, 'column default must not become a new grant';
    FOR i IN 1..2 LOOP
        PERFORM public.v6_create_api_key(u,gen_random_uuid(),sample_hash,'sk_live_test');
    END LOOP;
    BEGIN
        PERFORM public.v6_create_api_key(u,gen_random_uuid(),sample_hash,'sk_live_test');
        RAISE EXCEPTION 'fourth Free API key was accepted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'api_key_plan_limit' THEN RAISE; END IF;
    END;
    UPDATE public.api_keys SET revoked=true WHERE id=k;
    k := gen_random_uuid();
    PERFORM public.v6_create_api_key(u,k,sample_hash,'sk_live_test');
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=u)=10, 'key recreation must not grant credits';

    req := gen_random_uuid();
    r := public.v6_reserve_usage(u,req,fingerprint,'recommendation');
    ASSERT r->>'created'='true' AND r->>'billingMode'='included' AND r->>'reservedCredits'='0', 'included reservation';
    ASSERT (SELECT ai_uses FROM public.daily_usage WHERE user_id=u AND usage_date=utc_today)=1, 'quota reservation';
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=u)=10, 'included must not double-charge';
    r := public.v6_reserve_usage(u,req,fingerprint,'recommendation');
    ASSERT r->>'created'='false', 'retry must be inert';
    BEGIN
        PERFORM public.v6_reserve_usage(u,req,repeat('b',64),'recommendation');
        RAISE EXCEPTION 'conflicting request was accepted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'idempotency_conflict' THEN RAISE; END IF;
    END;
    r := public.v6_settle_usage(u,req,false);
    ASSERT r->>'status'='released', 'failure release';
    PERFORM public.v6_settle_usage(u,req,false);
    ASSERT (SELECT ai_uses FROM public.daily_usage WHERE user_id=u AND usage_date=utc_today)=0, 'refund exactly once';
    FOR i IN 1..5 LOOP
        req := gen_random_uuid();
        PERFORM public.v6_reserve_usage(u,req,fingerprint,'recommendation');
        PERFORM public.v6_settle_usage(u,req,true);
    END LOOP;
    BEGIN
        PERFORM public.v6_reserve_usage(u,gen_random_uuid(),fingerprint,'recommendation');
        RAISE EXCEPTION 'sixth daily recommendation was accepted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'daily_usage_limit' THEN RAISE; END IF;
    END;
    -- Credit spending is explicit and does not alter included counters.
    req := gen_random_uuid();
    PERFORM public.v6_reserve_usage(u,req,fingerprint,'recommendation',true);
    PERFORM public.v6_settle_usage(u,req,true);
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=u)=8, 'metered recommendation costs two';
    ASSERT (SELECT ai_uses FROM public.daily_usage WHERE user_id=u AND usage_date=utc_today)=5, 'metered must not increment included quota';
    UPDATE public.daily_usage SET ai_uses=0 WHERE user_id=u AND usage_date=utc_today;
    -- Seed only synthetic historical usage, accounting must retain it.
    INSERT INTO public.daily_usage(user_id,usage_date,ai_uses,follow_ups)
        VALUES(u,utc_today-1,60,120);
    IF date_trunc('month',utc_today::timestamp)=date_trunc('month',(utc_today-1)::timestamp) THEN
        BEGIN
            PERFORM public.v6_reserve_usage(u,gen_random_uuid(),fingerprint,'recommendation');
            RAISE EXCEPTION '61st monthly recommendation was accepted';
        EXCEPTION WHEN raise_exception THEN
            IF SQLERRM <> 'monthly_usage_limit' THEN RAISE; END IF;
        END;
        BEGIN
            PERFORM public.v6_reserve_usage(u,gen_random_uuid(),fingerprint,'followup');
            RAISE EXCEPTION '121st monthly followup was accepted';
        EXCEPTION WHEN raise_exception THEN
            IF SQLERRM <> 'monthly_usage_limit' THEN RAISE; END IF;
        END;
    END IF;
    UPDATE public.daily_usage SET ai_uses=0,follow_ups=0 WHERE user_id=u;
    FOR i IN 1..10 LOOP
        req := gen_random_uuid();
        PERFORM public.v6_reserve_usage(u,req,fingerprint,'followup');
        PERFORM public.v6_settle_usage(u,req,true);
    END LOOP;
    BEGIN
        PERFORM public.v6_reserve_usage(u,gen_random_uuid(),fingerprint,'followup');
        RAISE EXCEPTION '11th daily followup was accepted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'daily_usage_limit' THEN RAISE; END IF;
    END;
    req := gen_random_uuid();
    PERFORM public.v6_reserve_usage(u,req,fingerprint,'followup',true);
    PERFORM public.v6_settle_usage(u,req,true);
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=u)=7, 'metered followup costs one';

    req := gen_random_uuid();
    PERFORM public.v6_reserve_usage(u,req,fingerprint,'api_recweather',false,k);
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=u)=4, 'API reservation must hold three';
    r := public.v6_settle_usage(u,req,true,2);
    ASSERT r->>'credits'='2', 'partial API charge';
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=u)=5, 'partial charge refunds one';
    PERFORM public.v6_settle_usage(u,req,true,2);
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=u)=5, 'duplicate settlement must be inert';
    req := gen_random_uuid();
    PERFORM public.v6_reserve_usage(u,req,fingerprint,'api_weather',false,k);
    UPDATE public.api_keys SET revoked=true WHERE id=k;
    r := public.v6_settle_usage(u,req,true);
    ASSERT r->>'status'='released', 'revoked key cannot settle success';
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=u)=5, 'revoked key must refund original source';

    req := gen_random_uuid();
    PERFORM public.v6_reserve_usage(u,req,fingerprint,'recommendation',false,null,true);
    UPDATE public.v6_usage_reservations SET lease_ends_at=clock_timestamp()-interval '1 second' WHERE user_id=u AND request_id=req;
    ASSERT public.v6_release_expired_usage(u)=1, 'lease cleanup';
    ASSERT (SELECT ai_uses FROM public.daily_usage WHERE user_id=u AND usage_date=utc_today)=0, 'lease quota refund';
    ASSERT (SELECT model_switches FROM public.daily_usage WHERE user_id=u AND usage_date=utc_today)=0, 'lease switch refund';

    -- Legacy balances are preserved and imported once without a second signup grant.
    INSERT INTO public.api_keys(id,user_id,key_hash,key_preview,credits_remaining,revoked)
        VALUES(old_key,legacy_id,sample_hash,'sk_live_test',12,true);
    INSERT INTO public.credits(user_id,current_balance) VALUES(legacy_id,20);
    PERFORM public.v6_initialize_account(legacy_id);
    PERFORM public.v6_initialize_account(legacy_id);
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=legacy_id AND NOT archived)=20, 'spendable legacy balance';
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=legacy_id AND archived)=12, 'revoked legacy credits must remain archived';
    ASSERT NOT EXISTS(SELECT 1 FROM public.v6_credit_lots WHERE user_id=legacy_id AND kind='signup'), 'legacy grants fulfil signup';
    ASSERT (SELECT current_balance FROM public.credits WHERE user_id=legacy_id)=20 AND
        (SELECT credits_remaining FROM public.api_keys WHERE id=old_key)=12, 'old balances must be unchanged';

    PERFORM public.v6_initialize_account(pro_id);
    BEGIN
        PERFORM public.v6_reserve_usage(pro_id,gen_random_uuid(),fingerprint,'recommendation');
        RAISE EXCEPTION 'undated legacy Pro was accepted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'pro_period_required' THEN RAISE; END IF;
    END;
    at_end := ((at_start AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC';
    BEGIN
        PERFORM public.v6_set_pro_period(u,pro_id,period_id,at_start,at_end);
        RAISE EXCEPTION 'non-admin period mutation was accepted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'admin_required' THEN RAISE; END IF;
    END;
    r := public.v6_set_pro_period(admin_id,pro_id,period_id,at_start,at_end);
    ASSERT r->>'created'='true', 'dated period created';
    r := public.v6_set_pro_period(admin_id,pro_id,period_id,at_start,at_end);
    ASSERT r->>'created'='false', 'duplicate period must be inert';
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=pro_id)=50, 'one renewal grant';
    ASSERT public.v6_effective_plan(pro_id,at_end-interval '1 microsecond')='pro', 'period end exclusive';
    ASSERT public.v6_effective_plan(pro_id,at_end)='free', 'period boundary fallback';
    BEGIN
        PERFORM public.v6_set_pro_period(admin_id,pro_id,gen_random_uuid(),at_start+interval '1 day',at_end+interval '1 day');
        RAISE EXCEPTION 'overlapping period was accepted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'period_overlap' THEN RAISE; END IF;
    END;
    INSERT INTO public.v6_credit_lots(user_id,kind,source_ref,initial_amount,remaining)
        VALUES(pro_id,'purchased','rollback-only-purchase',10,10);
    req := gen_random_uuid();
    PERFORM public.v6_reserve_usage(pro_id,req,fingerprint,'recommendation',true);
    ASSERT (SELECT remaining FROM public.v6_credit_lots WHERE user_id=pro_id AND kind='pro_grant')=48, 'expiring grants first';
    ASSERT (SELECT remaining FROM public.v6_credit_lots WHERE user_id=pro_id AND kind='purchased')=10, 'purchased carry-over untouched';
    PERFORM public.v6_cancel_pro_period(admin_id,pro_id,period_id);
    PERFORM public.v6_settle_usage(pro_id,req,false);
    ASSERT (SELECT remaining FROM public.v6_credit_lots WHERE user_id=pro_id AND kind='pro_grant')=50, 'refund to original grant';
    ASSERT (SELECT archived FROM public.v6_credit_lots WHERE user_id=pro_id AND kind='pro_grant'), 'cancelled refund stays archived';
    ASSERT (SELECT sum(remaining) FROM public.v6_credit_lots WHERE user_id=pro_id AND NOT archived)=10, 'refund cannot resurrect cancelled credit';
    ASSERT public.v6_effective_plan(pro_id)='free', 'cancelled Pro falls back';

    -- Dev skip missing Pro periods and all usage/credit limits.
    PERFORM public.v6_initialize_account(admin_id);
    UPDATE public.v6_account_entitlements SET plan='pro' WHERE user_id=admin_id;
    req := gen_random_uuid();
    r := public.v6_reserve_usage(admin_id,req,fingerprint,'recommendation');
    ASSERT r->>'billingMode'='dev', 'Dev unlimited path';
    PERFORM public.v6_settle_usage(admin_id,req,true);
    -- Deleting a synthetic account cascades all owned new records.
    RESET ROLE;
    DELETE FROM public.users WHERE id=u;
    ASSERT NOT EXISTS(SELECT 1 FROM public.v6_usage_reservations WHERE user_id=u), 'account deletion reservation cascade';
    ASSERT NOT EXISTS(SELECT 1 FROM public.v6_credit_lots WHERE user_id=u), 'account deletion credit cascade';
    ASSERT NOT EXISTS(SELECT 1 FROM public.v6_credit_allocations WHERE user_id=u), 'account deletion allocation cascade';
END;
$test$;
ROLLBACK;
SELECT enabled,checkout_enabled,
    (SELECT count(*) FROM public.users WHERE name='v6-rollback-fixture') AS leftover_fixture_accounts
FROM public.v6_entitlement_rollout;
