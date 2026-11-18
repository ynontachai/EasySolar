BEGIN;

ALTER TABLE product_model
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

CREATE TABLE manufacturer_category_status (
  manufacturer_id uuid NOT NULL REFERENCES manufacturer(id) ON DELETE CASCADE,
  category equipment_category NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (manufacturer_id, category)
);

CREATE INDEX product_model_active_catalog_idx
  ON product_model (category, manufacturer_id, exact_model)
  WHERE is_active = true;

ALTER TABLE manufacturer_category_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE manufacturer_category_status
  FROM PUBLIC, anon, authenticated;

COMMIT;
