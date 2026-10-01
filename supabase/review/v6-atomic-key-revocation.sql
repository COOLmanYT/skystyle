-- PROPOSED ONLY. Production execution requires explicit approval of this SQL.
-- Does not enable V6 accounting, payments, or grant/reset any credits.
CREATE FUNCTION public.v6_revoke_api_key(p_user_id uuid, p_key_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_request_id uuid;
    v_released integer := 0;
BEGIN
    IF NOT COALESCE((SELECT enabled FROM public.v6_entitlement_rollout WHERE singleton), false) THEN
        RAISE EXCEPTION 'v6_not_active';
    END IF;
    PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'account_unavailable'; END IF;
    PERFORM 1 FROM public.v6_account_entitlements WHERE user_id = p_user_id FOR UPDATE;
    PERFORM 1 FROM public.api_keys WHERE id = p_key_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'api_key_unavailable'; END IF;

    UPDATE public.api_keys SET revoked = true WHERE id = p_key_id AND user_id = p_user_id;
    UPDATE public.v6_credit_lots SET archived = true
        WHERE user_id = p_user_id AND kind = 'legacy_api' AND source_ref = 'legacy_api:' || p_key_id::text;
    FOR v_request_id IN
        SELECT request_id FROM public.v6_usage_reservations
        WHERE user_id = p_user_id AND api_key_id = p_key_id AND status = 'reserved'
        ORDER BY request_id
    LOOP
        PERFORM public.v6_settle_usage(p_user_id, v_request_id, false, 0);
        v_released := v_released + 1;
    END LOOP;
    RETURN jsonb_build_object('id', p_key_id, 'revoked', true, 'releasedReservations', v_released);
END;
$$;
REVOKE ALL ON FUNCTION public.v6_revoke_api_key(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v6_revoke_api_key(uuid, uuid) TO service_role;
