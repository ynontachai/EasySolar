BEGIN;

DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower('nontachai.y@gmail.com')
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot bootstrap Super Admin: auth user nontachai.y@gmail.com was not found';
  END IF;

  INSERT INTO public.role_assignment (user_id, role_code, organization_id)
  VALUES (target_user_id, 'super_admin', NULL)
  ON CONFLICT DO NOTHING;
END;
$$;

COMMIT;
