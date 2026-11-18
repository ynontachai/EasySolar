BEGIN;

CREATE TABLE datasheet_extraction_import (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL UNIQUE REFERENCES asset(id) ON DELETE RESTRICT,
  schema_id text NOT NULL,
  schema_version text NOT NULL,
  template_id text NOT NULL CHECK (template_id IN ('pv-module', 'inverter')),
  template_version text NOT NULL,
  prompt_version text NOT NULL,
  source_output jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE datasheet_extraction_candidate (
  import_id uuid NOT NULL REFERENCES datasheet_extraction_import(id) ON DELETE CASCADE,
  revision_id uuid NOT NULL UNIQUE REFERENCES datasheet_revision(id) ON DELETE CASCADE,
  model_index integer NOT NULL CHECK (model_index >= 0),
  model_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (import_id, model_index)
);

CREATE INDEX datasheet_extraction_import_created_at_idx
  ON datasheet_extraction_import (created_at DESC);

COMMIT;
