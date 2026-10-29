# Consumer Tariff Policy

EasySolar แยก “ข้อมูลอัตราทางการ” ออกจาก “สมมติฐานผลิตภัณฑ์” และติด version/effective date เพื่อให้ผลประเมินย้อนหลังตรวจสอบได้

## Policy ที่ใช้ในแบบประเมิน

`TH-PEA-RESIDENTIAL-2026-09` ใช้อัตราบ้านอยู่อาศัยแรงดันต่ำของ PEA ที่มีผลตั้งแต่กันยายน 2569:

- TOU Peak: 5.7982 บาท/kWh
- TOU Off-Peak: 2.6369 บาท/kWh
- ค่าบริการรายเดือน: 24.62 บาท
- Peak: วันจันทร์–ศุกร์ 09:00–22:00
- Off-Peak: วันจันทร์–ศุกร์ 22:00–09:00 และตลอดวันเสาร์–อาทิตย์/วันหยุดที่ประกาศ
- ค่า Ft กันยายน–ธันวาคม 2569: 0.1623 บาท/kWh
- VAT: 7%

อัตรารับซื้อ `2.20 บาท/kWh` เป็น assumption ที่ Product Owner กำหนดให้แบบประเมิน ไม่ได้อ้างว่าเป็นสิทธิ์ที่ผู้ใช้ทุกคนได้รับจริง ระบบต้องแสดงคำเตือนว่าการขายคืนขึ้นกับโครงการ สัญญา มิเตอร์ และเงื่อนไขของการไฟฟ้า

## Calculation contract

- Self-consumption value คือค่าไฟส่วนเพิ่มที่ผู้ใช้หลีกเลี่ยงได้ ไม่ใช่ค่าไฟเฉลี่ยทั้งบิล
- Normal tariff ใช้ marginal tier เมื่อมี kWh ครบทั้งสามรอบบิล; หากไม่มี kWh จะแสดงว่าเป็นข้อมูลไม่พอแทนการเดา
- TOU daylight indication ใช้ค่าเฉลี่ยถ่วงน้ำหนัก 5 วัน Peak และ 2 วัน Off-Peak แล้วบวก Ft และ VAT
- Service charge ไม่ถือเป็น savings เพราะยังต้องชำระเมื่อเชื่อมต่อระบบไฟฟ้า
- Export value แสดงแยกจาก self-consumption value และไม่รวมเป็น ROI จนกว่าจะมี generation profile, system size และ installation price
- ทุกผลในขั้นนี้ต้องติดป้าย `preliminary` และไม่ใช้แทนใบเสนอราคาหรือแบบวิศวกรรม

## Sources

- [PEA electricity tariff](https://www.pea.co.th/our-services/tariff)
- [PEA tariff effective September 2026](https://www.pea.co.th/sites/default/files/users/user34/attachments/Electricity_Tariff_SEP_2026_3.pdf)
- [ERC automatic tariff adjustment (Ft)](https://www.erc.or.th/th/automatic)
