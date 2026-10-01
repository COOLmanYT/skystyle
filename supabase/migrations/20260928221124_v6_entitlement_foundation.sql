-- Sky Style V6 entitlement foundation: EXACT REVIEW DRAFT, NOT APPLIED.
-- This file is outside the repository and automatic migration directories.
-- Approval of plan numbers/admin periods is NOT approval to execute this SQL.
-- PostgreSQL 17; no extension, payment provider, cron, trigger, or old-row reset.
-- All RPCs are SECURITY INVOKER, service-role only, with an empty search_path.
-- The new enforcement switch stays FALSE. No existing billing path is changed.
-- Enable only after all old writers are replaced/drained and release checks pass.
-- That activation statement is deliberately NOT part of this foundation draft.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.v6_plan_rules (
    plan text PRIMARY KEY CHECK (plan IN ('free', 'pro', 'payg')),
    monthly_price_aud_cents integer CHECK (monthly_price_aud_cents >= 0),
    minimum_top_up_aud_cents integer CHECK (minimum_top_up_aud_cents >= 0),
    credits_per_aud integer NOT NULL CHECK (credits_per_aud = 50),
    recommendations_daily integer CHECK (recommendations_daily > 0),
    recommendations_monthly integer CHECK (recommendations_monthly > 0),
    followups_daily integer CHECK (followups_daily > 0),
    followups_monthly integer CHECK (followups_monthly > 0),
    api_key_limit integer NOT NULL CHECK (api_key_limit > 0),
    signup_credits integer NOT NULL CHECK (signup_credits >= 0),
    renewal_credits integer NOT NULL CHECK (renewal_credits >= 0),
    recommendation_credit_cost integer NOT NULL CHECK (recommendation_credit_cost = 2),
    followup_credit_cost integer NOT NULL CHECK (followup_credit_cost = 1)
);
INSERT INTO public.v6_plan_rules VALUES
    ('free', 0, NULL, 50, 5, 60, 10, 120, 3, 10, 0, 2, 1),
    ('pro', 699, NULL, 50, 25, 250, 50, 500, 20, 0, 50, 2, 1),
    ('payg', NULL, 500, 50, NULL, NULL, NULL, NULL, 20, 0, 0, 2, 1);

CREATE TABLE public.v6_entitlement_rollout (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    enabled boolean NOT NULL DEFAULT false,
    checkout_enabled boolean NOT NULL DEFAULT false CHECK (NOT checkout_enabled),
    installed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.v6_entitlement_rollout (singleton) VALUES (true);

CREATE TABLE public.v6_account_entitlements (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    plan text NOT NULL DEFAULT 'free' REFERENCES public.v6_plan_rules(plan),
    initialized_at timestamptz,
    signup_grant_claimed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.v6_pro_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.v6_account_entitlements(user_id) ON DELETE CASCADE,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    configured_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    cancelled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, starts_at),
    UNIQUE (user_id, id),
    CHECK (ends_at > starts_at),
    -- One explicit calendar-month period; month-end clipping is intentional.
    CHECK (ends_at = (((starts_at AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'))
);

CREATE TABLE public.v6_credit_lots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.v6_account_entitlements(user_id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('signup', 'pro_grant', 'purchased', 'legacy_api', 'legacy_app')),
    source_ref text NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 200),
    pro_period_id uuid,
    initial_amount bigint NOT NULL CHECK (initial_amount >= 0),
    remaining bigint NOT NULL CHECK (remaining >= 0 AND remaining <= initial_amount),
    available_from timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    archived boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, source_ref),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, pro_period_id) REFERENCES public.v6_pro_periods(user_id, id) ON DELETE CASCADE,
    CHECK (
        (kind = 'pro_grant' AND pro_period_id IS NOT NULL AND expires_at IS NOT NULL AND expires_at > available_from)
        OR (kind <> 'pro_grant' AND pro_period_id IS NULL AND expires_at IS NULL)
    )
);
CREATE INDEX v6_credit_lots_spend_idx
    ON public.v6_credit_lots (user_id, expires_at, available_from, id)
    WHERE remaining > 0 AND NOT archived;
CREATE INDEX v6_credit_lots_period_idx ON public.v6_credit_lots (user_id, pro_period_id);

CREATE TABLE public.v6_usage_reservations (
    user_id uuid NOT NULL REFERENCES public.v6_account_entitlements(user_id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
    -- Style, Shop and automatic generation all use 'recommendation'.
    -- Do not record product links, search terms, feedback, or provider keys here.
    purpose text NOT NULL CHECK (purpose IN (
        'recommendation', 'followup', 'api_recommend', 'api_recweather', 'api_weather', 'api_closet'
    )),
    billing_mode text NOT NULL CHECK (billing_mode IN ('included', 'metered', 'dev')),
    plan_snapshot text NOT NULL CHECK (plan_snapshot IN ('free', 'pro', 'payg', 'dev')),
    usage_date date NOT NULL,
    quota_field text CHECK (quota_field IN ('ai_uses', 'follow_ups')),
    model_switch_charged boolean NOT NULL DEFAULT false,
    api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
    reserved_credits integer NOT NULL CHECK (reserved_credits BETWEEN 0 AND 3),
    final_credits integer CHECK (final_credits BETWEEN 0 AND reserved_credits),
    status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'released')),
    created_at timestamptz NOT NULL DEFAULT now(),
    lease_ends_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
    settled_at timestamptz,
    PRIMARY KEY (user_id, request_id),
    CHECK ((status = 'reserved' AND settled_at IS NULL AND final_credits IS NULL)
        OR (status <> 'reserved' AND settled_at IS NOT NULL AND final_credits IS NOT NULL)),
    CHECK (status <> 'released' OR final_credits = 0),
    CHECK ((billing_mode = 'included' AND quota_field IS NOT NULL AND reserved_credits = 0)
        OR (billing_mode <> 'included' AND quota_field IS NULL))
);
CREATE INDEX v6_usage_reservations_pending_idx
    ON public.v6_usage_reservations (user_id, lease_ends_at) WHERE status = 'reserved';
CREATE INDEX v6_usage_reservations_key_idx ON public.v6_usage_reservations (api_key_id);

CREATE TABLE public.v6_credit_allocations (
    user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    lot_id uuid NOT NULL,
    allocation_order integer NOT NULL CHECK (allocation_order > 0),
    reserved_amount integer NOT NULL CHECK (reserved_amount > 0),
    charged_amount integer CHECK (charged_amount BETWEEN 0 AND reserved_amount),
    PRIMARY KEY (user_id, request_id, lot_id),
    UNIQUE (user_id, request_id, allocation_order),
    FOREIGN KEY (user_id, request_id) REFERENCES public.v6_usage_reservations(user_id, request_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, lot_id) REFERENCES public.v6_credit_lots(user_id, id) ON DELETE CASCADE
);
CREATE INDEX v6_credit_allocations_lot_idx ON public.v6_credit_allocations (user_id, lot_id);

-- NextAuth identities are NOT Supabase auth.uid(). Browser roles get no access.
ALTER TABLE public.v6_plan_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v6_entitlement_rollout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v6_account_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v6_pro_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v6_credit_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v6_usage_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v6_credit_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.v6_plan_rules, public.v6_entitlement_rollout,
    public.v6_account_entitlements, public.v6_pro_periods, public.v6_credit_lots,
    public.v6_usage_reservations, public.v6_credit_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v6_plan_rules, public.v6_entitlement_rollout FROM service_role;
REVOKE ALL ON public.v6_account_entitlements, public.v6_pro_periods,
    public.v6_credit_lots, public.v6_usage_reservations, public.v6_credit_allocations FROM service_role;
GRANT SELECT ON public.v6_plan_rules, public.v6_entitlement_rollout TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v6_account_entitlements,
    public.v6_pro_periods, public.v6_credit_lots, public.v6_usage_reservations,
    public.v6_credit_allocations TO service_role;

-- Server-authenticated lifecycle call, after the coordinated application cutover.
-- Snapshot each old credit source ONCE. Old rows are not deleted or zeroed.
-- Revoked-key credits are preserved but archived, never resurrected as spendable.
-- Existing grant evidence fulfils the one-time grant: key recreation adds nothing.
CREATE FUNCTION public.v6_initialize_account(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_profile public.users%ROWTYPE;
    v_account public.v6_account_entitlements%ROWTYPE;
    v_old record;
    v_had_grant boolean := false;
    v_signup integer;
BEGIN
    IF NOT COALESCE((SELECT enabled FROM public.v6_entitlement_rollout WHERE singleton), false) THEN
        RAISE EXCEPTION 'v6_not_active';
    END IF;
    SELECT * INTO v_profile FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND OR v_profile.pending_deletion THEN RAISE EXCEPTION 'account_unavailable'; END IF;
    INSERT INTO public.v6_account_entitlements (user_id, plan)
    VALUES (p_user_id, CASE WHEN v_profile.is_pro THEN 'pro' ELSE 'free' END)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_account FROM public.v6_account_entitlements WHERE user_id = p_user_id FOR UPDATE;
    IF v_account.initialized_at IS NOT NULL THEN RETURN; END IF;

    FOR v_old IN SELECT id, credits_remaining, revoked FROM public.api_keys
        WHERE user_id = p_user_id ORDER BY id FOR UPDATE
    LOOP
        v_had_grant := true;
        IF v_old.credits_remaining < 0 THEN RAISE EXCEPTION 'invalid_legacy_credit_balance'; END IF;
        IF v_old.credits_remaining > 0 THEN
            INSERT INTO public.v6_credit_lots (user_id, kind, source_ref, initial_amount, remaining, archived)
            VALUES (p_user_id, 'legacy_api', 'legacy_api:' || v_old.id::text,
                v_old.credits_remaining, v_old.credits_remaining, v_old.revoked)
            ON CONFLICT (user_id, source_ref) DO NOTHING;
        END IF;
    END LOOP;
    FOR v_old IN SELECT id, current_balance FROM public.credits
        WHERE user_id = p_user_id ORDER BY id FOR UPDATE
    LOOP
        v_had_grant := true;
        IF v_old.current_balance < 0 THEN RAISE EXCEPTION 'invalid_legacy_credit_balance'; END IF;
        IF v_old.current_balance > 0 THEN
            INSERT INTO public.v6_credit_lots (user_id, kind, source_ref, initial_amount, remaining)
            VALUES (p_user_id, 'legacy_app', 'legacy_app:' || v_old.id::text,
                v_old.current_balance, v_old.current_balance)
            ON CONFLICT (user_id, source_ref) DO NOTHING;
        END IF;
    END LOOP;
    IF v_account.plan = 'free' AND NOT v_account.signup_grant_claimed AND NOT v_had_grant THEN
        SELECT signup_credits INTO v_signup FROM public.v6_plan_rules WHERE plan = 'free';
        INSERT INTO public.v6_credit_lots (user_id, kind, source_ref, initial_amount, remaining)
        VALUES (p_user_id, 'signup', 'signup', v_signup, v_signup)
        ON CONFLICT (user_id, source_ref) DO NOTHING;
    END IF;
    UPDATE public.v6_account_entitlements
        SET initialized_at = clock_timestamp(), signup_grant_claimed = true WHERE user_id = p_user_id;
END;
$$;

-- A server-verified, whitelisted admin provides dates. No guessed initial date,
-- rolling daily allowance, automatic renewal, money grant, or payment collection.
-- This RPC may stage dated periods while rollout.enabled remains false.
CREATE FUNCTION public.v6_set_pro_period(
    p_actor_id uuid, p_user_id uuid, p_period_id uuid,
    p_starts_at timestamptz, p_ends_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_existing public.v6_pro_periods%ROWTYPE;
    v_grant integer;
BEGIN
    -- Stable lock order also covers an admin managing another admin's account.
    PERFORM 1 FROM public.users WHERE id IN (p_actor_id, p_user_id) ORDER BY id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_dev AND NOT pending_deletion) THEN
        RAISE EXCEPTION 'admin_required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND NOT pending_deletion) THEN
        RAISE EXCEPTION 'account_unavailable';
    END IF;
    IF p_period_id IS NULL OR p_starts_at IS NULL OR p_ends_at IS NULL
        OR p_ends_at <= clock_timestamp()
        OR p_ends_at <> (((p_starts_at AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC') THEN
        RAISE EXCEPTION 'invalid_monthly_period';
    END IF;
    INSERT INTO public.v6_account_entitlements (user_id, plan) VALUES (p_user_id, 'pro')
        ON CONFLICT (user_id) DO NOTHING;
    PERFORM 1 FROM public.v6_account_entitlements WHERE user_id = p_user_id FOR UPDATE;
    SELECT * INTO v_existing FROM public.v6_pro_periods WHERE id = p_period_id;
    IF FOUND THEN
        IF v_existing.user_id <> p_user_id OR v_existing.starts_at <> p_starts_at
            OR v_existing.ends_at <> p_ends_at OR v_existing.cancelled_at IS NOT NULL THEN
            RAISE EXCEPTION 'period_idempotency_conflict';
        END IF;
        RETURN jsonb_build_object('periodId', v_existing.id, 'created', false);
    END IF;
    IF EXISTS (SELECT 1 FROM public.v6_pro_periods WHERE user_id = p_user_id
        AND starts_at < p_ends_at AND ends_at > p_starts_at AND cancelled_at IS NULL) THEN
        RAISE EXCEPTION 'period_overlap';
    END IF;
    INSERT INTO public.v6_pro_periods (id, user_id, starts_at, ends_at, configured_by)
        VALUES (p_period_id, p_user_id, p_starts_at, p_ends_at, p_actor_id);
    SELECT renewal_credits INTO v_grant FROM public.v6_plan_rules WHERE plan = 'pro';
    INSERT INTO public.v6_credit_lots (user_id, kind, source_ref, pro_period_id,
        initial_amount, remaining, available_from, expires_at)
        VALUES (p_user_id, 'pro_grant', 'pro:' || p_period_id::text, p_period_id,
            v_grant, v_grant, p_starts_at, p_ends_at)
        ON CONFLICT (user_id, source_ref) DO NOTHING;
    UPDATE public.v6_account_entitlements SET plan = 'pro' WHERE user_id = p_user_id;
    RETURN jsonb_build_object('periodId', p_period_id, 'created', true);
END;
$$;

CREATE FUNCTION public.v6_cancel_pro_period(p_actor_id uuid, p_user_id uuid, p_period_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    PERFORM 1 FROM public.users WHERE id IN (p_actor_id, p_user_id) ORDER BY id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_dev AND NOT pending_deletion) THEN
        RAISE EXCEPTION 'admin_required';
    END IF;
    PERFORM 1 FROM public.v6_account_entitlements WHERE user_id = p_user_id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.v6_pro_periods WHERE id = p_period_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'period_not_found';
    END IF;
    UPDATE public.v6_pro_periods SET cancelled_at = COALESCE(cancelled_at, clock_timestamp())
        WHERE id = p_period_id AND user_id = p_user_id;
    UPDATE public.v6_credit_lots SET archived = true
        WHERE user_id = p_user_id AND pro_period_id = p_period_id;
END;
$$;

-- Missing dates on legacy Pro => fail closed, never invent a period.
-- A known period that ended/cancelled => Free until an admin renews it.
CREATE FUNCTION public.v6_effective_plan(p_user_id uuid, p_at timestamptz DEFAULT clock_timestamp())
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_plan text;
BEGIN
    IF p_at IS NULL THEN RAISE EXCEPTION 'time_required'; END IF;
    SELECT plan INTO v_plan FROM public.v6_account_entitlements WHERE user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'account_not_initialized'; END IF;
    IF v_plan = 'pro' AND NOT EXISTS (SELECT 1 FROM public.v6_pro_periods
        WHERE user_id = p_user_id AND cancelled_at IS NULL
        AND starts_at <= p_at AND ends_at > p_at) THEN
        IF NOT EXISTS (SELECT 1 FROM public.v6_pro_periods WHERE user_id = p_user_id) THEN
            RAISE EXCEPTION 'pro_period_required';
        END IF;
        v_plan := 'free';
    END IF;
    RETURN v_plan;
END;
$$;

-- Finalize before returning provider output to the client. A released/expired
-- receipt must NOT be served as a successful output. Duplicate finalize is inert.
CREATE FUNCTION public.v6_settle_usage(
    p_user_id uuid, p_request_id uuid, p_success boolean, p_credit_charge integer DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_receipt public.v6_usage_reservations%ROWTYPE;
    v_allocation record;
    v_charge integer;
    v_left integer;
    v_take integer;
    v_count integer;
BEGIN
    IF p_success IS NULL THEN RAISE EXCEPTION 'success_required'; END IF;
    PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'account_unavailable'; END IF;
    PERFORM 1 FROM public.v6_account_entitlements WHERE user_id = p_user_id FOR UPDATE;
    SELECT * INTO v_receipt FROM public.v6_usage_reservations
        WHERE user_id = p_user_id AND request_id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'reservation_not_found'; END IF;
    IF v_receipt.status <> 'reserved' THEN
        RETURN jsonb_build_object('requestId', p_request_id, 'status', v_receipt.status, 'credits', v_receipt.final_credits);
    END IF;
    IF clock_timestamp() >= v_receipt.lease_ends_at THEN p_success := false; END IF;
    IF v_receipt.purpose LIKE 'api_%' AND v_receipt.api_key_id IS NULL THEN p_success := false; END IF;
    IF v_receipt.api_key_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.api_keys
        WHERE id = v_receipt.api_key_id AND user_id = p_user_id AND NOT revoked) THEN
        p_success := false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND pending_deletion) THEN p_success := false; END IF;
    v_charge := CASE WHEN p_success THEN COALESCE(p_credit_charge, v_receipt.reserved_credits) ELSE 0 END;
    IF v_charge < 0 OR v_charge > v_receipt.reserved_credits THEN RAISE EXCEPTION 'invalid_final_credit_charge'; END IF;
    v_left := v_charge;
    FOR v_allocation IN SELECT * FROM public.v6_credit_allocations
        WHERE user_id = p_user_id AND request_id = p_request_id ORDER BY allocation_order FOR UPDATE
    LOOP
        v_take := LEAST(v_left, v_allocation.reserved_amount);
        -- Refund to the ORIGINAL source. Expired Pro grants stay expired;
        -- refunds never turn grants into purchased or unexpiring credits.
        UPDATE public.v6_credit_lots
            SET remaining = remaining + v_allocation.reserved_amount - v_take
            WHERE user_id = p_user_id AND id = v_allocation.lot_id;
        UPDATE public.v6_credit_allocations SET charged_amount = v_take
            WHERE user_id = p_user_id AND request_id = p_request_id AND lot_id = v_allocation.lot_id;
        v_left := v_left - v_take;
    END LOOP;
    IF v_left <> 0 THEN RAISE EXCEPTION 'credit_allocation_invariant'; END IF;
    IF NOT p_success AND v_receipt.quota_field IS NOT NULL THEN
        IF v_receipt.quota_field = 'ai_uses' THEN
            UPDATE public.daily_usage SET ai_uses = ai_uses - 1
                WHERE user_id = p_user_id AND usage_date = v_receipt.usage_date AND ai_uses > 0;
        ELSE
            UPDATE public.daily_usage SET follow_ups = follow_ups - 1
                WHERE user_id = p_user_id AND usage_date = v_receipt.usage_date AND follow_ups > 0;
        END IF;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count <> 1 THEN RAISE EXCEPTION 'quota_refund_invariant'; END IF;
    END IF;
    IF NOT p_success AND v_receipt.model_switch_charged THEN
        UPDATE public.daily_usage SET model_switches = model_switches - 1
            WHERE user_id = p_user_id AND usage_date = v_receipt.usage_date AND model_switches > 0;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count <> 1 THEN RAISE EXCEPTION 'model_switch_refund_invariant'; END IF;
    END IF;
    UPDATE public.v6_usage_reservations
        SET status = CASE WHEN p_success THEN 'committed' ELSE 'released' END,
            final_credits = v_charge, settled_at = clock_timestamp()
        WHERE user_id = p_user_id AND request_id = p_request_id;
    RETURN jsonb_build_object('requestId', p_request_id,
        'status', CASE WHEN p_success THEN 'committed' ELSE 'released' END, 'credits', v_charge);
END;
$$;

CREATE FUNCTION public.v6_release_expired_usage(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid; v_count integer := 0;
BEGIN
    PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'account_unavailable'; END IF;
    PERFORM 1 FROM public.v6_account_entitlements WHERE user_id = p_user_id FOR UPDATE;
    FOR v_id IN SELECT request_id FROM public.v6_usage_reservations
        WHERE user_id = p_user_id AND status = 'reserved' AND lease_ends_at <= clock_timestamp()
        ORDER BY lease_ends_at, request_id LIMIT 100
    LOOP
        PERFORM public.v6_settle_usage(p_user_id, v_id, false, 0);
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

-- Included reservations increment quota only; metered reservations debit credits
-- only. Daily AND UTC-calendar-month caps are checked under one account lock.
-- Provider calls happen AFTER this transaction and OUTSIDE its locks.
CREATE FUNCTION public.v6_reserve_usage(
    p_user_id uuid, p_request_id uuid, p_fingerprint text, p_purpose text,
    p_use_credits boolean DEFAULT false, p_api_key_id uuid DEFAULT NULL,
    p_model_switch boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_profile public.users%ROWTYPE;
    v_rules public.v6_plan_rules%ROWTYPE;
    v_receipt public.v6_usage_reservations%ROWTYPE;
    v_usage public.daily_usage%ROWTYPE;
    v_lot record;
    v_plan text;
    v_mode text;
    v_field text;
    v_now timestamptz;
    v_date date;
    v_month date;
    v_daily bigint;
    v_monthly bigint;
    v_daily_limit integer;
    v_monthly_limit integer;
    v_override integer;
    v_cost integer;
    v_left integer;
    v_take integer;
    v_order integer := 0;
    v_is_api boolean;
    v_switch boolean;
BEGIN
    IF p_request_id IS NULL OR p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$'
        OR p_use_credits IS NULL OR p_model_switch IS NULL THEN RAISE EXCEPTION 'invalid_reservation'; END IF;
    IF p_purpose IS NULL OR p_purpose NOT IN ('recommendation', 'followup',
        'api_recommend', 'api_recweather', 'api_weather', 'api_closet') THEN
        RAISE EXCEPTION 'unsupported_usage_purpose';
    END IF;
    PERFORM public.v6_initialize_account(p_user_id);
    SELECT * INTO v_profile FROM public.users WHERE id = p_user_id FOR UPDATE;
    PERFORM 1 FROM public.v6_account_entitlements WHERE user_id = p_user_id FOR UPDATE;
    PERFORM public.v6_release_expired_usage(p_user_id);
    SELECT * INTO v_receipt FROM public.v6_usage_reservations
        WHERE user_id = p_user_id AND request_id = p_request_id;
    IF FOUND THEN
        IF v_receipt.fingerprint <> p_fingerprint OR v_receipt.purpose <> p_purpose
            OR v_receipt.api_key_id IS DISTINCT FROM p_api_key_id THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
        -- Never re-run a provider for an already reserved/settled request ID.
        RETURN jsonb_build_object('requestId', p_request_id, 'status', v_receipt.status, 'created', false);
    END IF;
    v_now := clock_timestamp();
    v_date := (v_now AT TIME ZONE 'UTC')::date;
    v_month := date_trunc('month', v_now AT TIME ZONE 'UTC')::date;
    v_plan := CASE WHEN v_profile.is_dev THEN 'free' ELSE public.v6_effective_plan(p_user_id, v_now) END;
    SELECT * INTO v_rules FROM public.v6_plan_rules WHERE plan = v_plan;
    v_is_api := p_purpose LIKE 'api_%';
    IF v_is_api <> (p_api_key_id IS NOT NULL) THEN RAISE EXCEPTION 'invalid_api_key_context'; END IF;
    IF v_is_api AND NOT EXISTS (SELECT 1 FROM public.api_keys
        WHERE id = p_api_key_id AND user_id = p_user_id AND NOT revoked) THEN RAISE EXCEPTION 'api_key_unavailable'; END IF;
    IF v_is_api AND NOT v_profile.is_dev AND p_api_key_id NOT IN (
        SELECT id FROM public.api_keys WHERE user_id = p_user_id AND NOT revoked
        ORDER BY created_at, id LIMIT v_rules.api_key_limit
    ) THEN RAISE EXCEPTION 'api_key_plan_limit'; END IF;
    IF NOT v_profile.is_dev AND EXISTS (SELECT 1 FROM public.user_access_controls WHERE user_id = p_user_id
        AND CASE WHEN v_is_api THEN api_blocked ELSE app_blocked END) THEN RAISE EXCEPTION 'access_blocked'; END IF;

    v_mode := CASE WHEN v_profile.is_dev THEN 'dev'
        WHEN v_is_api OR p_use_credits OR v_plan = 'payg' THEN 'metered' ELSE 'included' END;
    v_field := CASE WHEN v_mode <> 'included' THEN NULL
        WHEN p_purpose = 'recommendation' THEN 'ai_uses' ELSE 'follow_ups' END;
    v_cost := CASE WHEN v_mode <> 'metered' THEN 0
        WHEN p_purpose = 'recommendation' THEN v_rules.recommendation_credit_cost
        WHEN p_purpose = 'followup' THEN v_rules.followup_credit_cost
        -- Existing API prices are preserved, not newly inferred from the table.
        WHEN p_purpose = 'api_recommend' THEN 2 WHEN p_purpose = 'api_recweather' THEN 3 ELSE 1 END;
    v_switch := p_model_switch AND NOT v_profile.is_dev AND v_plan <> 'pro';
    IF v_switch OR v_field IS NOT NULL THEN
        INSERT INTO public.daily_usage (user_id, usage_date) VALUES (p_user_id, v_date)
            ON CONFLICT (user_id, usage_date) DO NOTHING;
        SELECT * INTO v_usage FROM public.daily_usage WHERE user_id = p_user_id AND usage_date = v_date;
        IF v_usage.model_switches < 0 THEN RAISE EXCEPTION 'invalid_quota_data'; END IF;
        IF v_switch AND v_usage.model_switches >= 2 THEN RAISE EXCEPTION 'daily_model_switch_limit'; END IF;
    END IF;
    IF v_field IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.daily_usage WHERE user_id = p_user_id
            AND usage_date >= v_month AND usage_date <= v_date AND (ai_uses < 0 OR follow_ups < 0)) THEN
            RAISE EXCEPTION 'invalid_quota_data';
        END IF;
        IF v_field = 'ai_uses' THEN
            v_daily := v_usage.ai_uses;
            SELECT COALESCE(sum(ai_uses), 0) INTO v_monthly FROM public.daily_usage
                WHERE user_id = p_user_id AND usage_date >= v_month AND usage_date <= v_date;
            v_daily_limit := v_rules.recommendations_daily; v_monthly_limit := v_rules.recommendations_monthly;
            SELECT app_daily_ai_limit INTO v_override FROM public.user_access_controls WHERE user_id = p_user_id;
            IF v_override IS NOT NULL THEN v_daily_limit := LEAST(v_daily_limit, v_override); END IF;
        ELSE
            v_daily := v_usage.follow_ups;
            SELECT COALESCE(sum(follow_ups), 0) INTO v_monthly FROM public.daily_usage
                WHERE user_id = p_user_id AND usage_date >= v_month AND usage_date <= v_date;
            v_daily_limit := v_rules.followups_daily; v_monthly_limit := v_rules.followups_monthly;
        END IF;
        IF v_daily >= v_daily_limit THEN RAISE EXCEPTION 'daily_usage_limit'; END IF;
        IF v_monthly >= v_monthly_limit THEN RAISE EXCEPTION 'monthly_usage_limit'; END IF;
    END IF;
    IF v_cost > COALESCE((SELECT sum(remaining) FROM public.v6_credit_lots
        WHERE user_id = p_user_id AND NOT archived AND available_from <= v_now
        AND (expires_at IS NULL OR expires_at > v_now)), 0) THEN RAISE EXCEPTION 'insufficient_credits'; END IF;
    INSERT INTO public.v6_usage_reservations (user_id, request_id, fingerprint, purpose,
        billing_mode, plan_snapshot, usage_date, quota_field, model_switch_charged, api_key_id,
        reserved_credits, created_at, lease_ends_at)
        VALUES (p_user_id, p_request_id, p_fingerprint, p_purpose, v_mode,
            CASE WHEN v_profile.is_dev THEN 'dev' ELSE v_plan END, v_date, v_field, v_switch,
            p_api_key_id, v_cost, v_now, v_now + interval '10 minutes');
    IF v_field = 'ai_uses' THEN
        UPDATE public.daily_usage SET ai_uses = ai_uses + 1 WHERE user_id = p_user_id AND usage_date = v_date;
    ELSIF v_field = 'follow_ups' THEN
        UPDATE public.daily_usage SET follow_ups = follow_ups + 1 WHERE user_id = p_user_id AND usage_date = v_date;
    END IF;
    IF v_switch THEN
        UPDATE public.daily_usage SET model_switches = model_switches + 1 WHERE user_id = p_user_id AND usage_date = v_date;
    END IF;
    v_left := v_cost;
    FOR v_lot IN SELECT id, remaining FROM public.v6_credit_lots
        WHERE user_id = p_user_id AND remaining > 0 AND NOT archived AND available_from <= v_now
            AND (expires_at IS NULL OR expires_at > v_now)
        ORDER BY expires_at ASC NULLS LAST, created_at, id FOR UPDATE
    LOOP
        EXIT WHEN v_left = 0;
        v_take := LEAST(v_left::bigint, v_lot.remaining)::integer;
        v_order := v_order + 1;
        UPDATE public.v6_credit_lots SET remaining = remaining - v_take WHERE user_id = p_user_id AND id = v_lot.id;
        INSERT INTO public.v6_credit_allocations (user_id, request_id, lot_id, allocation_order, reserved_amount)
            VALUES (p_user_id, p_request_id, v_lot.id, v_order, v_take);
        v_left := v_left - v_take;
    END LOOP;
    IF v_left <> 0 THEN RAISE EXCEPTION 'credit_reservation_invariant'; END IF;
    RETURN jsonb_build_object('requestId', p_request_id, 'status', 'reserved', 'created', true,
        'billingMode', v_mode, 'reservedCredits', v_cost, 'leaseEndsAt', v_now + interval '10 minutes');
END;
$$;

-- Zero per-key grants. Count/insert serialized with all other account mutations.
-- Raw keys are generated and displayed once by the authenticated server route;
-- the database receives only the existing salted scrypt format and safe preview.
CREATE FUNCTION public.v6_create_api_key(
    p_user_id uuid, p_key_id uuid, p_key_hash text, p_key_preview text,
    p_nickname text DEFAULT NULL, p_folder text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_limit integer; v_dev boolean; v_plan text; v_existing public.api_keys%ROWTYPE;
BEGIN
    IF p_key_id IS NULL OR p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{32}:[a-f0-9]{128}$'
        OR p_key_preview IS NULL OR p_key_preview !~ '^sk_live_[A-Za-z0-9_-]{4}$'
        OR length(COALESCE(p_nickname, '')) > 80 OR length(COALESCE(p_folder, '')) > 80 THEN
        RAISE EXCEPTION 'invalid_api_key_metadata';
    END IF;
    PERFORM public.v6_initialize_account(p_user_id);
    SELECT is_dev INTO v_dev FROM public.users WHERE id = p_user_id FOR UPDATE;
    PERFORM 1 FROM public.v6_account_entitlements WHERE user_id = p_user_id FOR UPDATE;
    SELECT * INTO v_existing FROM public.api_keys WHERE id = p_key_id;
    IF FOUND THEN
        IF v_existing.user_id <> p_user_id OR v_existing.key_hash <> p_key_hash
            OR v_existing.key_preview <> p_key_preview OR v_existing.revoked THEN RAISE EXCEPTION 'key_idempotency_conflict'; END IF;
        RETURN p_key_id;
    END IF;
    v_plan := CASE WHEN v_dev THEN 'free' ELSE public.v6_effective_plan(p_user_id) END;
    SELECT api_key_limit INTO v_limit FROM public.v6_plan_rules WHERE plan = v_plan;
    IF NOT v_dev AND (SELECT count(*) FROM public.api_keys WHERE user_id = p_user_id AND NOT revoked) >= v_limit THEN
        RAISE EXCEPTION 'api_key_plan_limit';
    END IF;
    INSERT INTO public.api_keys (id, user_id, key_hash, key_preview, nickname, folder, credits_remaining, credits_used)
        VALUES (p_key_id, p_user_id, p_key_hash, p_key_preview, p_nickname, p_folder, 0, 0);
    RETURN p_key_id;
END;
$$;

-- Revoke default PUBLIC execution and explicit browser-role grants on EACH RPC.
-- No project-wide default privileges, existing grants, policies or functions change.
REVOKE ALL ON FUNCTION public.v6_initialize_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v6_set_pro_period(uuid, uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v6_cancel_pro_period(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v6_effective_plan(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v6_settle_usage(uuid, uuid, boolean, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v6_release_expired_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v6_reserve_usage(uuid, uuid, text, text, boolean, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v6_create_api_key(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v6_initialize_account(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.v6_set_pro_period(uuid, uuid, uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.v6_cancel_pro_period(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.v6_effective_plan(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.v6_settle_usage(uuid, uuid, boolean, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.v6_release_expired_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.v6_reserve_usage(uuid, uuid, text, text, boolean, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.v6_create_api_key(uuid, uuid, text, text, text, text) TO service_role;

COMMIT;
