BEGIN;

CREATE TABLE IF NOT EXISTS api_rate_limit (
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key_hash, window_start)
);

CREATE INDEX IF NOT EXISTS api_rate_limit_expires_at_idx
  ON api_rate_limit (expires_at);

ALTER TABLE api_rate_limit ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE api_rate_limit FROM anon, authenticated;

ALTER TABLE pv_module_spec
  ADD CONSTRAINT pv_module_temperature_coefficients_required
  CHECK (beta_voc_per_c IS NOT NULL AND beta_vmp_per_c IS NOT NULL)
  NOT VALID;

ALTER TABLE inverter_spec
  ADD CONSTRAINT inverter_sizing_limits_required
  CHECK (max_dc_power_wp IS NOT NULL AND startup_voltage_v IS NOT NULL)
  NOT VALID;

COMMIT;
