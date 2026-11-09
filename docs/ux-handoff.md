# UX/UI Handoff

## Visual thesis

Solar Precision: ผสม Swiss grid ที่โปร่งและเป็นระเบียบกับ engineering schematic โดยใช้ Kanit ทั้งระบบ พื้น navy/off-white, cobalt สำหรับข้อมูลและ focus, solar orange เฉพาะ CTA/energy flow และยังไม่ให้สถานะความปลอดภัยพึ่งสีเพียงอย่างเดียว

## Information architecture (current production slice)

- `/` — EPC-first single page: equipment selection, verified spec, formula trace, per-MPPT layout และ gated engineer-review CTA
- Public legacy routes redirect มาที่ `/` ชั่วคราว; source pages ยังอยู่เพื่อให้ rollback ได้
- `/admin/equipment` — read-only verification workflow scaffold

Public navigation แสดง `สำหรับมืออาชีพ`, `ประเมินโซลาร์` และ `คลังอุปกรณ์`; Admin ไม่อยู่ใน public navigation และจะกลับมาเมื่อมี authentication/authorization

## Key interaction rules

- Checker ใช้ client state เฉพาะ inputs/candidate selection; authoritative calculation ส่งไป server endpoint
- Status แสดง icon + text ทุกครั้ง ไม่ใช้สีอย่างเดียว
- Design assumptions และหน่วยอยู่ข้าง field ไม่ซ่อนใน tooltip
- Candidate layout แสดง `Ns × Np` แยกทุก MPPT
- Result ที่ข้อมูลไม่ครบยังแสดงค่าที่คำนวณได้ แต่ต้องคงสถานะ `INSUFFICIENT_DATA`
- Result ที่ขาด safety-critical data ต้องไม่แสดง candidate หรือ order CTA และต้องบอก blocker เป็นข้อความ
- Formula ใช้หน่วยตาม Datasheet (`%/°C`) และแสดง `÷100`; internal fraction ห้ามโผล่เป็นค่าที่ผู้ใช้ต้องตีความเอง
- MPPT แสดง series range, current และ physical input แยก tracker
- Print view ตัด navigation/controls และคง result, rule trace, revision และ disclaimer

## Responsive behavior

- Root canvas และ branded sections ต้อง full-bleed ที่ทุก viewport; จำกัดความกว้างเฉพาะ inner content
- Landing hero สูงอย่างน้อยหนึ่ง viewport บน desktop และ reflow โดยไม่เกิด horizontal overflow
- ทุก route ต้องผ่าน responsive matrix ที่ 390px, 768px และ 1440px โดยไม่มี horizontal overflow, action ที่แตะไม่ได้ หรือข้อมูลสำคัญหายไป
- Public navigation เปลี่ยนเป็น keyboard-accessible menu ที่ความกว้างต่ำกว่า 900px; ห้ามซ่อน navigation โดยไม่มีทางเลือกทดแทน
- ≥980px: sticky input rail + result workspace
- <980px: input rail อยู่เหนือ result และไม่ sticky
- <620px: ตาราง rule trace reflow เป็น label/value blocks; ซ่อนข้อมูล candidate รองที่ไม่จำเป็น
- Core actions มี keyboard focus ที่เห็นได้ และรองรับ reduced motion

## Required states

มี loading, validation error, no candidate, incomplete data, hard fail, warning, success และ disabled publish ใน scaffold; authentication/unauthorized/offline เป็นงานถัดไปเมื่อเปิด persistence

Solar Value Assessment ต้องมี draft, insufficient bill data, proxy usage profile, scenario range, benchmark unavailable, calculation error และ version-expired states ก่อนเปิดใช้จริง
