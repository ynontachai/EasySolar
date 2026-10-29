BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE equipment_category AS ENUM ('pv_module', 'inverter');
CREATE TYPE record_status AS ENUM (
  'draft',
  'extracted_unverified',
  'verified',
  'published',
  'superseded',
  'recalled'
);

CREATE TABLE manufacturer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  website text,
  status record_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_model (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES manufacturer(id),
  category equipment_category NOT NULL,
  exact_model text NOT NULL,
  market text NOT NULL DEFAULT 'TH',
  status record_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer_id, exact_model, market)
);

CREATE TABLE datasheet_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_model_id uuid NOT NULL REFERENCES product_model(id),
  revision_label text NOT NULL,
  issue_date date,
  source_url text,
  storage_key text,
  sha256 char(64),
  language text NOT NULL DEFAULT 'en',
  state record_status NOT NULL DEFAULT 'draft',
  verified_at timestamptz,
  verified_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_url IS NOT NULL OR storage_key IS NOT NULL),
  CHECK (state NOT IN ('verified', 'published') OR verified_at IS NOT NULL),
  UNIQUE (product_model_id, revision_label)
);

CREATE TABLE pv_module_spec (
  datasheet_revision_id uuid PRIMARY KEY REFERENCES datasheet_revision(id),
  pmax_wp numeric(12, 3) NOT NULL CHECK (pmax_wp > 0),
  voc_v numeric(12, 4) NOT NULL CHECK (voc_v > 0),
  vmp_v numeric(12, 4) NOT NULL CHECK (vmp_v > 0),
  isc_a numeric(12, 4) NOT NULL CHECK (isc_a > 0),
  imp_a numeric(12, 4) NOT NULL CHECK (imp_a > 0),
  beta_voc_per_c numeric(12, 8),
  beta_vmp_per_c numeric(12, 8),
  gamma_pmax_per_c numeric(12, 8),
  max_system_voltage_v numeric(12, 3) NOT NULL CHECK (max_system_voltage_v > 0),
  max_series_fuse_a numeric(12, 3),
  bifaciality_factor numeric(8, 5),
  CHECK (vmp_v < voc_v),
  CHECK (imp_a < isc_a)
);

CREATE TABLE inverter_spec (
  datasheet_revision_id uuid PRIMARY KEY REFERENCES datasheet_revision(id),
  rated_ac_kw numeric(12, 3) NOT NULL CHECK (rated_ac_kw > 0),
  max_dc_voltage_v numeric(12, 3) NOT NULL CHECK (max_dc_voltage_v > 0),
  max_recommended_pv_wp numeric(12, 3),
  max_dc_power_wp numeric(12, 3),
  startup_voltage_v numeric(12, 3),
  max_total_dc_current_a numeric(12, 3),
  dc_ac_policy text,
  inverter_type text NOT NULL
);

CREATE TABLE mppt_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inverter_revision_id uuid NOT NULL REFERENCES inverter_spec(datasheet_revision_id),
  tracker_index integer NOT NULL CHECK (tracker_index > 0),
  mppt_min_v numeric(12, 3) NOT NULL CHECK (mppt_min_v > 0),
  mppt_max_v numeric(12, 3) NOT NULL CHECK (mppt_max_v > mppt_min_v),
  max_operating_current_a numeric(12, 3) NOT NULL CHECK (max_operating_current_a > 0),
  max_short_circuit_current_a numeric(12, 3) NOT NULL CHECK (max_short_circuit_current_a > 0),
  input_count integer NOT NULL CHECK (input_count > 0),
  max_input_current_a numeric(12, 3),
  max_input_isc_a numeric(12, 3),
  power_limit_wp numeric(12, 3),
  UNIQUE (inverter_revision_id, tracker_index)
);

CREATE TABLE calculation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inputs_json jsonb NOT NULL,
  spec_snapshots_json jsonb NOT NULL,
  engine_version text NOT NULL,
  result_json jsonb NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE verification_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  datasheet_revision_id uuid NOT NULL REFERENCES datasheet_revision(id),
  field_path text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_model_manufacturer_idx
  ON product_model (manufacturer_id);
CREATE INDEX product_model_search_idx
  ON product_model USING gin (to_tsvector('simple', exact_model));
CREATE INDEX calculation_created_at_idx ON calculation (created_at DESC);
CREATE INDEX verification_event_revision_idx
  ON verification_event (datasheet_revision_id, created_at DESC);

COMMIT;
