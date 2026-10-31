BEGIN;

ALTER TYPE asset_purpose ADD VALUE IF NOT EXISTS 'product_image';

CREATE TYPE product_media_role AS ENUM ('primary', 'gallery');

CREATE TABLE product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id),
  product_model_id uuid NOT NULL REFERENCES product_model(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES product_variant(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL UNIQUE REFERENCES asset(id) ON DELETE RESTRICT,
  role product_media_role NOT NULL DEFAULT 'gallery',
  alt_text text NOT NULL CHECK (length(trim(alt_text)) BETWEEN 2 AND 180),
  sort_order smallint NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 20),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_media_primary_model_idx
  ON product_media (product_model_id)
  WHERE role = 'primary';
CREATE INDEX product_media_model_order_idx
  ON product_media (product_model_id, sort_order, created_at);
CREATE INDEX product_media_variant_idx
  ON product_media (product_variant_id, sort_order);

ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE product_media FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE product_media TO authenticated;

CREATE POLICY product_media_scoped_select
  ON product_media FOR SELECT TO authenticated
  USING (
    public.admin_has_role(
      ARRAY['account_admin'::app_role_code, 'reviewer'::app_role_code],
      organization_id
    )
  );

CREATE POLICY product_media_admin_insert
  ON product_media FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.admin_has_role(
      ARRAY['account_admin'::app_role_code],
      organization_id
    )
  );

CREATE POLICY product_media_admin_update
  ON product_media FOR UPDATE TO authenticated
  USING (
    public.admin_has_role(
      ARRAY['account_admin'::app_role_code],
      organization_id
    )
  );

CREATE POLICY product_media_admin_delete
  ON product_media FOR DELETE TO authenticated
  USING (
    public.admin_has_role(
      ARRAY['account_admin'::app_role_code],
      organization_id
    )
  );

UPDATE storage.buckets
SET
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 26214400),
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
WHERE id = 'easysolar-private';

COMMIT;
