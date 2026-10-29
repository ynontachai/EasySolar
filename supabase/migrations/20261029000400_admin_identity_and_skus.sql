BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_account_status AS ENUM ('active', 'suspended');
CREATE TYPE organization_status AS ENUM ('active', 'suspended');
CREATE TYPE organization_member_status AS ENUM ('active', 'suspended');
CREATE TYPE app_role_code AS ENUM ('account_admin', 'reviewer', 'super_admin');

CREATE TABLE organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug citext NOT NULL UNIQUE,
  status organization_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO organization (id, name, slug)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'EasySolar Operations',
  'easysolar'
);

CREATE TABLE user_profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  status user_account_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status organization_member_status NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE role_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_code app_role_code NOT NULL,
  organization_id uuid REFERENCES organization(id),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (role_code = 'super_admin' AND organization_id IS NULL)
    OR (role_code <> 'super_admin' AND organization_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX role_assignment_active_unique_idx
  ON role_assignment (user_id, role_code, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'));

CREATE TABLE product_variant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id),
  product_model_id uuid NOT NULL REFERENCES product_model(id),
  sku citext NOT NULL,
  variant_label text NOT NULL,
  manufacturer_part_number text,
  status record_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sku)
);

CREATE TABLE audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid REFERENCES organization(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  before_json jsonb,
  after_json jsonb,
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organization_member_user_idx
  ON organization_member (user_id, organization_id);
CREATE INDEX role_assignment_user_idx
  ON role_assignment (user_id, role_code, organization_id);
CREATE INDEX product_variant_model_idx
  ON product_variant (product_model_id, updated_at DESC);
CREATE INDEX product_variant_organization_idx
  ON product_variant (organization_id, updated_at DESC);
CREATE INDEX audit_event_entity_idx
  ON audit_event (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_event_organization_idx
  ON audit_event (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profile (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'EasySolar user'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.admin_has_role(
  requested_roles app_role_code[],
  requested_organization_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_assignment
    JOIN public.user_profile
      ON public.user_profile.id = public.role_assignment.user_id
    WHERE public.role_assignment.user_id = auth.uid()
      AND public.user_profile.status = 'active'
      AND (
        public.role_assignment.expires_at IS NULL
        OR public.role_assignment.expires_at > now()
      )
      AND (
        public.role_assignment.role_code = 'super_admin'
        OR (
          public.role_assignment.role_code = ANY(requested_roles)
          AND (
            requested_organization_id IS NULL
            OR public.role_assignment.organization_id = requested_organization_id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_has_role(app_role_code[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_has_role(app_role_code[], uuid) TO authenticated;

ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE organization FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE user_profile FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE organization_member FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE role_assignment FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE product_variant FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE audit_event FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE organization TO authenticated;
GRANT SELECT ON TABLE user_profile TO authenticated;
GRANT SELECT ON TABLE organization_member TO authenticated;
GRANT SELECT ON TABLE role_assignment TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE product_variant TO authenticated;
GRANT SELECT, INSERT ON TABLE audit_event TO authenticated;

CREATE POLICY organization_scoped_select
  ON organization FOR SELECT TO authenticated
  USING (
    public.admin_has_role(ARRAY['super_admin'::app_role_code])
    OR EXISTS (
      SELECT 1
      FROM organization_member
      WHERE organization_member.organization_id = organization.id
        AND organization_member.user_id = auth.uid()
        AND organization_member.status = 'active'
    )
  );

CREATE POLICY user_profile_self_or_super_select
  ON user_profile FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.admin_has_role(ARRAY['super_admin'::app_role_code])
  );

CREATE POLICY organization_member_self_or_super_select
  ON organization_member FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.admin_has_role(ARRAY['super_admin'::app_role_code])
  );

CREATE POLICY role_assignment_self_or_super_select
  ON role_assignment FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.admin_has_role(ARRAY['super_admin'::app_role_code])
  );

CREATE POLICY product_variant_scoped_select
  ON product_variant FOR SELECT TO authenticated
  USING (
    public.admin_has_role(
      ARRAY['account_admin'::app_role_code, 'reviewer'::app_role_code],
      organization_id
    )
  );

CREATE POLICY product_variant_admin_insert
  ON product_variant FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND updated_by = auth.uid()
    AND public.admin_has_role(
      ARRAY['account_admin'::app_role_code],
      organization_id
    )
  );

CREATE POLICY product_variant_admin_update
  ON product_variant FOR UPDATE TO authenticated
  USING (
    public.admin_has_role(
      ARRAY['account_admin'::app_role_code],
      organization_id
    )
  )
  WITH CHECK (
    updated_by = auth.uid()
    AND public.admin_has_role(
      ARRAY['account_admin'::app_role_code],
      organization_id
    )
  );

CREATE POLICY audit_event_scoped_select
  ON audit_event FOR SELECT TO authenticated
  USING (
    public.admin_has_role(
      ARRAY['account_admin'::app_role_code, 'reviewer'::app_role_code],
      organization_id
    )
  );

CREATE POLICY audit_event_actor_insert
  ON audit_event FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND public.admin_has_role(
      ARRAY['account_admin'::app_role_code, 'reviewer'::app_role_code],
      organization_id
    )
  );

COMMIT;
