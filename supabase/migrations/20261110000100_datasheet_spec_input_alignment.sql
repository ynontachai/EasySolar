BEGIN;

ALTER TABLE pv_module_spec
  ADD COLUMN IF NOT EXISTS alpha_isc_per_c numeric(12, 8),
  ADD COLUMN IF NOT EXISTS beta_vmp_approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS beta_vmp_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS beta_vmp_approval_note text;

ALTER TABLE pv_module_spec
  DROP CONSTRAINT IF EXISTS pv_module_temperature_coefficients_required;

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

UPDATE datasheet_revision AS revision
SET spec_source_pages = revision.spec_source_pages || jsonb_build_object(
  'alphaIscPercentPerC', '2',
  'gammaPmaxPercentPerC', '2'
)
FROM product_model AS product
WHERE product.id = revision.product_model_id
  AND (
    product.exact_model LIKE 'AIKO-A%-GRH%Dw'
    OR product.exact_model LIKE 'LR7-72HVD-%'
    OR product.exact_model = 'LP210*210-M-66-NB-715W'
  );

ALTER TABLE inverter_spec
  DROP CONSTRAINT IF EXISTS inverter_sizing_limits_required;

ALTER TABLE inverter_spec
  ADD CONSTRAINT inverter_has_pv_power_limit
  CHECK (max_dc_power_wp IS NOT NULL OR max_recommended_pv_wp IS NOT NULL)
  NOT VALID;

ALTER TABLE inverter_spec
  ADD CONSTRAINT inverter_startup_voltage_required
  CHECK (startup_voltage_v IS NOT NULL)
  NOT VALID;

ALTER TABLE pv_module_spec
  ADD CONSTRAINT pv_module_beta_vmp_approval_consistent
  CHECK (
    (beta_vmp_approved_at IS NULL AND beta_vmp_approved_by IS NULL AND beta_vmp_approval_note IS NULL)
    OR
    (
      beta_vmp_source = 'derived'
      AND beta_vmp_approved_at IS NOT NULL
      AND beta_vmp_approved_by IS NOT NULL
      AND length(trim(beta_vmp_approval_note)) >= 10
    )
  )
  NOT VALID;

COMMIT;
