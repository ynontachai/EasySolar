# Community-Based Negotiation — Discovery and Design Draft

Status: `DISCOVERY` — รอ Product Owner ตัดสินกติกาธุรกิจก่อนพัฒนา

## Executive recommendation

ชื่อ capability ภายในใช้ **Community-Based Negotiation** ได้ แต่ชื่อที่สื่อสารกับผู้ใช้ควรเป็น **EasySolar Community Buy — รวมพลังซื้อโซลาร์ใกล้บ้าน**

หลีกเลี่ยงคำว่า “Community Solar” เพราะในอุตสาหกรรมมักหมายถึงระบบ Solar หนึ่งแห่งที่แบ่งผลประโยชน์ให้หลายคน ซึ่งต่างจากโจทย์นี้ที่แต่ละบ้านติดตั้งและทำสัญญาแยกกัน

โมเดลที่แนะนำคือ **Managed Group Buy + Qualified Tender**:

1. EasySolar รวบรวมและ pre-qualify ความสนใจตามพื้นที่และความต้องการ
2. ระบบสร้าง campaign เมื่อมี demand ที่มีคุณภาพถึงเกณฑ์
3. EPC ที่ผ่าน qualification เสนอราคาแบบมาตรฐานเดียวกัน พร้อม capacity และ SLA
4. EasySolar เปรียบเทียบราคา คุณภาพอุปกรณ์ การรับประกัน ความสามารถส่งมอบ และบริการหลังขาย
5. สมาชิกเห็นข้อเสนอและตัดสินใจเอง ไม่มีข้อผูกมัดจนเซ็นสัญญารายบ้านกับ EPC
6. EPC ได้งานเป็นกลุ่มในพื้นที่เดียวกัน ลด CAC, site-visit travel, scheduling และ procurement fragmentation

EasySolar ไม่ควรขายรายชื่อผู้สนใจแบบ lead list และไม่ควรเลือกผู้ชนะจากราคาต่ำสุดเพียงอย่างเดียว เพราะจะลดความไว้วางใจและสร้างความเสี่ยงด้านคุณภาพระยะยาว

## Evidence from comparable models

| Model | Pattern ที่พิสูจน์แล้ว | สิ่งที่ EasySolar ควรนำมาใช้ |
| --- | --- | --- |
| Solarize / US DOE–NREL | รวมความต้องการ, outreach, RFP, contractor selection และ enrollment เป็น campaign | เจ้าของ campaign, deadline, demand threshold และ RFP ที่ตรวจสอบได้ |
| Solar United Neighbors | เข้าร่วมฟรีและไม่ผูกมัด; 20–30 คนเป็น critical mass; สมาชิกเลือก installer; แต่ละบ้านรับ proposal และเซ็นสัญญาแยก | แยก `interest` ออกจาก `contract`; ให้สมาชิกมีเสียง; standard offer สำหรับทั้ง cohort |
| Solar Together / iChoosr | Pre-vet installer, reverse auction, personalized recommendation และ EPC ได้ demand จำนวนมาก | Qualification ก่อน bid, capacity gate, tiered pricing และ operational batch |
| London programme audit | ราคาต่ำสุดและ supplier pool ที่แคบอาจทำให้ EPC ผลงานไม่ดีถูกเลือกซ้ำ | Quality score, complaint history, capacity monitoring, multi-award/backup EPC และ stop-work trigger |

อ้างอิง:

- [US Department of Energy — purchasing through solar cooperatives](https://www.energy.gov/cmei/systems/articles/purchasing-power-going-solar-through-cooperatives)
- [NREL — The Solarize Guidebook](https://www.nrel.gov/docs/fy12osti/54738.pdf)
- [Solar United Neighbors — how a solar co-op works](https://solarunitedneighbors.org/resources/the-ultimate-solar-co-op-guide/)
- [Warrington Council — Switch Together group buying](https://www.warrington.gov.uk/Switch-Together-Solar)
- [London City Hall — group purchasing and reverse auction model](https://www.london.gov.uk/md3151-supporting-solar-together-london-phase-four-and-five-residents)
- [London internal audit — installer selection risks](https://gla.moderngov.co.uk/documents/b27756/Item%207%20-%20Appendix%206%20-%20Solar%20Together%20London%20Internal%20Audit%20Report%20Thursday%2015-Dec-2022%2014.00%20Audit.pdf?T=9)

## Business objective

### Consumer value

- ได้ราคาและเงื่อนไขที่เปรียบเทียบได้ภายใต้ package baseline เดียวกัน
- ลดความยุ่งยากในการหาและตรวจ EPC หลายราย
- เห็นว่ากลุ่มอยู่ขั้นไหนและอะไรยังขาด โดยไม่เปิดเผยบ้านของสมาชิกคนอื่น
- ตัดสินใจรายบ้านได้เอง และถอนตัวได้ก่อนเซ็นสัญญา

### EPC value

- ได้ qualified demand ไม่ใช่รายชื่อดิบ
- เห็นจำนวนบ้าน, estimated kWp, package mix และระยะทางก่อน bid
- จัด survey, installation crew, inventory และ logistics เป็น batch
- ลดต้นทุน acquisition และเวลาติดตามลูกค้าที่ไม่ได้สนใจจริง

### EasySolar value

- ต่อ Solar Value Assessment ไปสู่ real demand โดยไม่กลายเป็น Marketplace ที่ขายของอย่างเดียว
- สร้าง price benchmark ที่มี geography, package, cohort size และ effective date
- สร้าง feedback loop ระหว่าง assessment, package, final quote, installation และ service quality

## Scope terminology

- **Interest:** ผู้ใช้แจ้งความสนใจ ยังไม่ใช่ lead ที่ส่งให้ EPC
- **Qualified demand:** ผ่านข้อมูลขั้นต่ำ เช่น พื้นที่, สิทธิ์ตัดสินใจเรื่องหลังคา, bill band และช่วงเวลาที่ต้องการ
- **Campaign:** กลุ่มจัดซื้อที่ EasySolar เปิดอย่างเป็นทางการ มีพื้นที่, deadline, threshold และ package scope
- **Cohort:** สมาชิกที่ถูก freeze เป็น snapshot สำหรับ tender หนึ่งรอบ
- **Offer:** ข้อเสนอฐานจาก EPC สำหรับ package band; ราคาสุดท้ายอาจเปลี่ยนหลัง site survey ตาม add-on matrix ที่ประกาศไว้
- **Acceptance:** สมาชิกยอมให้ส่งข้อมูลที่จำเป็นแก่ EPC เพื่อทำ site survey หรือ proposal รายบ้าน
- **Contract:** สัญญาระหว่างเจ้าของบ้านกับ EPC ไม่ใช่สัญญารวมของทั้งกลุ่ม

## Recommended group formation logic

ผู้ใช้ไม่ควรต้องเลือกหรือสร้างกลุ่มซ้ำหลายแบบ เช่น หมู่บ้าน + อำเภอ + 10 km พร้อมกัน ให้ระบบเก็บ demand หนึ่งรายการแล้วคำนวณ candidate groups หลายระดับ

### Geographic hierarchy

1. หมู่บ้าน/โครงการเดียวกัน — ได้ประโยชน์ด้านนิติบุคคล, access และแบบบ้านคล้ายกัน
2. ตำบล/อำเภอเดียวกัน — ใช้เมื่อ demand ในหมู่บ้านยังไม่ถึงเกณฑ์
3. จังหวัดเดียวกัน — ใช้แสดง demand pool และเปิด campaign หลาย cluster
4. Radius 10/15/20 km — ใช้เป็น serviceability constraint และขยายกลุ่มตามเวลา

### Assignment rules

1. เก็บพิกัดเพื่อ matching หลังผู้ใช้ยินยอม แต่หน้า public แสดงเพียงพื้นที่โดยประมาณ
2. เริ่มจาก radius 10 km; หากไม่ถึง threshold ภายในเวลาที่กำหนด เสนอให้ขยายเป็น 15 หรือ 20 km
3. คะแนน cluster พิจารณา `ระยะทาง + admin boundary + package similarity + EPC service area + desired installation window`
4. Demand หนึ่งรายการนับใน active tender cohort ได้เพียงหนึ่งกลุ่ม ป้องกัน double counting
5. ก่อนเปิด tender ต้อง freeze cohort และเก็บ snapshot ของ demand summary
6. Exact address ส่งให้ EPC เฉพาะหลัง award และสมาชิกกดยินยอมรับ site survey

PostGIS เหมาะกับ `ST_DWithin` สำหรับ radius matching และใช้ administrative boundary แยกต่างหาก ห้ามอนุมาน “หมู่บ้านเดียวกัน” จากระยะทางอย่างเดียว

## Qualification and threshold

จำนวนผู้ลงทะเบียนไม่ใช่ตัวเลขเดียวกับ demand ที่ EPC ใช้วางแผน ระบบต้องแสดงอย่างน้อย:

- `interested_count`
- `qualified_household_count`
- `estimated_capacity_kwp`
- `survey_ready_count`
- `offer_acceptance_count`

Pilot assumption สำหรับคุยกับ EPC: เปิด tender เมื่อมี **20 qualified households หรือประมาณ 100 kWp** ในพื้นที่ที่ให้บริการได้ และมีเวลาปิดรับชัดเจน ตัวเลขนี้ยังไม่ใช่ business rule ถาวร ต้อง validate ด้วย EPC 3–5 รายเรื่อง crew capacity, minimum viable batch และ conversion rate

## Procurement model

### Qualification gate

EPC ต้องผ่านก่อนเห็น tender:

- เอกสารบริษัท/ใบอนุญาตและประกันที่เกี่ยวข้อง
- ประสบการณ์ติดตั้งและ reference ที่ตรวจสอบได้
- ความสามารถด้าน engineering, safety และ grid application
- ทีมติดตั้ง, subcontractor policy และ concurrent capacity
- Warranty responsibility และ after-sales SLA
- Complaint, rework และ incident history
- ยอมรับ package baseline, add-on matrix และ audit trail

### Bid structure

- ราคาแยกตาม standard package และ system-size band
- volume tiers เช่น 5–9, 10–19, 20+ accepted homes
- ราคา add-on ล่วงหน้า: roof type, cable distance, DB upgrade, scaffolding, travel, battery และ permit work
- committed capacity ต่อสัปดาห์/เดือน
- earliest survey/install date
- equipment exact model, warranty และ allowed substitutions
- ระยะเวลาที่ราคามีผล

### Evaluation recommendation

Provisional score สำหรับหารือ ไม่ใช่ policy สุดท้าย:

- Total comparable price 35%
- Equipment/engineering/warranty quality 25%
- Delivery capacity and SLA 20%
- After-sales and verified performance 10%
- Commercial transparency and exceptions 10%

ระบบต้องแสดงทั้ง score และ blocking risks ห้ามให้คะแนนรวมสูงลบล้าง safety, licensing หรือ capacity gate ที่ไม่ผ่าน

## Commercial model options

### Recommended for pilot

**Standard success fee paid by awarded EPC per completed installation** โดยอัตราเดียวกันสำหรับ EPC ที่เข้าร่วมและเปิดเผยกับผู้ใช้ว่า EasySolar ได้รับค่าบริการจาก EPC วิธีนี้สอดคล้องกับ value ที่ EasySolar ลด acquisition/coordination cost และไม่เก็บเงินผู้ใช้ก่อนมีผลลัพธ์

ต้องแยก fee ออกจาก bid comparison เพื่อป้องกันการจัดอันดับตามรายได้ของ EasySolar

### Alternatives

- EPC subscription + campaign fee: รายได้คาดการณ์ง่าย แต่ barrier สูงในช่วงเริ่มต้น
- Consumer facilitation fee: ลด conflict แต่ conversion ยากและต้องอธิบาย value ชัด
- Lead fee: ทำเร็ว แต่ไม่แนะนำ เพราะจูงใจให้เน้นจำนวนมากกว่าคุณภาพและอาจทำลายความเชื่อใจ

## Consumer journey

```text
Solar Value result
  → สนใจรวมพลังซื้อใกล้บ้าน
  → ยืนยันข้อมูลบ้านและสิทธิ์ตัดสินใจ
  → ระบุตำแหน่งแบบเป็นส่วนตัว + เลือกยอมขยาย 10/15/20 km
  → เลือกช่วงติดตั้งและ package interest
  → OTP ยืนยันช่องทางติดต่อ
  → เข้าสู่ demand pool
  → เห็นความคืบหน้ากลุ่มแบบไม่เปิดเผยสมาชิก
  → Campaign เปิด / รับแจ้งเงื่อนไข
  → ดูข้อเสนอและเหตุผลการคัดเลือก
  → ยินยอมส่งข้อมูลให้ EPC
  → Site survey และ proposal รายบ้าน
  → Accept / decline โดยไม่มีผลต่อสมาชิกคนอื่น
```

หลัก UX: ขอข้อมูลน้อยที่สุดก่อน ให้ผู้ใช้เห็นประโยชน์และ privacy boundary ก่อนขอ pin/address และไม่ใช้ข้อความ “รับประกันราคาถูกที่สุด”

## Screen inventory

### Consumer

- `/community-buy` — อธิบายวิธีทำงาน, กลุ่มใกล้เคียง และไม่มีข้อผูกมัด
- `/community-buy/join` — 3-step registration: บ้านและความต้องการ → พื้นที่และ privacy → consent/contact
- `/community-buy/my-interest` — สถานะ demand และแก้ไข/ถอนความสนใจ
- `/community-buy/campaigns/[campaignId]` — progress, threshold, timeline และ aggregate demand
- `/community-buy/campaigns/[campaignId]/offer` — winning offer, comparison, exclusions และ next action

### EPC

- `/partner/campaigns` — tender invitations และ serviceable groups
- `/partner/campaigns/[id]` — anonymized demand profile, RFP, Q&A และ bid submission
- `/partner/campaigns/[id]/delivery` — consented households, survey batching, capacity/SLA progress

### EasySolar operations

- `/admin/community-demand` — demand heatmap, quality filters และ duplicate/risk flags
- `/admin/community-campaigns/new` — cluster proposal, threshold, deadline และ package scope
- `/admin/community-campaigns/[id]/tender` — EPC qualification, bids, normalized comparison และ award audit
- `/admin/community-campaigns/[id]/delivery` — exceptions, complaints, SLA และ backup EPC

## Key UI states

- No group nearby: เก็บ interest และบอกเงื่อนไขการแจ้งเตือน
- Group forming: แสดง qualified demand ไม่ใช้ vanity registration count
- Radius expansion available: ผู้ใช้เลือกยินยอม ไม่ขยายเงียบ ๆ
- Threshold reached / cohort frozen
- Tender open / bid under review
- Offer ready / offer expired
- User declined / withdrew
- EPC capacity reached / backup EPC activated
- Site unsuitable after survey
- Final price differs from base price: ต้องแสดงสาเหตุจาก add-on matrix
- Campaign cancelled: เหตุผล, data retention และทางเลือกถัดไป

## Privacy and trust rules

- พิกัดและที่อยู่เป็นข้อมูลส่วนบุคคล ห้ามแสดงบน community map รายหลัง
- Public/group view แสดง aggregate count และพื้นที่กว้างพอไม่ระบุตัวบุคคล
- แยก consent สำหรับ `จับกลุ่ม`, `ส่งการแจ้งเตือน`, และ `ส่งข้อมูลให้ EPC`
- ส่งข้อมูลให้เฉพาะ awarded EPC หลังสมาชิกยืนยัน ไม่ส่งรายชื่อให้ผู้ร่วมประมูลทั้งหมด
- ผู้ใช้ถอน interest และยกเลิก marketing consent ได้
- กำหนด retention ของ abandoned interest และบันทึก consent version
- EPC ดาวน์โหลดข้อมูลเท่าที่จำเป็น มี expiry, audit และห้ามนำไปทำการตลาดนอก campaign
- ต้องให้ที่ปรึกษากฎหมายทบทวน Privacy Notice, lawful basis, processor/controller roles และสัญญา data processing ก่อน production

แนวปฏิบัติ GPPC ของสำนักงานคุ้มครองข้อมูลส่วนบุคคลเน้นการแจ้งวัตถุประสงค์ ฐานการประมวลผล และเก็บข้อมูลเท่าที่จำเป็นตามวัตถุประสงค์: [GPPC Privacy Notice example](https://gppc.pdpc.or.th/wp-content/uploads/GPPC-PDPC_Register_Privacy-Notice-%E0%B8%89%E0%B8%9A%E0%B8%B1%E0%B8%9A%E0%B8%A2%E0%B9%88%E0%B8%AD_05062024.pdf)

## Core data entities

- `buyer_interest`
- `interest_location_private`
- `interest_preference`
- `consent_record`
- `demand_cluster_candidate`
- `buying_campaign`
- `campaign_cohort_snapshot`
- `campaign_member`
- `epc_qualification`
- `campaign_rfp`
- `epc_bid`
- `bid_package_price`
- `bid_add_on_rate`
- `award_decision`
- `member_offer`
- `data_handoff_consent`
- `site_survey`
- `individual_proposal`
- `installation_contract_reference`
- `delivery_milestone`
- `service_issue`

Assessment, Package Builder และ canonical equipment ต้องอ้างด้วย foreign key/version snapshot แต่ข้อมูลติดต่อและ precise location ต้องอยู่ใน private schema/table ที่เข้าถึงแยกจาก aggregate demand

## MVP release slices

### CBN-0 — Validate before build

- สัมภาษณ์เจ้าของบ้าน 8–12 รายและ EPC 3–5 ราย
- ยืนยัน threshold, radius, bid units, fee model และ legal role
- สร้าง RFP/package baseline ตัวอย่างและทดสอบการเปรียบเทียบ

### CBN-1 — Demand registration

- Join from Solar Value result
- Consent, private location, preferences, OTP และ withdrawal
- Admin aggregate map/list และ manual cluster proposal
- ยังไม่มี EPC bid และยังไม่ส่งข้อมูลส่วนบุคคลออกนอก EasySolar

### CBN-2 — Campaign and tender

- Freeze cohort, invite qualified EPC, normalized bids, evaluation/audit และ award
- Consumer เห็น campaign progress แต่ยังไม่เห็น confidential bid detail

### CBN-3 — Offer and delivery

- Member offer, individual acceptance, consented handoff, survey batching, final proposal และ SLA tracking

### CBN-4 — Scale

- Automated spatial clustering, multiple awards, backup EPC, benchmark analytics, complaints/quality score และ integration กับ Package Builder/Marketplace

## Success metrics

- Assessment → qualified interest conversion
- Qualified demand density: households/kWp per serviceable radius
- Days from threshold to comparable offers
- EPC participation and valid-bid rate
- Offer → site survey → contract conversion
- Difference between group base price and final site-specific price
- EPC acquisition/coordination cost saved per contract
- Installation cycle time and SLA breach rate
- Rework, complaint and warranty-response rate
- Consumer withdrawal reason and trust score

## Decisions required before implementation

1. EasySolar เลือก EPC เอง, ให้สมาชิกโหวต หรือใช้ hybrid advisory committee?
2. Revenue model: success fee, EPC subscription, consumer fee หรือผสม?
3. Pilot geography และ EPC service radius เริ่มต้นอยู่ที่ใด?
4. Threshold วัดจากจำนวนบ้าน, kWp, expected contract value หรือหลายเงื่อนไข?
5. รองรับบ้านอย่างเดียวก่อน หรือรวม SME/โรงงาน?
6. Package baseline แรกมี Solar only, Solar + Battery และ EV charger หรือไม่?
7. ต้องวางมัดจำเมื่อใด และใครถือ/คืนเงิน?
8. EasySolar เป็นเพียง facilitator หรือมีความรับผิดชอบใน selection/quality ระดับใด?
9. Bid detail ใดเปิดให้สมาชิกทั้งหมดเห็น และข้อมูลใดเป็นความลับทางการค้า?
10. ผู้ใช้ต้องมีบัญชีตั้งแต่แสดง interest หรือใช้ OTP ตอนยืนยันเข้ากลุ่ม?

## Recommended next discussion

ล็อก 4 เรื่องก่อนออก wireframe และ schema: **pilot area, selection authority, fee model และ minimum viable cohort** จากนั้นทำ clickable flow ของ CBN-1 และทดสอบกับผู้ใช้/EPC ก่อนสร้างระบบ tender จริง
