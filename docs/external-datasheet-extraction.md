# External Datasheet Extraction

EasySolar ใช้ ChatGPT หรือ AI ภายนอกเพื่ออ่าน Datasheet ในระยะแรก ระบบไม่ส่งไฟล์ไปยัง GPT และไม่มี GPT API

## ขั้นตอนทำงาน

1. ผู้ดูแลดาวน์โหลด Prompt และ Template กลางจากหน้า `/admin/equipment`
2. ผู้ดูแลแนบ ZIP ที่รวม Datasheet PDF กับ Template ใน Chat ภายนอก แล้ววาง Prompt
3. AI อ่านทุก PDF แยกกันและคืนไฟล์ `.easysolar.json` ให้ดาวน์โหลดหนึ่งไฟล์ต่อ PDF
4. ผู้ดูแลเลือก PDF ต้นฉบับและ JSON ผลลัพธ์หลายคู่พร้อมกัน ระบบจับคู่ด้วย
   `source_document.filename` และแยกแจ้งคู่ที่ขาด ซ้ำ หรือไม่ตรงกัน
5. EasySolar ตรวจ schema, version, field keys, ชนิดข้อมูล, หน่วย, ช่วงค่า, เลขหน้า และชื่อ PDF
6. ระบบนำเข้าเฉพาะคู่ที่ผ่าน preflight แต่ละคู่ คู่ที่ผิดไม่ทำให้รายการอื่นใน batch ล้ม
7. ระบบเก็บ PDF แต่ละชุดและสร้าง Draft revision แยกตาม Model
8. ผู้ดูแลเปิด Draft แต่ละรายการ ตรวจค่าที่ prefill จาก JSON และบันทึกสเปก
9. Reviewer ตรวจและ Publish ผ่าน workflow เดิม

EasySolar ไม่เปลี่ยนค่าจาก GPT เป็น verified หรือ published โดยอัตโนมัติ

## ไฟล์กลาง

- `/easysolar-extraction/easysolar-extraction-prompt-v1.txt`
- `/easysolar-extraction/easysolar-pv-module-extraction-v1.json`
- `/easysolar-extraction/easysolar-inverter-extraction-v1.json`

Prompt, template และ output schema ใช้ version แยกกัน ผลลัพธ์ต้องระบุ `schema_version`, `template_version` และ `prompt_version` ที่ระบบรองรับ

Prompt v1.2 รับ ZIP หนึ่งไฟล์ ไล่อ่าน PDF ทุกโฟลเดอร์ และสร้างไฟล์ JSON แยกตามจำนวน PDF
โดยไม่รวมผลลัพธ์หลาย PDF เป็น JSON ก้อนเดียว ชื่อ PDF ภายใน ZIP ต้องไม่ซ้ำกัน

เวอร์ชัน 1.1 รองรับการประกอบ exact model สำหรับ PV Module ด้วยกฎ
`power_variant_substitution` เท่านั้น โดยต้องมี product family, คอลัมน์กำลังไฟของแต่ละรุ่น
และ complete anchor model จากเนื้อหา PDF หรือชื่อไฟล์ PDF ระบบเก็บ `identifier_provenance`
ไว้ใน raw JSON และผู้ดูแลต้องตรวจ model ที่มี `method: "composed"` ก่อนบันทึกสเปก
Inverter template ไม่อนุญาตให้ประกอบ model identifier

## กติกาข้อมูล

- PDF หนึ่งไฟล์สร้าง asset เดียว แต่ asset เชื่อมกับ Draft revision ได้หลายรายการ
- `exact_model` ต้องไม่ซ้ำภายในไฟล์ผลลัพธ์
- ทุก model ต้องระบุ `identifier_provenance`; model ที่ประกอบขึ้นต้องใช้กฎที่ template อนุญาตและมีหลักฐานจาก PDF
- ทุก field ใน Template ต้องอยู่ในผลลัพธ์ แม้ AI ไม่พบค่า
- ค่าที่ไม่พบใช้ `value: null` และ `status: "not_found"`
- ค่าที่คลุมเครือหรือขัดแย้งไม่ถูกนำไป prefill
- ค่าที่มีข้อมูลต้องมี `source_page`
- ค่า `derived` ต้องมี `formula` และ `input_fields`
- EasySolar เก็บ raw JSON เพื่อ audit แต่ canonical spec เกิดจากฟอร์มตรวจของผู้ดูแลเท่านั้น

## ข้อจำกัดของรุ่นแรก

- ZIP ที่ส่งให้ AI ต้องใช้ Template เดียวกันทั้งชุดและมีชื่อ PDF ไม่ซ้ำกัน
- Batch import ของ EasySolar รับได้สูงสุด 50 PDF และ 50 JSON ต่อครั้ง
- รองรับ PV Module และ Inverter ไม่เกิน 50 Models ต่อ PDF
- PDF มีขนาดไม่เกิน 25 MB และ JSON มีขนาดไม่เกิน 1 MB
- ชื่อ PDF ต้องตรงกับ `source_document.filename` ใน JSON
- ระบบตรวจว่าเลขหน้าอ้างอิงไม่เกิน `source_document.page_count` แต่ยังไม่ได้นับหน้าจากไฟล์ PDF โดยตรง
- หากอัปโหลดไป Object Storage ไม่สำเร็จ Draft จะค้างในสถานะรอไฟล์และต้องลบหรือลองใหม่ผ่านงานดูแลระบบ
