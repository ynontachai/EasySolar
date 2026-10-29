# EasySolar System Context

```mermaid
C4Context
  title System Context - EasySolar Decision Platform

  Person(solarBuyer, "Solar buyer", "ประเมิน Energy Fit และข้อเสนอ Solar")
  Person(professional, "EPC / installer / engineer", "ค้นสเปก คำนวณ และสร้าง Package")
  Person(reviewer, "Data reviewer", "ตรวจ Datasheet และ policy ก่อน publish")

  System(easySolar, "EasySolar", "Solar decision, engineering and package platform")
  System_Ext(objectStorage, "Object storage", "เก็บ Datasheet, report และ attachment")
  System_Ext(malwareScanner, "File scanning service", "ตรวจไฟล์ก่อนเปิดใช้งาน")
  System_Ext(policySources, "Tariff / export / solar sources", "แหล่ง policy และสมมติฐานที่มี version")
  System_Ext(marketplace, "Marketplace", "รับ package และเชื่อม merchant offers ในอนาคต")

  Rel(solarBuyer, easySolar, "กรอกข้อมูลและอ่านผลประเมิน", "HTTPS")
  Rel(professional, easySolar, "ค้นสเปก คำนวณ และสร้าง Package", "HTTPS")
  Rel(reviewer, easySolar, "Upload, verify and publish", "HTTPS")
  Rel(easySolar, objectStorage, "Upload/download private assets", "Signed HTTPS")
  Rel(easySolar, malwareScanner, "ส่งไฟล์ตรวจและรับสถานะ", "API/Event")
  Rel(easySolar, policySources, "นำเข้า policy พร้อม provenance", "Scheduled/API")
  Rel(easySolar, marketplace, "ส่ง package reference และอ่าน offers", "API, future")
```

## Boundary

EasySolar owns canonical equipment, versioned policies, deterministic calculations, projects and packages. Object bytes, scanning and future Marketplace transaction processing remain external boundaries. Marketplace price or stock cannot influence engineering safety findings.
