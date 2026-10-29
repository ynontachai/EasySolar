BEGIN;

DROP TABLE IF EXISTS asset_scan_event;
DROP TABLE IF EXISTS datasheet_asset;
DROP TABLE IF EXISTS asset;

DROP TYPE IF EXISTS datasheet_asset_role;
DROP TYPE IF EXISTS asset_state;
DROP TYPE IF EXISTS asset_purpose;

COMMIT;
