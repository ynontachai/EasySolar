# External Datasheet Extraction

EasySolar ใช้ ChatGPT หรือ AI ภายนอกเพื่ออ่าน Datasheet ในระยะแรก ระบบไม่ส่งไฟล์ไปยัง GPT และไม่มี GPT API

## ขั้นตอนทำงาน

1. ผู้ดูแลดาวน์โหลด Prompt และ Template กลางจากหน้า `/admin/equipment`
2. ผู้ดูแลแนบ Datasheet PDF กับ Template ใน Chat ภายนอก แล้ววาง Prompt
3. AI ส่งผลลัพธ์เป็น JSON โดยแยกข้อมูลตาม exact model
4. ผู้ดูแลอัปโหลด PDF ต้นฉบับและ JSON ผลลัพธ์พร้อมกัน
5. EasySolar ตรวจ schema, version, field keys, ชนิดข้อมูล, หน่วย, ช่วงค่า, เลขหน้า และชื่อ PDF
6. ระบบเก็บ PDF หนึ่งชุดและสร้าง Draft revision แยกตาม Model
7. ผู้ดูแลเปิด Draft แต่ละรายการ ตรวจค่าที่ prefill จาก JSON และบันทึกสเปก
8. Reviewer ตรวจและ Publish ผ่าน workflow เดิม

EasySolar ไม่เปลี่ยนค่าจาก GPT เป็น verified หรือ published โดยอัตโนมัติ

## ไฟล์กลาง

- `/easysolar-extraction/easysolar-extraction-prompt-v1.txt`
- `/easysolar-extraction/easysolar-pv-module-extraction-v1.json`
- `/easysolar-extraction/easysolar-inverter-extraction-v1.json`

Prompt, template และ output schema ใช้ version แยกกัน ผลลัพธ์ต้องระบุ `schema_version`, `template_version` และ `prompt_version` ที่ระบบรองรับ

## กติกาข้อมูล

- PDF หนึ่งไฟล์สร้าง asset เดียว แต่ asset เชื่อมกับ Draft revision ได้หลายรายการ
- `exact_model` ต้องไม่ซ้ำภายในไฟล์ผลลัพธ์
- ทุก field ใน Template ต้องอยู่ในผลลัพธ์ แม้ AI ไม่พบค่า
- ค่าที่ไม่พบใช้ `value: null` และ `status: "not_found"`
- ค่าที่คลุมเครือหรือขัดแย้งไม่ถูกนำไป prefill
- ค่าที่มีข้อมูลต้องมี `source_page`
- ค่า `derived` ต้องมี `formula` และ `input_fields`
- EasySolar เก็บ raw JSON เพื่อ audit แต่ canonical spec เกิดจากฟอร์มตรวจของผู้ดูแลเท่านั้น

## ข้อจำกัดของรุ่นแรก

- รองรับ PV Module และ Inverter ไม่เกิน 50 Models ต่อ PDF
- PDF มีขนาดไม่เกิน 25 MB และ JSON มีขนาดไม่เกิน 1 MB
- ชื่อ PDF ต้องตรงกับ `source_document.filename` ใน JSON
- ระบบตรวจว่าเลขหน้าอ้างอิงไม่เกิน `source_document.page_count` แต่ยังไม่ได้นับหน้าจากไฟล์ PDF โดยตรง
- หากอัปโหลดไป Object Storage ไม่สำเร็จ Draft จะค้างในสถานะรอไฟล์และต้องลบหรือลองใหม่ผ่านงานดูแลระบบ
