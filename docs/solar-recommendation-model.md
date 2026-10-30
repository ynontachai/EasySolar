# Solar Recommendation MVP

## Product decision

หน้าผลประเมินต้องตอบคำถามตามลำดับดังนี้:

1. เริ่มพิจารณาระบบขนาดกี่ kW
2. ระบบผลิตไฟ ใช้เอง และส่งออกประมาณกี่ kWh ต่อเดือน
3. ในช่วงผลิตสูง `10:00–14:00` โหลดของบ้านใช้พลังงานเท่าไรและเหลือส่งออกเท่าไร
4. ถ้าเลือก Package และกรอกราคารวมติดตั้งแล้ว ระยะคืนทุนอย่างง่ายอยู่ในช่วงใด

ผลลัพธ์นี้เป็น screening model ไม่ใช่แบบวิศวกรรมหรือคำรับรองผลผลิตจริง ข้อมูลหลังคา ทิศ เงาบัง อุณหภูมิ ข้อจำกัดอินเวอร์เตอร์ การจำกัดส่งออก degradation, maintenance และ financing ยังไม่รวมใน MVP

## Business rules

- **BR-SR-001:** Candidate package sizes คือ 3, 5, 8 และ 10 kW
- **BR-SR-002:** หากบิลทั้งสามใบมี kWh ให้ใช้ค่าเฉลี่ย kWh โดยตรง มิฉะนั้นประมาณ kWh จากค่าไฟและอัตราค่าไฟกลางวันที่ระบบคำนวณได้ พร้อมลด confidence
- **BR-SR-003:** แยกผลประโยชน์จากการใช้ไฟเองและการขายคืนเสมอ
- **BR-SR-004:** อัตราขายคืนของ MVP คือ 2.20 บาท/kWh ตาม Product Owner assumption
- **BR-SR-005:** หากเลือก “สนใจขายคืนแต่ยังไม่มีสัญญา” รายได้ขายคืนเป็น potential upside เท่านั้น ต้องแสดง payback ที่ไม่รวมรายได้นี้ควบคู่กัน
- **BR-SR-006:** หากไม่กรอกราคา Package ห้ามแสดง simple payback
- **BR-SR-007:** ห้ามสรุปว่า “คุ้ม/ไม่คุ้ม” จาก simple payback เพียงค่าเดียว ให้แสดงช่วงและข้อมูลที่ยังขาด

## Calculation contract

### Monthly consumption

- ใช้ค่าเฉลี่ย `energy_kwh` จากบิลสามใบเมื่อข้อมูลครบ
- หากไม่มี kWh ใช้ `average bill ÷ indicative daylight retail rate`

### Load proxy

- ประเมินโหลดเครื่องปรับอากาศที่ 0.9 kWh ต่อเครื่อง-ชั่วโมง และจำกัดไม่เกิน 55% ของการใช้ไฟรายเดือน
- กระจายโหลดส่วนที่เหลือด้วย duration, base-load factor และจำนวนคนของช่วงเช้า กลางวัน เย็น และกลางคืน
- จำนวนคนแต่ละช่วงเป็นตัวแทน activity/load ไม่ได้นำมาบวกเป็นจำนวนผู้อยู่อาศัยรวม

### Solar production

- Expected yield: 4.2 kWh/kWp/day
- Sensitivity range: 3.8–4.6 kWh/kWp/day
- Monthly generation: `system kW × yield × 30.4 days`
- MVP จัดสรร 58% ของผลผลิตรายเดือนไปที่ช่วง `10:00–14:00`
- Peak self-use: `min(peak generation, estimated peak load)`
- Peak export: `max(peak generation - peak self-use, 0)`
- Shoulder self-use และ export ใช้หลักเดียวกันกับช่วงผลิตที่เหลือ

### Recommended size

ระบบประเมิน candidate ทุกขนาดและเลือกระบบที่สมดุลระหว่าง:

- เป้าหมายให้พลังงานจาก Solar ครอบคลุม 65% ของการใช้ไฟเมื่อไม่ขายคืน หรือ 90% เมื่อสนใจขายคืน
- ระยะห่างจากเป้าหมายการผลิต
- export penalty ซึ่งสูงกว่าเมื่อผู้ใช้เลือกไม่ขายคืน

### Financial output

- Monthly avoided cost: `self-use kWh × daylight self-use value`
- Monthly export value: `export kWh × 2.20 บาท`
- Simple payback range: `package price ÷ annual value` โดยคำนวณทั้ง conservative และ optimistic yield
- Export revenue รวมใน confirmed payback เฉพาะเมื่อผู้ใช้ระบุว่ามีสัญญา/โครงการรับซื้อแล้ว

## UX and responsive behavior

- Recommendation และ confidence มาก่อนตัวเลขรายละเอียด
- แสดง generation, self-use และ export เป็นคนละ metric
- แสดง peak production window พร้อม bar เปรียบเทียบ use/export
- Package sizes เป็นปุ่มเลือกได้และ recalculation ต้องเกิดทันที
- ช่องราคาใช้ราคาสุทธิรวมติดตั้งและรองรับการเว้นว่าง
- ที่ความกว้างไม่เกิน 620px metrics และ financial cards เรียงหนึ่งคอลัมน์; package sizes เป็น 2 × 2
- สีไม่ใช่ตัวสื่อสถานะเพียงอย่างเดียว และทุก input/button ต้องใช้งานด้วย keyboard ได้

## Acceptance criteria

- ข้อมูลเดียวกันต้องให้ผล deterministic
- คนและแอร์ช่วงกลางวันลดลงต้องทำให้ peak export เพิ่มขึ้นเมื่อ input อื่นเท่ากัน
- เปลี่ยนขนาด Package ต้องอัปเดต generation, self-use, export และ payback
- ไม่กรอกราคา Package ต้องแสดงว่า “กรอกราคาเพื่อคำนวณ”
- ไม่มีสัญญาขายคืนต้องไม่รวม export revenue ใน confirmed payback
- หน้าไม่เกิด horizontal overflow ที่ viewport 390px

## Future model upgrades

- Location-specific solar resource จากพิกัดและ weather dataset
- Roof orientation, tilt, shading และ usable area
- Inverter clipping, system losses และ export limit
- Hourly/15-minute load profile จากมิเตอร์หรือ bill OCR
- Versioned yield/calculation policy และ saved immutable result snapshot
- Package/BOM price จาก catalog และ installer quote แทน manual price อย่างเดียว

แนวทางการสื่อสารผลผลิตอ้างอิง [Global Solar Atlas methodology](https://globalsolaratlas.info/support/methodology) และกรอบความไม่แน่นอนของ [NREL PVWatts](https://pvwatts.nrel.gov/)
