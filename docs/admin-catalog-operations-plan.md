# EasySolar Admin Catalog Operations Plan

## Purpose

สร้างหลังบ้านที่ทำให้ทีม EasySolar เพิ่มและดูแลสินค้า, SKU, Engineering Spec และ Datasheet ได้เร็ว โดยไม่ลดทอนความน่าเชื่อถือของข้อมูลที่ถูกใช้ในงานคำนวณ

หลักการสำคัญคือ **Commerce data และ Engineering data ต้องเชื่อมกันแต่ไม่ใช่ข้อมูลก้อนเดียวกัน**:

- `product_model` และ `datasheet_revision` เป็น canonical engineering catalog
- `product_variant` เป็น SKU/รุ่นย่อยที่อ้างกลับไปยัง model
- ราคา, stock และ merchant SKU อยู่ใน commerce boundary ภายหลัง
- การ import ทุกชนิดเข้า staging ก่อน ไม่มีไฟล์ใด publish โดยอัตโนมัติ
- Datasheet revision ที่ใช้คำนวณต้องผ่าน scan, field verification และ approval

## Benchmark synthesis

แนวทางนี้เลือกเฉพาะ pattern ที่เหมาะกับ EasySolar:

| Reference | Pattern ที่นำมาใช้ | สิ่งที่ EasySolar ต้องปรับเพิ่ม |
| --- | --- | --- |
| Shopify Products / SKU / CSV | Product–variant structure, SKU uniqueness, single edit + bulk edit + CSV, review before import | ห้าม CSV เขียนทับ engineering revision โดยตรง และสินค้าต้องมี readiness gate |
| Shopify Roles | Role รวม granular permissions ตามหน้าที่ | เพิ่ม organization scope, separation of duties และ audit สำหรับข้อมูลวิศวกรรม |
| Akeneo PIM | Product family, import mode, readiness/completeness, proposal–review–approval และ asset linkage | ใช้ category-specific engineering requirements และ source page ต่อ field |
| Google Merchant Center | Processing report, Needs attention, issue grouping และ downloadable diagnostics | แยก blocking engineering errors ออกจาก commerce/content warnings |
| Supabase Auth/RLS | Auth user, custom claims, permission lookup และ database/storage RLS | Permission source of truth อยู่ใน Postgres; service/secret key ใช้เฉพาะ trusted server |

Benchmark references (accessed 2026-10-29):

- [Shopify products](https://help.shopify.com/en/manual/products)
- [Shopify SKU guidance](https://help.shopify.com/en/manual/products/details/sku)
- [Shopify product CSV import](https://help.shopify.com/en/manual/products/import-export/import-products)
- [Shopify roles](https://help.shopify.com/en/manual/your-account/users/roles/)
- [Akeneo import modes and error reporting](https://help.akeneo.com/import-export-data/import-your-data)
- [Akeneo product review workflow](https://help.akeneo.com/review-product-changes?kb_language=en_US)
- [Akeneo Product Readiness](https://help.akeneo.com/en_US/product-readiness/product-readiness-faq)
- [Google Merchant Center data-source diagnostics](https://support.google.com/merchants/answer/13760862?hl=en)
- [Supabase RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

## Roles and permission boundary

### Account Admin

Account Admin ทำงานภายใน organization ที่ได้รับมอบหมาย:

- ดูและค้น catalog ที่ตนมีสิทธิ์
- สร้าง/แก้ draft product model และ SKU
- import CSV/XLSX ด้วย template ที่อนุมัติแล้ว
- upload Datasheet และแก้ field proposals
- submit งานเข้า review และแก้รายการที่ถูก reject
- ดู import history, error report และ audit ที่เกี่ยวกับงานของตน
- archive draft ที่ยังไม่เคย publish

Account Admin **ทำไม่ได้**:

- publish/recall engineering revision
- เปลี่ยน schema, attribute definition หรือ import template ที่ active
- จัดการ Super Admin หรือขยาย scope ของตัวเอง
- hard-delete record/file ที่เคย publish หรือถูกอ้างใน calculation
- เปลี่ยนค่าที่ verified โดยไม่สร้าง revision/change request ใหม่

### Catalog Reviewer

เป็น permission set ที่แยกจากผู้สร้างข้อมูล แม้ผู้ใช้บางคนอาจมีทั้ง Admin และ Reviewer ในระยะแรก:

- ตรวจ Datasheet เทียบ normalized fields แบบ side-by-side
- approve/reject พร้อมเหตุผลและ source page/section
- publish revision เมื่อ critical gates ผ่าน
- ห้าม approve submission ที่ตัวเองเป็นผู้ submit เมื่อเปิด four-eyes policy

### Super Admin

Super Admin เป็น platform scope:

- invite/suspend users และกำหนด organization/role
- จัดการ permission sets, categories, attribute definitions และ import-template versions
- ดูทุก import/review/audit event
- publish, recall หรือ quarantine ด้วยเหตุผลบังคับ
- merge duplicate manufacturer/model/SKU ผ่าน controlled operation
- จัดการ storage policy, scan policy และ readiness policy
- เปิด emergency access แบบ time-bound และมี audit

Super Admin ไม่ควรใช้เป็นบัญชีทำงานประจำวัน และไม่ควรลบ audit trail หรือ historical revision ได้

## Permission matrix

| Action | Account Admin | Reviewer | Super Admin |
| --- | :---: | :---: | :---: |
| Create/edit product or SKU draft | ✓ scoped | View | ✓ |
| Run approved import profile | ✓ scoped | View | ✓ |
| Edit import/schema template | — | — | ✓ |
| Upload/replace draft Datasheet | ✓ scoped | View | ✓ |
| Verify extracted field | Propose | ✓ | ✓ |
| Publish engineering revision | — | ✓ | ✓ |
| Recall published revision | — | Request | ✓ |
| Invite/suspend Account Admin | — | — | ✓ |
| Assign Super Admin | — | — | ✓, step-up auth required |
| View organization audit | ✓ scoped | ✓ scoped | ✓ all |
| Hard delete published/history data | — | — | — |

## Best journey

### A. First sign-in and orientation

1. Super Admin sends an invitation from a trusted server action.
2. User accepts invite, signs in and sees role + organization scope in plain language.
3. Home page shows work queues, not generic metrics:
   - Needs attention
   - Imports in progress
   - Waiting for my review
   - Recently edited drafts
4. Primary actions are `เพิ่มสินค้า 1 รายการ` and `นำเข้าหลายรายการ`.

### B. Add one product

1. Choose category: PV Module, Inverter; future categories come from versioned configuration.
2. Search manufacturer + exact model first to prevent duplicates.
3. Enter minimum identity fields and create a draft.
4. Add one or more variants/SKUs; each SKU must be unique.
5. Upload Datasheet or explicitly mark `ยังไม่มี Datasheet` with an actionable blocking state.
6. System hashes/scans the file and extracts proposed values.
7. Admin resolves blocking fields and submits for review.
8. Reviewer compares PDF and fields, then approves or rejects with reason.
9. Publish creates an immutable revision and updates readiness.

### C. Bulk import products and SKUs

The import wizard has six explicit steps:

1. **Choose scope** — category, organization and import mode: `Create only`, `Update only`, or `Create or update`.
2. **Download template / Upload file** — CSV and XLSX; show template version and examples.
3. **Map columns** — auto-match known headers, display unmatched/duplicate columns, allow saved mapping profile.
4. **Dry run** — no canonical writes; classify each row as Create, Update, No change, Warning, or Error.
5. **Review impact** — totals, sample changes, duplicate matches, overwritten fields and downloadable issue file.
6. **Commit to drafts** — background job writes valid staged rows as drafts; invalid rows remain downloadable/retryable.

Import safety rules:

- Default mode is `Create only`; destructive overwrite is never preselected.
- File SHA-256 + idempotency key prevent accidental duplicate execution.
- Import identifies records by immutable ID when available; SKU/exact model matching is shown before commit.
- Blank cells mean `no change` by default, not deletion. Clearing a value requires an explicit token/action.
- Engineering fields cannot be marked verified by import.
- Every row has raw input, normalized input, decision, actor and outcome.
- Partial success is allowed only after dry run; committed rows are grouped by product and transactional per product.
- Error CSV/XLSX includes row, field, code, message and suggested correction.

### D. Attach and verify Datasheets

1. Drag one or many PDFs into an upload tray.
2. Auto-match candidate products from exact model/filename, but require confirmation.
3. Duplicate SHA shows `ไฟล์นี้มีอยู่แล้ว` and offers linking instead of re-upload.
4. States are visible: Uploading → Scanning → Extracting → Needs review → Verified → Published.
5. Review screen keeps PDF page and normalized fields visible together.
6. Each critical value records value, unit, source page/section, reviewer and timestamp.
7. Reject returns the task to the contributor with field-level comments.
8. Replacement always creates a new revision; published files are not overwritten.

## Information architecture

```text
/admin
├── work-queue
├── catalog
│   ├── products
│   ├── products/new
│   └── products/[productId]
│       ├── overview
│       ├── variants-skus
│       ├── engineering-specs
│       ├── datasheets
│       └── history
├── imports
│   ├── new
│   └── [importJobId]
├── reviews
│   └── [reviewTaskId]
├── assets
├── users                 # Super Admin
├── catalog-settings      # Super Admin
└── audit                 # Super Admin
```

## Screen and interaction specification

### Work queue

- One searchable queue with saved views: `My drafts`, `Import errors`, `Awaiting review`, `Scan failed`, `Ready to publish`.
- Each row answers: what item, what blocks it, who owns it, last change, next action.
- Bulk actions appear only after selection and only if the role permits them.
- Empty state offers the next task, not a decorative card.

### Product list

- Search by exact model, SKU, manufacturer and Datasheet revision.
- Filters: category, readiness, verification state, Datasheet state, organization and updated date.
- Columns are customizable but retain identity/status/action on mobile.
- `Needs attention` groups issues by cause and supports download.

### Product workspace

- Persistent header: manufacturer, exact model, category, readiness, current revision and owner.
- Tabs separate identity, variants/SKUs, engineering specs, Datasheets and history.
- Autosave drafts with visible save state; publishing is a separate explicit action.
- Critical fields show unit and source inline; no source hidden in a tooltip.
- Sticky action bar shows only valid next actions for role and state.

### Import result

- Summary shows Created / Updated / Unchanged / Warning / Error.
- Row table supports issue filters and keyboard navigation.
- Cell-level errors use icon + text and link to correction guidance.
- Retry creates a new import job linked to the previous one; history is immutable.

### Responsive behavior

- 1440px: queue + detail split view; PDF and field verification side-by-side.
- 768px: single primary pane with collapsible context panel.
- 390px: records become stacked label/value cards; mapping becomes source-field → target-field rows; sticky primary action remains reachable.
- No action is removed on mobile, but large import previews show a focused issue list before the full table.
- Keyboard focus, 44px targets, screen-reader labels and non-color status cues are mandatory.

## Readiness model

Do not use one percentage as the publish decision. Show three layers:

1. **Blocking gates** — unique identity, clean file, exact category-required electrical fields, units, source page and reviewer.
2. **Completeness** — optional content such as image, localized description and commercial metadata.
3. **Warnings** — unusual values, duplicate candidate, old revision or low extraction confidence.

Publish is enabled only when blocking gates pass. Completeness below 100% may still publish if missing fields are explicitly non-critical.

## Supabase identity and authorization design

- Supabase Auth owns authentication; application roles live in Postgres.
- Use invite/magic-link or password flow; admin creation/invitation runs server-side only.
- Add coarse role/scope claims with a Custom Access Token Hook for UI routing.
- Enforce every read/write again with Postgres RLS and permission functions.
- `service_role` / secret key never reaches the browser and is not an Admin login mechanism.
- Private Datasheets use Storage RLS and short-lived signed URLs.
- Step-up authentication is required for assigning Super Admin, recall and emergency actions.

Recommended identity tables:

- `user_profile(id -> auth.users.id, display_name, status)`
- `organization(id, name, type, status)`
- `organization_member(id, organization_id, user_id, status, invited_by)`
- `role(id, code, scope_type)`
- `permission(id, code)`
- `role_permission(role_id, permission_id)`
- `role_assignment(id, user_id, role_id, organization_id nullable, granted_by, expires_at)`

`organization_id` is required for organization roles and must be null for platform roles. Index every foreign key and enforce unique active assignments.

## Catalog and import data model

Add after the identity migration:

- `product_variant(id, product_model_id, sku, variant_label, status, created_by, updated_at)`
- `import_template(id, category, version, schema_json, state)`
- `import_job(id, organization_id, template_id, mode, state, file_asset_id, file_sha256, mapping_json, totals_json, created_by, started_at, finished_at)`
- `import_row(id, import_job_id, row_number, raw_json, normalized_json, proposed_action, state, target_product_id, target_variant_id)`
- `import_issue(id, import_row_id, field_path, severity, code, message, suggestion)`
- `review_task(id, entity_type, entity_id, state, submitted_by, assigned_to, decided_by, decision_reason)`
- `audit_event(id, actor_id, organization_id, action, entity_type, entity_id, before_json, after_json, request_id, created_at)`

Constraints:

- Canonical SKU is unique case-insensitively.
- `row_number` is unique within an import job.
- A file hash + organization + template version can be committed only once unless explicitly retried.
- Reviewer cannot approve their own submission when four-eyes policy is enabled.
- Published/recalled records are never hard-deleted.
- Audit events are append-only.

## Delivery slices

### A0 — Identity replacement

- Supabase Auth session, invitation and sign-in
- Account Admin / Reviewer / Super Admin permissions
- RLS for catalog and Storage
- Remove browser-entered `EASYSOLAR_ADMIN_TOKEN`

### A1 — Single product and Datasheet journey

- Product/variant draft
- Private upload + scan + extraction states
- Review queue, field provenance, approve/reject/publish
- Audit events

### A2 — Safe bulk import

- Versioned templates
- CSV/XLSX upload, mapping, dry run, staging and issue report
- Commit valid drafts and retry failed rows

### A3 — Catalog operations at scale

- Saved views, bulk edit, duplicate merge, readiness policy
- Datasheet batch matching
- Background job observability and notifications

### A4 — Commerce mapping

- Merchant-neutral variant ↔ sellable item ↔ merchant SKU
- Effective-dated price and inventory snapshots
- Marketplace publication remains separate from engineering verification

## Acceptance criteria for the next implementation slice

- Given an Account Admin, when they upload a valid PDF, the file is private and cannot be published before scan and review.
- Given three roles, unauthorized UI actions are hidden and direct API/database attempts are rejected by RLS.
- Given a CSV/XLSX, dry run makes zero canonical writes and reports every invalid row with field-level guidance.
- Given a duplicate SKU or exact-model candidate, commit pauses that row and requires an explicit match/create decision.
- Given a published Datasheet revision, replacement creates a new revision and historical calculations still resolve the old revision.
- Given a 390px viewport, every workflow remains usable without horizontal page overflow.

## Decisions and data needed from the owner

1. EasySolar จะเป็น single organization หรือให้ supplier/merchant แต่ละรายมี organization ของตนเองตั้งแต่แรก
2. รายชื่อผู้ใช้เริ่มต้นและผู้ที่จะถือ Super Admin
3. เปิด four-eyes approval ตั้งแต่ MVP หรืออนุญาตให้ Super Admin self-approve พร้อมเหตุผล
4. SKU เป็นรหัสกลาง EasySolar, รหัสผู้ผลิต หรือทั้งสองค่าแยกกัน
5. Category แรกนอกจาก PV Module และ Inverter เช่น Battery, Optimizer, Mounting/BOS
6. Required fields และหน่วยต่อ category ที่วิศวกร owner อนุมัติ
7. รองรับ CSV อย่างเดียวก่อน หรือ CSV + XLSX ใน release แรก
8. ขนาด batch โดยประมาณและจำนวน SKU เริ่มต้น
9. Datasheet languages, สิทธิ์การใช้งานไฟล์ และ retention requirement
10. Email sender/domain สำหรับ Supabase invitation และ redirect URLs ของ Vercel
