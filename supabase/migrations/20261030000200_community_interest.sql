BEGIN;

CREATE TYPE community_interest_status AS ENUM ('pending', 'active', 'withdrawn', 'converted');
CREATE TYPE community_property_type AS ENUM ('detached_home', 'townhome', 'commercial', 'other');
CREATE TYPE community_decision_role AS ENUM ('owner', 'authorized', 'exploring');
CREATE TYPE community_installation_window AS ENUM ('0_3_months', '3_6_months', '6_12_months', 'exploring');
CREATE TYPE community_consent_purpose AS ENUM ('demand_matching', 'notifications');

CREATE TABLE buyer_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code citext NOT NULL UNIQUE,
  status community_interest_status NOT NULL DEFAULT 'pending',
  property_type community_property_type NOT NULL,
  decision_role community_decision_role NOT NULL,
  installation_window community_installation_window NOT NULL,
  preferred_radius_km smallint NOT NULL CHECK (preferred_radius_km IN (10, 15, 20)),
  selected_system_size_kw numeric(8,2) CHECK (selected_system_size_kw > 0),
  package_price_thb integer CHECK (package_price_thb > 0),
  investment_score smallint CHECK (investment_score BETWEEN 0 AND 100),
  source text NOT NULL DEFAULT 'community_buy',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interest_location_private (
  buyer_interest_id uuid PRIMARY KEY REFERENCES buyer_interest(id) ON DELETE CASCADE,
  province text NOT NULL,
  district text NOT NULL,
  subdistrict text NOT NULL,
  postal_code varchar(5) NOT NULL CHECK (postal_code ~ '^[0-9]{5}$'),
  latitude numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE TABLE interest_contact_private (
  buyer_interest_id uuid PRIMARY KEY REFERENCES buyer_interest(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email citext NOT NULL UNIQUE,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_consent_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_interest_id uuid NOT NULL REFERENCES buyer_interest(id) ON DELETE CASCADE,
  purpose community_consent_purpose NOT NULL,
  consent_version text NOT NULL,
  granted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE community_interest_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_interest_id uuid NOT NULL REFERENCES buyer_interest(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX buyer_interest_status_created_idx ON buyer_interest (status, created_at DESC);
CREATE INDEX buyer_interest_radius_idx ON buyer_interest (preferred_radius_km, status);
CREATE INDEX interest_location_area_idx ON interest_location_private (province, district, subdistrict);
CREATE INDEX community_consent_interest_idx ON community_consent_record (buyer_interest_id, created_at DESC);
CREATE INDEX community_interest_event_idx ON community_interest_event (buyer_interest_id, created_at DESC);

ALTER TABLE buyer_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_location_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_contact_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_consent_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_interest_event ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE buyer_interest FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE interest_location_private FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE interest_contact_private FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE community_consent_record FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE community_interest_event FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE interest_location_private IS 'Restricted PII: exact buyer location for server-side spatial matching only.';
COMMENT ON TABLE interest_contact_private IS 'Restricted PII: buyer contact details. Never expose through the public Data API.';

COMMIT;
