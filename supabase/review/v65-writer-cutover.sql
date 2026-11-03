-- Apply only at the coordinated app cutover, after v63-daily-outfits.sql.
-- Old name-array writers must not silently invalidate structured wardrobe data.
BEGIN;
SET LOCAL lock_timeout = '5s';
-- Wait for in-flight writers, then reconcile any legacy edits made after the
-- additive backfill. Preserve structured metadata and distinct duplicate IDs.
LOCK TABLE public.closet IN ACCESS EXCLUSIVE MODE;
WITH existing AS (
  SELECT c.user_id, x.item,
    row_number() OVER (PARTITION BY c.user_id,lower(x.item->>'label') ORDER BY x.ordinal) AS occurrence
  FROM public.closet c CROSS JOIN LATERAL jsonb_array_elements(c.wardrobe_items) WITH ORDINALITY x(item,ordinal)
), incoming AS (
  SELECT c.user_id,x.label,x.ordinal,
    row_number() OVER (PARTITION BY c.user_id,lower(x.label) ORDER BY x.ordinal) AS occurrence
  FROM public.closet c CROSS JOIN LATERAL jsonb_array_elements_text(c.items) WITH ORDINALITY x(label,ordinal)
), refreshed AS (
  SELECT c.user_id, COALESCE((SELECT jsonb_agg(COALESCE(e.item || jsonb_build_object('label',i.label),
    jsonb_build_object('id',gen_random_uuid(),'label',i.label,'category','other','colour','',
      'warmth','unknown','waterproofing','unknown','available',true)) ORDER BY i.ordinal)
    FROM incoming i LEFT JOIN existing e ON e.user_id=i.user_id
      AND lower(e.item->>'label')=lower(i.label) AND e.occurrence=i.occurrence
    WHERE i.user_id=c.user_id),'[]'::jsonb) AS items
  FROM public.closet c
  WHERE c.items IS DISTINCT FROM COALESCE((SELECT jsonb_agg(x.item->>'label' ORDER BY x.ordinal)
    FROM jsonb_array_elements(c.wardrobe_items) WITH ORDINALITY x(item,ordinal)),'[]'::jsonb)
)
UPDATE public.closet c SET wardrobe_items=r.items,revision=c.revision+1
FROM refreshed r WHERE c.user_id=r.user_id;
CREATE OR REPLACE FUNCTION public.v65_guard_closet_writer()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.items <> '[]'::jsonb AND NEW.wardrobe_items = '[]'::jsonb THEN
      RAISE EXCEPTION 'wardrobe_writer_outdated' USING ERRCODE='55000';
    END IF;
  ELSIF NEW.items IS DISTINCT FROM OLD.items AND NEW.revision <= OLD.revision THEN
    RAISE EXCEPTION 'wardrobe_writer_outdated' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.v65_guard_closet_writer() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE TRIGGER v65_guard_closet_writer
BEFORE INSERT OR UPDATE ON public.closet
FOR EACH ROW EXECUTE FUNCTION public.v65_guard_closet_writer();
COMMIT;
