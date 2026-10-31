BEGIN;

-- Review workflow bookkeeping. State itself reuses record_status:
-- draft -> extracted_unverified (spec entered) -> verified -> published,
-- with superseded (older published revision) and recalled (Account Admin or Super Admin).
ALTER TABLE datasheet_revision
  ADD COLUMN spec_source_pages jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN spec_entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN spec_entered_at timestamptz,
  ADD COLUMN review_note text;

CREATE INDEX datasheet_revision_state_idx
  ON datasheet_revision (state, created_at DESC);

-- A model has at most one published revision at a time.
CREATE UNIQUE INDEX datasheet_revision_one_published_idx
  ON datasheet_revision (product_model_id)
  WHERE state = 'published';

COMMIT;
