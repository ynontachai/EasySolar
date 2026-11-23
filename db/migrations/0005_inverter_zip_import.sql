ALTER TABLE datasheet_revision
  ADD COLUMN suggested_inverter_type text
  CHECK (suggested_inverter_type IN ('string', 'hybrid', 'micro'));

COMMENT ON COLUMN datasheet_revision.suggested_inverter_type IS
  'Unverified inverter type proposed by an intake source such as a ZIP folder; copied into the review form but never published directly.';
