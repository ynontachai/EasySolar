# UX/UI Handoff

## Visual thesis

Solar Precision: ผสม Swiss grid ที่โปร่งและเป็นระเบียบกับ engineering schematic โดยใช้ Kanit ทั้งระบบ พื้น navy/off-white, cobalt สำหรับข้อมูลและ focus, solar orange เฉพาะ CTA/energy flow และยังไม่ให้สถานะความปลอดภัยพึ่งสีเพียงอย่างเดียว

## Information architecture

- `/` — product promise, trust model และ entry points
- `/equipment` — source-aware catalog
- `/checker` — inputs, candidate configurations, rule trace และ print report
- `/admin/equipment` — read-only verification workflow scaffold

## Key interaction rules

- Checker ใช้ client state เฉพาะ inputs/candidate selection; authoritative calculation ส่งไป server endpoint
- Status แสดง icon + text ทุกครั้ง ไม่ใช้สีอย่างเดียว
- Design assumptions และหน่วยอยู่ข้าง field ไม่ซ่อนใน tooltip
- Candidate layout แสดง `Ns × Np` แยกทุก MPPT
- Result ที่ข้อมูลไม่ครบยังแสดงค่าที่คำนวณได้ แต่ต้องคงสถานะ `INSUFFICIENT_DATA`
- Print view ตัด navigation/controls และคง result, rule trace, revision และ disclaimer

## Responsive behavior

- ≥980px: sticky input rail + result workspace
- <980px: input rail อยู่เหนือ result และไม่ sticky
- <620px: ตาราง rule trace reflow เป็น label/value blocks; ซ่อนข้อมูล candidate รองที่ไม่จำเป็น
- Core actions มี keyboard focus ที่เห็นได้ และรองรับ reduced motion

## Required states

มี loading, validation error, no candidate, incomplete data, hard fail, warning, success และ disabled publish ใน scaffold; authentication/unauthorized/offline เป็นงานถัดไปเมื่อเปิด persistence
