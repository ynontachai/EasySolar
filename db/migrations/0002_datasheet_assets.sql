BEGIN;

CREATE TYPE asset_purpose AS ENUM (
  'datasheet',
  'report',
  'bill_attachment',
  'quote_attachment',
  'other'
);

CREATE TYPE asset_state AS ENUM (
  'pending_upload',
  'uploaded',
  'scanning',
  'available',
  'quarantined',
  'deleted'
);

CREATE TYPE datasheet_asset_role AS ENUM (
  'original',
  'normalized_pdf',
  'preview',
  'extracted_text'
);

CREATE TABLE asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose asset_purpose NOT NULL,
  storage_provider text NOT NULL,
  bucket text NOT NULL,
  object_key text NOT NULL,
  original_filename text NOT NULL,
  media_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  etag text,
  state asset_state NOT NULL DEFAULT 'pending_upload',
  uploaded_by uuid,
  uploaded_at timestamptz,
  available_at timestamptz,
  quarantined_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_provider, bucket, object_key),
  CHECK (state <> 'available' OR available_at IS NOT NULL),
  CHECK (state <> 'quarantined' OR quarantined_at IS NOT NULL),
  CHECK (state <> 'deleted' OR deleted_at IS NOT NULL)
);

CREATE TABLE datasheet_asset (
  datasheet_revision_id uuid NOT NULL REFERENCES datasheet_revision(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,
  role datasheet_asset_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (datasheet_revision_id, asset_id, role)
);

CREATE UNIQUE INDEX datasheet_asset_original_revision_idx
  ON datasheet_asset (datasheet_revision_id)
  WHERE role = 'original';

CREATE TABLE asset_scan_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,
  scanner text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('clean', 'infected', 'error')),
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX asset_state_created_at_idx ON asset (state, created_at DESC);
CREATE INDEX asset_sha256_idx ON asset (sha256);
CREATE INDEX datasheet_asset_asset_idx ON datasheet_asset (asset_id);
CREATE INDEX asset_scan_event_asset_idx
  ON asset_scan_event (asset_id, created_at DESC);

COMMIT;
