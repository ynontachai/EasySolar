BEGIN;

-- Prevent a registration from landing between the member and contact backfill
-- statements. Writes wait until COMMIT, while reads remain available.
LOCK TABLE buyer_interest, interest_contact_private IN SHARE ROW EXCLUSIVE MODE;

-- A community member is the person identity. buyer_interest remains the
-- installation intent, so one member can own more than one site in the future.
CREATE TABLE community_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code citext NOT NULL UNIQUE,
  referred_by_member_id uuid REFERENCES community_member(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referred_by_member_id IS NULL OR referred_by_member_id <> id)
);

CREATE TABLE community_member_contact_private (
  member_id uuid PRIMARY KEY REFERENCES community_member(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email citext NOT NULL UNIQUE,
  phone text CHECK (phone IS NULL OR phone ~ '^0[0-9]{8,9}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE buyer_interest
  ADD COLUMN member_id uuid REFERENCES community_member(id) ON DELETE RESTRICT;

-- Preserve existing registrations. Reusing the interest UUID makes the
-- backfill traceable; new registrations receive an independent member UUID.
INSERT INTO community_member (id, referral_code, created_at, updated_at)
SELECT
  buyer_interest.id,
  'ES-' || upper(substr(replace(buyer_interest.id::text, '-', ''), 1, 10)),
  buyer_interest.created_at,
  buyer_interest.updated_at
FROM buyer_interest;

INSERT INTO community_member_contact_private (
  member_id,
  full_name,
  email,
  phone,
  created_at,
  updated_at
)
SELECT
  interest_contact_private.buyer_interest_id,
  interest_contact_private.full_name,
  interest_contact_private.email,
  interest_contact_private.phone,
  interest_contact_private.created_at,
  interest_contact_private.updated_at
FROM interest_contact_private;

UPDATE buyer_interest
SET member_id = id
WHERE member_id IS NULL;

-- Keep the legacy contact table during this release so the currently deployed
-- application remains writable while the migration and Vercel deployment are
-- rolling out. Registrations made by the old application are mirrored into the
-- new member model by this trigger. A later cleanup migration can remove the
-- trigger/table and make buyer_interest.member_id NOT NULL after the new code is
-- confirmed in production.
CREATE FUNCTION sync_legacy_interest_contact_to_member()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO community_member (id, referral_code)
  VALUES (
    NEW.buyer_interest_id,
    'ES-' || upper(substr(replace(NEW.buyer_interest_id::text, '-', ''), 1, 10))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO community_member_contact_private (
    member_id,
    full_name,
    email,
    phone,
    created_at,
    updated_at
  ) VALUES (
    NEW.buyer_interest_id,
    NEW.full_name,
    NEW.email,
    NEW.phone,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (member_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    updated_at = EXCLUDED.updated_at;

  UPDATE buyer_interest
  SET member_id = NEW.buyer_interest_id
  WHERE id = NEW.buyer_interest_id
    AND member_id IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER interest_contact_private_member_sync
AFTER INSERT OR UPDATE ON interest_contact_private
FOR EACH ROW
EXECUTE FUNCTION sync_legacy_interest_contact_to_member();

REVOKE ALL ON FUNCTION sync_legacy_interest_contact_to_member()
  FROM PUBLIC, anon, authenticated;

CREATE INDEX buyer_interest_member_idx
  ON buyer_interest (member_id, created_at DESC);
CREATE INDEX community_member_referrer_idx
  ON community_member (referred_by_member_id, created_at DESC)
  WHERE referred_by_member_id IS NOT NULL;
CREATE INDEX community_member_contact_name_idx
  ON community_member_contact_private (full_name);

ALTER TABLE community_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_member_contact_private ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE community_member FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE community_member_contact_private FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE community_member IS
  'Stable community customer identity and immutable referral attribution.';
COMMENT ON TABLE community_member_contact_private IS
  'Restricted PII for a community member. Access only from authorized server-side admin flows.';
COMMENT ON COLUMN buyer_interest.member_id IS
  'Owner of this installation intent; nullable only during the legacy-contact rollout window.';
COMMENT ON TABLE interest_contact_private IS
  'Deprecated compatibility table retained for the member rollout; remove in a later migration.';

COMMIT;
