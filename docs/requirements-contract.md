# EasySolar — Requirements Contract

## Outcome

ช่วย EPC, installer และ solar engineer ตรวจสอบ PV module–inverter compatibility และหา candidate string layout เบื้องต้นได้เร็วขึ้น โดยทุกคำตอบอ้างกลับไปยัง exact model, datasheet revision, เงื่อนไข และ engine version ได้

Product horizon เพิ่มเส้นทางสำหรับเจ้าของบ้านและเจ้าของธุรกิจ เพื่อประเมินว่าขนาดระบบ ราคา ผลประหยัด และผลตอบแทนของข้อเสนอ Solar สมเหตุสมผลหรือไม่ โดยต้องแสดงช่วงผลลัพธ์ สมมติฐาน ความไม่แน่นอน และข้อมูลที่ยังขาด ส่วนรายละเอียด Feature map และ release slices อยู่ใน [product blueprint](product-blueprint.md)

## Confirmed scope

- TH-first, browser-first และใช้ public checker ได้โดยไม่ต้อง sign in
- ค้นหา panel/inverter ตาม exact model และ revision
- ประเมิน cold Voc, hot/cold Vmp, startup, current, Isc, DC power และ topology แยกทุก MPPT
- แสดงผลรายกฎเป็น `PASS`, `FAIL`, `INCOMPLETE` หรือ `WARNING`
- Overall status จำกัดเป็น `PRELIMINARY_COMPATIBLE`, `INCOMPATIBLE`, `INSUFFICIENT_DATA`
- แสดง candidate มากกว่าหนึ่งแบบและพิมพ์ preliminary report ได้
- ข้อมูลที่ขาดหรือยังไม่ verified ห้ามให้ผล compatible

## Out of scope

สำหรับ Professional MVP ปัจจุบันยังไม่รวม cable/protection/SPD/earthing, structural/fire, AC/grid, energy yield, battery, permitting, marketplace, billing, EPC matching และ final engineering approval

Solar Value Assessment มี input flow และ local draft แล้ว แต่ยังไม่อยู่ใน calculation scope ปัจจุบัน และห้ามแสดงตัวเลขจำลองจนกว่า tariff, usage profile, yield และ financial policy จะมี versioned source of truth

## Business rules

- **BR-001:** สต็อก สปอนเซอร์ และ commercial relationship ไม่มีผลต่อผลคำนวณหรืออันดับด้านความปลอดภัย
- **BR-002:** ตัวเลขทุกค่าต้องผูกกับ source + revision; ประวัติเดิมใช้ immutable snapshot
- **BR-003:** OCR/LLM เติมได้เฉพาะ draft และ publish ไม่ได้จนกว่ามนุษย์ตรวจ
- **BR-004:** Hard fail ใด ๆ ต้องทำให้ผลรวมเป็น `INCOMPATIBLE`
- **BR-005:** Missing/unverified critical data ต้องทำให้ผลรวมเป็น `INSUFFICIENT_DATA`
- **BR-006:** Current, voltage และ topology ประเมินแยกต่อ MPPT ห้ามอนุมานว่า physical inputs คือ independent trackers
- **BR-007:** Consumer result ต้องแสดงเป็นช่วงพร้อม confidence/missing data และห้ามสรุปความคุ้มค่าจาก simple payback ค่าเดียว
- **BR-008:** Professional และ Consumer experiences ใช้ข้อมูลกลางร่วมกันได้ แต่ต้องแยกภาษา ระดับรายละเอียด disclaimer และ decision boundary

## Acceptance slice implemented in this scaffold

1. Guest เปิด checker และเห็น equipment revision/status ชัดเจน
2. เปลี่ยน cell temperature, Isc factor และ target DC power แล้วประเมินผ่าน server API ได้
3. Same input + same engine version ให้ candidate และ findings เหมือนเดิม
4. Demo/unverified record ไม่สามารถออก `PRELIMINARY_COMPATIBLE`
5. ผลแสดง Ns/Np, module count, kWp, DC/AC ratio และ trace รายกฎ
6. หน้า result พิมพ์เป็น preliminary report พร้อมคำเตือนขอบเขตได้
7. Admin scaffold แสดงเหตุผลที่ record ซึ่งไม่มี source publish ไม่ได้

## Open decisions before real catalog work

- รายการ 10–20 รุ่นแรกและสิทธิ์การใช้ datasheet
- วิศวกรผู้เป็น owner ของ rule policy และ golden fixtures
- Site temperature/default current factor policy
- PostgreSQL provider, identity provider และ reviewer roles
- ถ้อยคำ legal disclaimer ฉบับที่ที่ปรึกษากฎหมายและวิศวกรยอมรับ
