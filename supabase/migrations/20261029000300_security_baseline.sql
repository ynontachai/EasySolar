BEGIN;

-- The application uses a trusted server connection during bootstrap.
-- Keep the Data API closed until Auth, grants, and tested RLS policies ship together.
ALTER TABLE manufacturer ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasheet_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE pv_module_spec ENABLE ROW LEVEL SECURITY;
ALTER TABLE inverter_spec ENABLE ROW LEVEL SECURITY;
ALTER TABLE mppt_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasheet_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_scan_event ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE manufacturer FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE product_model FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE datasheet_revision FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE pv_module_spec FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE inverter_spec FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE mppt_tracker FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE calculation FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE verification_event FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE asset FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE datasheet_asset FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE asset_scan_event FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

COMMIT;
