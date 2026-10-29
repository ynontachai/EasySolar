# EasySolar Data and File Architecture Plan

## Recommended baseline

- **PostgreSQL** is the transactional source of truth for identity, catalog, projects, assessments, packages and future commerce records.
- **S3-compatible private object storage** stores datasheets, generated reports and future quote attachments.
- Large files are never stored as PostgreSQL `bytea`; the database stores immutable metadata, object keys, checksum and lifecycle state.
- Deterministic engines remain pure modules. APIs resolve versioned records and create immutable snapshots before calculation.
- Start as a modular monolith with logical PostgreSQL schemas; split services only after scale or ownership requires it.

## Logical data domains

### `identity`

- `user_account`
- `organization`
- `organization_member`
- `role_assignment`

### `catalog`

- Existing: `manufacturer`, `product_model`, `datasheet_revision`, `pv_module_spec`, `inverter_spec`, `mppt_tracker`
- Add: `asset`, `asset_scan_event`, `datasheet_asset`, `product_variant`, `product_attribute`
- Canonical product/spec data must not contain seller price or stock

### `engineering`

- Existing: `calculation`, `verification_event`
- Add: `project`, `project_member`, `design_alternative`, `engineering_run`, `report_asset`

### `assessment`

- `solar_assessment`
- `electricity_bill_period`
- `daily_time_period_policy`
- `occupancy_period_input`
- `ac_usage_period_input`
- `tariff_plan`, `tariff_version`, `tariff_rate_period`
- `export_program`, `export_program_version`
- `yield_policy_version`
- `assessment_run`

### `package`

- `package_draft`
- `package_version`
- `package_item`
- `package_evaluation_run`
- `package_report_asset`

### `commerce` — future boundary

- `merchant`
- `merchant_location`
- `sellable_item`
- `merchant_offer`
- `offer_price_version`
- `inventory_snapshot`
- Future: `cart`, `order`, `order_item`, `payment`, `fulfillment`

Commerce records reference canonical catalog products but never become the source of engineering specifications.

## File storage model

### Asset metadata

`asset` should include:

- `id uuid`
- `purpose` — `datasheet`, `report`, `quote_attachment`, `other`
- `storage_provider`, `bucket`, `object_key`
- `original_filename`, `media_type`, `size_bytes`
- `sha256`, `etag`
- `state` — `pending_upload`, `uploaded`, `scanning`, `available`, `quarantined`, `deleted`
- `uploaded_by`, `created_at`, `available_at`, `deleted_at`
- `retention_class` and optional `organization_id`

`datasheet_asset` links one asset to one `datasheet_revision` with role `original`, `normalized_pdf`, `preview` or `extracted_text`. A published revision must have exactly one available original asset.

### Object key convention

Use opaque IDs and immutable versions:

```text
{environment}/catalog/datasheets/{productModelId}/{revisionId}/{assetId}/original.pdf
{environment}/reports/{organizationId}/{projectId}/{reportId}/report.pdf
```

Do not put customer names, email addresses, original filenames or guessable sequential IDs in object keys.

### Upload and download lifecycle

1. Authorized client requests an upload intent
2. API creates `asset(state=pending_upload)` and returns a short-lived signed upload URL
3. Client uploads directly to object storage
4. API finalizes the upload and verifies size, media type and SHA-256
5. Background scanner moves state to `available` or `quarantined`
6. OCR/extraction may create draft values but cannot publish a revision
7. Downloads use short-lived signed URLs after permission and asset-state checks
8. Replacement creates a new asset/revision; published files are never overwritten

### Initial controls

- PDF only for datasheets; magic-byte validation in addition to extension
- Configurable file-size limit, recommended starting point 25 MB
- Malware scan before reviewer/public access
- Server-side encryption at rest and TLS in transit
- Signed URL TTL 5–15 minutes
- Audit upload, quarantine, publish and download of restricted assets
- Object versioning and lifecycle rules; soft delete before physical purge

## Consumer assessment model

### `solar_assessment`

Owns actor/anonymous session, location region, property type, status, input-quality state and current result pointer.

### `electricity_bill_period`

One row per month with `period_start`, `period_end`, `amount_thb`, optional `energy_kwh`, source type and optional bill asset. Enforce non-negative money/kWh and no duplicate period per assessment.

### Occupancy and AC usage

`daily_time_period_policy` defines four versioned periods. Inputs reference the policy and period ID rather than hard-coded columns. Occupancy count is an integer; unknown is `NULL`, not `0`. AC usage stores enabled flag, unit count, approximate hours and input quality.

### Tariff/export policy

Tariff and export programs are effective-dated and immutable after publication. Assessment runs store the exact policy version IDs and JSON snapshots used.

### `assessment_run`

Stores:

- `input_snapshot_json`
- `policy_snapshot_json`
- `engine_version`
- `result_json`
- `confidence_level`, `coverage_score`
- `created_at`

New policy versions never rewrite historical assessment results.

## Package Builder model

### Package identity and versioning

- `package_draft` belongs to a project and has owner/status
- `package_version` is immutable once issued or shared
- Editing an issued package creates a new version
- `package_item` belongs to a version and stores role, quantity, unit and source

### Package item references

A line is either:

1. Canonical equipment/variant reference, or
2. Custom BOS/service line with explicit description

Use separate nullable FKs plus a CHECK constraint so exactly one source is present. Snapshot label/spec-critical values into the package version for history.

### Engineering versus commerce

- Engineering validation reads canonical specs and package quantities
- Price/inventory reads `commerce.merchant_offer`
- A safety-compatible candidate may have zero offers
- Commercial ranking cannot change PASS/FAIL/INCOMPLETE findings
- Marketplace links are attached after engineering evaluation, never injected into the rule engine

## Commerce-ready model

`sellable_item` maps a merchant-neutral SKU/variant to a canonical `product_variant` when possible. `merchant_offer` maps merchant SKU, fulfillment region and active state. Price is effective-dated in `offer_price_version`; inventory is a timestamped snapshot, not a field on the canonical product.

This boundary allows future Marketplace work without polluting equipment specifications or historical calculations.

## Constraints and indexes

- Index every foreign key
- Unique SHA-256 per storage scope to detect duplicate upload, while allowing explicit reuse links
- Partial indexes for published catalog records and active merchant offers
- Composite indexes for `product_model(category, market, status)` and exact model search
- Composite indexes for assessment/project owner + `updated_at DESC`
- Effective-date exclusion/validation to prevent overlapping published tariff versions
- `numeric/decimal` for money, rates and engineering values; never floating point for price
- `ON DELETE RESTRICT` for published revisions/calculations/packages; cascade only true dependent drafts/events

## Privacy and retention

- Electricity bills and occupancy patterns are personal/sensitive usage data
- Collect the minimum necessary, show purpose before upload, and define retention by assessment/account status
- Anonymous drafts should expire automatically unless the user saves them
- Export/delete workflows must cover database rows and stored objects
- Separate public datasheets from private bills, quotes and reports at bucket/prefix and authorization-policy level

## Migration plan

Do not extend `0001_initial.sql` after production use. Create reversible migrations in this order:

1. Identity and organization boundary
2. Asset metadata and datasheet links
3. Projects and engineering runs
4. Assessment inputs and policy versions
5. Package Builder
6. Commerce mapping; order/payment tables only when Marketplace scope is approved

Each migration should be backward compatible: add nullable structures, backfill, then enforce constraints in a later migration.
