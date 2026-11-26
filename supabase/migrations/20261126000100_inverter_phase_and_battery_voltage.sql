ALTER TABLE inverter_spec
  ADD COLUMN phase_count smallint,
  ADD COLUMN battery_voltage_class text,
  ADD CONSTRAINT inverter_phase_count_valid
    CHECK (phase_count IS NULL OR phase_count IN (1, 3)),
  ADD CONSTRAINT inverter_battery_voltage_class_valid
    CHECK (battery_voltage_class IS NULL OR battery_voltage_class IN ('lv', 'hv'));

COMMENT ON COLUMN inverter_spec.phase_count IS
  'AC output phase count stated by the manufacturer Datasheet; supported values are 1 and 3.';

COMMENT ON COLUMN inverter_spec.battery_voltage_class IS
  'Battery voltage class stated by the manufacturer Datasheet for battery-capable inverters; lv or hv, null when not applicable or not established.';

UPDATE inverter_spec
SET phase_count = CASE
  WHEN product_model.exact_model LIKE 'SUN2000-%KTL-M1' THEN 3
  WHEN product_model.exact_model IN ('SUN2000-8K-LC0', 'SUN2000-10K-LC0') THEN 1
  WHEN product_model.exact_model LIKE 'SUN-%-SG05LP1-EU' THEN 1
  WHEN product_model.exact_model LIKE 'SUN-%-SG02LP1-EU-%' THEN 1
  WHEN product_model.exact_model LIKE 'S6-GR1P%' THEN 1
  WHEN product_model.exact_model LIKE 'S5-GR1P%' THEN 1
  ELSE phase_count
END,
battery_voltage_class = CASE
  WHEN product_model.exact_model LIKE 'SUN2000-%KTL-M1' THEN 'hv'
  WHEN product_model.exact_model IN ('SUN2000-8K-LC0', 'SUN2000-10K-LC0') THEN 'hv'
  WHEN product_model.exact_model LIKE 'SUN-%-SG05LP1-EU' THEN 'lv'
  WHEN product_model.exact_model LIKE 'SUN-%-SG02LP1-EU-%' THEN 'lv'
  ELSE battery_voltage_class
END
FROM datasheet_revision
JOIN product_model ON product_model.id = datasheet_revision.product_model_id
WHERE datasheet_revision.id = inverter_spec.datasheet_revision_id;
