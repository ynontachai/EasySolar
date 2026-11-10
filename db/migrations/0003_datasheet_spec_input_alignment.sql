BEGIN;

ALTER TABLE pv_module_spec
  ADD COLUMN IF NOT EXISTS alpha_isc_per_c numeric(12, 8),
  ADD COLUMN IF NOT EXISTS beta_vmp_source text,
  ADD COLUMN IF NOT EXISTS beta_vmp_derivation text,
  ADD COLUMN IF NOT EXISTS beta_vmp_approved_by uuid,
  ADD COLUMN IF NOT EXISTS beta_vmp_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS beta_vmp_approval_note text;

ALTER TABLE inverter_spec
  ADD CONSTRAINT inverter_has_pv_power_limit
  CHECK (max_dc_power_wp IS NOT NULL OR max_recommended_pv_wp IS NOT NULL)
  NOT VALID;

UPDATE pv_module_spec AS spec
SET
  alpha_isc_per_c = 0.00050000,
  gamma_pmax_per_c = -0.00260000
FROM datasheet_revision AS revision
JOIN product_model AS product ON product.id = revision.product_model_id
WHERE spec.datasheet_revision_id = revision.id
  AND (product.exact_model LIKE 'AIKO-A%-GRH%Dw' OR product.exact_model LIKE 'LR7-72HVD-%');

UPDATE pv_module_spec AS spec
SET
  alpha_isc_per_c = 0.00046000,
  gamma_pmax_per_c = -0.00300000
FROM datasheet_revision AS revision
JOIN product_model AS product ON product.id = revision.product_model_id
WHERE spec.datasheet_revision_id = revision.id
  AND product.exact_model = 'LP210*210-M-66-NB-715W';

ALTER TABLE pv_module_spec
  ADD CONSTRAINT pv_module_beta_vmp_source_valid
  CHECK (beta_vmp_source IS NULL OR beta_vmp_source IN ('datasheet', 'derived'))
  NOT VALID;

COMMIT;
