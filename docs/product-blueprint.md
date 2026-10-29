# EasySolar Product Blueprint

## Product intent

EasySolar เป็น Solar decision platform สำหรับประเทศไทยที่ช่วยให้ผู้ใช้เห็นว่า “คำตอบมาจากไหน” ก่อนตัดสินใจด้านอุปกรณ์ การออกแบบ หรือการลงทุน โดยไม่ทำให้ข้อมูลที่ขาดดูเหมือนเป็นความแน่นอน

## User groups and value

### 1. EPC, installer และ solar engineer

ต้องการลดเวลาค้นสเปก ตรวจความเข้ากันได้ และอธิบายเหตุผลของแบบให้ทีม ลูกค้า และผู้ตรวจทานได้

### 2. เจ้าของบ้านและเจ้าของธุรกิจ

ต้องการทราบว่าขนาดระบบ ราคา ผลประหยัด และระยะคืนทุนในข้อเสนอสมเหตุสมผลหรือไม่ รวมถึงรู้ว่าควรถามผู้เสนอราคาเรื่องใดต่อ

### 3. Data reviewer และ administrator

ต้องการควบคุมแหล่งข้อมูล revision สถานะ verification และประวัติการแก้ไข เพื่อให้ผลคำนวณย้อนหลังได้

## Product architecture

ข้อมูลกลาง เช่น equipment revision, tariff policy, solar resource assumption และ calculation policy ใช้ร่วมกันได้ แต่ประสบการณ์ต้องแยกตามงานของผู้ใช้:

- **Professional Workspace:** รายละเอียดเชิงวิศวกรรม, rule trace, MPPT, revision และ preliminary report
- **Solar Value Assessment:** ภาษาที่เข้าใจง่าย, ช่วงผลลัพธ์, confidence, sensitivity, red flags และคำถามสำหรับผู้เสนอราคา
- **Data Governance:** verification queue, source provenance, audit log และ publishing control

ผลจาก Consumer flow ห้ามถูกนำเสนอเป็น final engineering approval, financial advice หรือการรับรองผู้ติดตั้ง

## Feature map

| Epic | Capability | Primary value | Status |
| --- | --- | --- | --- |
| E1 | Equipment intelligence | ค้น exact model, revision, datasheet และ verification state | Scaffold |
| E2 | Compatibility and string sizing | ตรวจ voltage/current/power/topology พร้อม rule trace | Working prototype |
| E3 | Professional project workspace | บันทึกโครงการ เปรียบเทียบแบบ แชร์และออกรายงาน | Planned |
| E4 | Solar Value Assessment | ประเมินขนาดระบบ ราคา ผลประหยัด คืนทุน และความสมเหตุสมผล | Five-step input form implemented; engine pending |
| E5 | Quote comparison and due diligence | เทียบข้อเสนอภายใต้สมมติฐานเดียวกันและชี้ red flags | Planned after E4 |
| E6 | Data governance | Review, approval, provenance, audit และ policy versioning | Admin scaffold |
| E7 | Account and collaboration | Role, organization, saved projects และ controlled sharing | Planned |
| E8 | File and document platform | Upload, scan, version, preview และ signed download | Planned foundation |
| E9 | Package Builder | Customized BOM พร้อม engineering validation และ immutable versions | Planned |
| E10 | Commerce mapping | เชื่อม canonical equipment กับ seller SKU, price และ inventory | Future Marketplace foundation |

## Solar Value Assessment requirements

### Inputs

- บิลค่าไฟย้อนหลัง ค่า Ft และประเภทมิเตอร์
- จังหวัด ประเภทอาคาร และพฤติกรรมใช้ไฟรายช่วงเวลา
- ข้อมูลหลังคา พื้นที่ ทิศทาง เงาบัง และข้อจำกัดเท่าที่ผู้ใช้ทราบ
- ขนาดระบบ รายการอุปกรณ์ ราคา การรับประกัน และสมมติฐานในใบเสนอราคา
- Financing, degradation, maintenance และ escalation assumptions เมื่อใช้

### Outputs

- Suggested size range และเหตุผล ไม่ใช่ขนาดเดียวแบบตายตัว
- Annual generation, self-consumption, export และ bill saving เป็นช่วง
- Simple payback; NPV/IRR แสดงเมื่อข้อมูลและนโยบายเพียงพอ
- Sensitivity ต่อค่าไฟ ผลผลิต การใช้ไฟกลางวัน degradation และต้นทุน
- Price reasonableness แยกเป็น benchmark range พร้อมวันที่และแหล่งข้อมูล
- Confidence/coverage, missing data, red flags และคำถามที่ควรถามผู้เสนอราคา
- Scenario comparison และ downloadable assessment snapshot

### Core business rules

- ห้ามแสดงคำว่า “คุ้ม” จาก simple payback เพียงค่าเดียว
- Actual bill profile มีน้ำหนักเหนือค่าเฉลี่ยทั่วไป และต้องบอกเมื่อใช้ proxy
- ผลประหยัดต้องแยก self-consumption กับ export และใช้ tariff policy ที่มี version
- Benchmark ราคาต้องมี geography, system size band, equipment tier, date และ source coverage
- ทุกผลลัพธ์ต้องผูกกับ input snapshot, assumption set และ calculation version
- Missing critical input ต้องลด confidence และห้ามแสดงผลแบบ precise point estimate

## Release slices

### Slice 0 — Foundation (current)

Full-bleed responsive canvas, dual-audience information architecture, public navigation, product contract และ responsive five-step input form สำหรับ Solar Value Assessment โดยยังไม่แสดงผลคำนวณที่ไม่มี policy รองรับ

### Slice 1 — Trusted professional baseline

วาง PostgreSQL + private object storage, นำเข้ารุ่นอุปกรณ์จริงชุดแรก, upload/scan/download Datasheet, verification workflow, golden calculation fixtures และ report contract ที่วิศวกร owner อนุมัติ

### Slice 2 — Solar Value MVP

รับบิล 3 เดือน, จำนวนคน 4 ช่วงเวลา, การใช้เครื่องปรับอากาศ, Normal/TOU และ export intent เพื่อคำนวณ Energy Fit, suggested size, self-consumption, annual value range, confidence และ explanation โดยยังไม่สรุป ROI หากไม่มีราคาติดตั้ง

### Slice 3 — Proposal reasonableness

เพิ่ม Professional project และ Package Builder ก่อนรับรายละเอียดใบเสนอราคา/ราคา Package เพื่อคำนวณ Financial Reasonableness, เปรียบเทียบ sizing/value และสร้าง question/red-flag report

### Slice 4 — Saved projects and collaboration

บัญชีผู้ใช้, organization, project history, controlled sharing และ export ที่ตรวจย้อนหลังได้

### Slice 5 — Marketplace integration

แยก canonical engineering catalog ออกจาก sellable item, merchant offer, effective-dated price และ inventory snapshot ก่อนเปิด order/payment scope

## Success measures

- ผู้ใช้ระบุได้ว่าผลลัพธ์ใช้ข้อมูลจริงหรือสมมติฐานใดภายใน 30 วินาที
- Professional result ทุกชุดย้อนกลับถึง equipment revision และ engine version ได้
- Consumer assessment ทุกชุดแสดง range, confidence และ missing data
- ผู้ใช้ทำ assessment หลักจบได้บนมือถือโดยไม่ต้องรู้ศัพท์วิศวกรรม
- ไม่เกิด published result จาก unverified critical equipment data

## Decisions required before Slice 2

- รูปแบบบิล/ประเภทมิเตอร์และ tariff source of truth ที่รองรับในรุ่นแรก
- วิธีสร้าง hourly/daytime usage proxy เมื่อมีเพียงบิลรายเดือน
- Solar resource/yield model และ degradation policy
- Financial metric policy รวม tax, financing และ maintenance หรือไม่
- เจ้าของ benchmark ราคา แหล่งข้อมูล ความถี่อัปเดต และข้อจำกัดด้านกฎหมาย
- ข้อความ disclaimer ที่ผ่านการทบทวนด้านวิศวกรรม การเงิน และกฎหมาย

See [Journey–Feature Alignment](journey-feature-map.md) and [Data and File Architecture](data-architecture-plan.md) for the implementation contract.
