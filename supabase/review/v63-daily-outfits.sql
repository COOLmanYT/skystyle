-- REVIEW CANDIDATE: do not auto-apply or enable V6 accounting/checkout.
-- Drain old full-array closet writers and old scheduler workers before rollout.
BEGIN;
ALTER TABLE public.closet ADD COLUMN IF NOT EXISTS wardrobe_items jsonb;
ALTER TABLE public.closet ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
UPDATE public.closet c SET wardrobe_items = COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'id', gen_random_uuid(), 'label', value, 'category', 'other', 'colour', '',
  'warmth', 'unknown', 'waterproofing', 'unknown', 'available', true) ORDER BY ordinal)
  FROM jsonb_array_elements_text(c.items) WITH ORDINALITY a(value,ordinal)), '[]'::jsonb)
WHERE wardrobe_items IS NULL;
ALTER TABLE public.closet ALTER COLUMN wardrobe_items SET DEFAULT '[]'::jsonb;
ALTER TABLE public.closet ALTER COLUMN wardrobe_items SET NOT NULL;
REVOKE ALL ON public.closet FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closet TO service_role;

CREATE OR REPLACE FUNCTION public.v63_mutate_wardrobe(p_user_id uuid, p_expected_revision bigint, p_operation jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.closet%ROWTYPE; next_items jsonb; item jsonb; action text := p_operation->>'type';
BEGIN
  IF p_user_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 THEN RAISE EXCEPTION 'invalid_wardrobe_operation'; END IF;
  INSERT INTO public.closet(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO STRICT c FROM public.closet WHERE user_id=p_user_id FOR UPDATE;
  IF action='initialize' THEN
    RETURN jsonb_build_object('wardrobeItems',c.wardrobe_items,'items',c.items,'revision',c.revision);
  END IF;
  IF c.revision <> p_expected_revision THEN RAISE EXCEPTION 'wardrobe_conflict'; END IF;
  next_items := c.wardrobe_items;
  IF action IN ('add','update') THEN
    item := p_operation->'item';
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'label') IS DISTINCT FROM 'string'
      OR length(trim(item->>'label')) NOT BETWEEN 1 AND 200 OR jsonb_typeof(item->'colour') IS DISTINCT FROM 'string' OR length(item->>'colour')>60
      OR COALESCE(item->>'category','') NOT IN ('top','bottom','one-piece','outerwear','footwear','accessory','other')
      OR COALESCE(item->>'warmth','') NOT IN ('unknown','light','medium','warm')
      OR COALESCE(item->>'waterproofing','') NOT IN ('unknown','none','resistant','waterproof')
      OR jsonb_typeof(item->'available') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_wardrobe_item'; END IF;
    PERFORM (item->>'id')::uuid;
    IF action='add' THEN
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(next_items) x WHERE x->>'id'=item->>'id') THEN RAISE EXCEPTION 'wardrobe_conflict'; END IF;
      next_items := next_items || jsonb_build_array(item);
    ELSE
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(next_items) x WHERE x->>'id'=item->>'id') THEN RAISE EXCEPTION 'wardrobe_conflict'; END IF;
      SELECT COALESCE(jsonb_agg(CASE WHEN x->>'id'=item->>'id' THEN item ELSE x END ORDER BY ordinal),'[]'::jsonb)
        INTO next_items FROM jsonb_array_elements(next_items) WITH ORDINALITY a(x,ordinal);
    END IF;
  ELSIF action='delete' THEN
    IF jsonb_typeof(p_operation->'ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_wardrobe_operation'; END IF;
    SELECT COALESCE(jsonb_agg(x ORDER BY ordinal),'[]'::jsonb) INTO next_items
      FROM jsonb_array_elements(next_items) WITH ORDINALITY a(x,ordinal)
      WHERE NOT (p_operation->'ids' ? (x->>'id'));
  ELSIF action='replace' THEN
    -- Internal legacy adapter only: descriptions are mapped onto existing IDs.
    IF jsonb_typeof(p_operation->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_wardrobe_operation'; END IF;
    SELECT COALESCE(jsonb_agg(COALESCE((SELECT x FROM jsonb_array_elements(c.wardrobe_items) x WHERE lower(x->>'label')=lower(label) LIMIT 1),
      jsonb_build_object('id',gen_random_uuid(),'label',label,'category','other','colour','','warmth','unknown','waterproofing','unknown','available',true)) ORDER BY ordinal),'[]'::jsonb)
      INTO next_items FROM jsonb_array_elements_text(p_operation->'items') WITH ORDINALITY a(label,ordinal);
  ELSE RAISE EXCEPTION 'invalid_wardrobe_operation'; END IF;
  IF jsonb_array_length(next_items)>500 THEN RAISE EXCEPTION 'wardrobe_item_limit'; END IF;
  UPDATE public.closet SET wardrobe_items=next_items, revision=revision+1,
    items=COALESCE((SELECT jsonb_agg(x->>'label' ORDER BY ordinal) FROM jsonb_array_elements(next_items) WITH ORDINALITY a(x,ordinal)),'[]'::jsonb)
    WHERE user_id=p_user_id RETURNING * INTO c;
  RETURN jsonb_build_object('wardrobeItems',c.wardrobe_items,'items',c.items,'revision',c.revision);
END; $$;
REVOKE ALL ON FUNCTION public.v63_mutate_wardrobe(uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v63_mutate_wardrobe(uuid,bigint,jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.saved_outfits (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  revision bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_outfits_user_updated_idx ON public.saved_outfits(user_id,updated_at DESC);
ALTER TABLE public.saved_outfits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saved_outfits FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.saved_outfits TO service_role;
CREATE OR REPLACE FUNCTION public.v63_mutate_outfit(p_user_id uuid,p_id uuid,p_revision bigint,p_action text,p_title text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE saved public.saved_outfits%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_id IS NULL OR p_revision IS NULL OR p_revision<0 THEN RAISE EXCEPTION 'invalid_outfit'; END IF;
  IF p_action='add' THEN
    INSERT INTO public.saved_outfits(id,user_id,title,payload) VALUES(p_id,p_user_id,p_title,p_payload) ON CONFLICT(id) DO NOTHING;
    SELECT * INTO STRICT saved FROM public.saved_outfits WHERE id=p_id AND user_id=p_user_id;
    IF saved.payload<>p_payload OR saved.title<>p_title THEN RAISE EXCEPTION 'outfit_conflict'; END IF;
  ELSIF p_action IN ('update','delete') THEN
    SELECT * INTO saved FROM public.saved_outfits WHERE id=p_id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR saved.revision<>p_revision THEN RAISE EXCEPTION 'outfit_conflict'; END IF;
    IF p_action='delete' THEN DELETE FROM public.saved_outfits WHERE id=p_id AND user_id=p_user_id; RETURN jsonb_build_object('deleted',true); END IF;
    UPDATE public.saved_outfits SET title=p_title,payload=p_payload,revision=revision+1,updated_at=now()
      WHERE id=p_id AND user_id=p_user_id RETURNING * INTO saved;
  ELSE RAISE EXCEPTION 'invalid_outfit_action'; END IF;
  RETURN to_jsonb(saved)-'user_id';
END; $$;
REVOKE ALL ON FUNCTION public.v63_mutate_outfit(uuid,uuid,bigint,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v63_mutate_outfit(uuid,uuid,bigint,text,text,jsonb) TO service_role;

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS comfort_preferences jsonb;
ALTER TABLE public.changelog_posts ADD COLUMN IF NOT EXISTS release_status text CHECK(release_status IN ('development','released'));
-- Historical entries must be classified against verified deployment evidence.
-- No accounting/checkout flags, periods, balances or existing changelog rows change.
COMMIT;
