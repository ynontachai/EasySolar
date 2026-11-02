import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ClipboardCheck, FileSignature, Hourglass, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PILOT_TENDER_HOUSEHOLDS, PILOT_TENDER_KWP } from "@/domain/community/pools";

export const metadata: Metadata = {
  title: "EasySolar Community Buy",
  description: "รวมความต้องการติด Solar ในพื้นที่ เพื่อสร้างอำนาจต่อรองและลดภาระจัดการให้ EPC",
};

const steps = [
  { icon: MapPin, title: "แจ้งความสนใจ", detail: "เลือกพื้นที่และระยะ 10, 15 หรือ 20 กม. พิกัดจริงเป็นข้อมูลส่วนตัว ไม่แสดงต่อสาธารณะ" },
  { icon: Hourglass, title: "รอรวมกลุ่ม", detail: "ระบบรวม Demand ระดับตำบล อำเภอ จังหวัด และรัศมี โดยไม่นับซ้ำ ตอนนี้ยังไม่ส่งข้อมูลให้ EPC" },
  { icon: UsersRound, title: "กลุ่มถึงเกณฑ์", detail: `เกณฑ์นำร่อง ${PILOT_TENDER_HOUSEHOLDS} ครัวเรือน หรือ ${PILOT_TENDER_KWP} kWp รวมกัน ดูความคืบหน้าได้ที่ Demand Pool` },
  { icon: BadgeCheck, title: "EasySolar คัดข้อเสนอ", detail: "ทีมงานคัด EPC และ Package ที่เทียบกันได้ เมื่อกลุ่มพร้อมเท่านั้น" },
  { icon: ClipboardCheck, title: "สมาชิกพิจารณารายบ้าน", detail: "คุณเลือกรับหรือปฏิเสธข้อเสนอเองได้ ไม่มีการตัดสินใจแทน" },
  { icon: FileSignature, title: "สำรวจหน้างานและทำสัญญา", detail: "สำรวจหน้างานและทำสัญญากับ EPC โดยตรง ราคาสุดท้ายยืนยันหลังสำรวจ" },
];

const gets = [
  "เปรียบเทียบ Package และเงื่อนไขบนฐานเดียวกัน",
  "EPC ที่ผ่านการคัดโดยทีม EasySolar",
  "ปฏิเสธข้อเสนอได้โดยไม่มีค่าใช้จ่าย",
];

const notGuaranteed = [
  "ราคาสุดท้ายเท่ากันทุกบ้าน เพราะอาจเปลี่ยนหลังสำรวจหน้างาน",
  "ว่ากลุ่มจะถึงเกณฑ์ภายในเวลาที่กำหนด",
  "ว่าทุกพื้นที่จะมี EPC เข้าให้บริการ",
];

const faqs = [
  { q: "ลงทะเบียนแล้วมีข้อผูกมัดไหม", a: "ไม่มี ฟรี ไม่ใช่คำสั่งซื้อ และไม่ใช่สัญญากับ EPC" },
  { q: "ข้อมูลของฉันถูกส่งให้ EPC เมื่อไหร่", a: "ยังไม่ส่งในขั้นเก็บความสนใจ จะแจ้งและขอยืนยันจากคุณก่อนในขั้นถัดไป" },
  { q: "EasySolar เลือก EPC อย่างไร", a: "พิจารณาคุณภาพงาน การรับประกัน ความพร้อมส่งมอบ และค่าใช้จ่ายเพิ่มหลังสำรวจ" },
  { q: "ถอนความสนใจได้อย่างไร", a: "ติดต่อทีมงาน EasySolar พร้อมหมายเลขอ้างอิงที่ได้หลังลงทะเบียน ถอนได้ทุกเมื่อก่อนทำสัญญา" },
];

export default function CommunityBuyPage() {
  return (
    <main className="community-page">
      <SiteHeader />
      <section className="community-hero">
        <div>
          <p className="eyebrow eyebrow--dark">COMMUNITY BUY PILOT · ขั้นเก็บและจับคู่ความสนใจ</p>
          <h1>บ้านใกล้กัน<br />ต่อรอง Solar <em>ไปด้วยกัน</em></h1>
          <p>
            รวมผู้สนใจติด Solar ตามพื้นที่ เพื่อสร้าง Demand ที่ชัดเจน ให้ EPC วางแผนหน้างานง่ายขึ้น
            และให้ผู้ซื้อเปรียบเทียบราคาและเงื่อนไขบนมาตรฐานเดียวกัน
          </p>
          <p className="community-hero__promise">ฟรี ไม่มีข้อผูกมัด และยังไม่ส่งข้อมูลให้ EPC</p>
          <div className="community-hero__actions">
            <Link className="button button--ink" href="/community-buy/join">
              ลงทะเบียนความสนใจ<ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="text-link" href="/community-buy/pools">ดูความคืบหน้ากลุ่ม</Link>
            <Link className="text-link" href="/solar-value/new">ประเมินขนาดระบบก่อน</Link>
          </div>
        </div>
        <div className="community-radius-visual" aria-label="ระบบจับคู่ระยะ 10 15 และ 20 กิโลเมตร">
          <span className="community-radius-visual__center">YOU</span>
          <span data-radius="10">10 km</span>
          <span data-radius="15">15 km</span>
          <span data-radius="20">20 km</span>
        </div>
      </section>

      <section className="community-principles">
        <div>
          <p className="eyebrow eyebrow--dark">HOW IT WORKS</p>
          <h2>6 ขั้นจากความสนใจ สู่สัญญา</h2>
        </div>
        <div className="community-principles__steps">
          {steps.map(({ icon: Icon, title, detail }, index) => (
            <article key={title}>
              <span>0{index + 1}</span><Icon aria-hidden="true" /><h3>{title}</h3><p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="community-split">
        <div>
          <p className="eyebrow eyebrow--dark">WHAT YOU GET</p>
          <h2>สิ่งที่ได้รับ</h2>
          <ul>{gets.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <p className="eyebrow eyebrow--dark">NOT GUARANTEED</p>
          <h2>สิ่งที่ไม่รับประกัน</h2>
          <ul>{notGuaranteed.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <section className="community-faq" id="epc-selection">
        <p className="eyebrow eyebrow--dark">FAQ</p>
        <h2>คำถามที่พบบ่อย</h2>
        {faqs.map(({ q, a }) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
        <p className="community-faq__epc">เป็น EPC? <Link className="text-link" href="/community-buy/pools">ดูสถานะ Demand Pool</Link> ช่องทางสมัครเข้าร่วมจะเปิดในรอบถัดไป</p>
      </section>

      <section className="community-boundary">
        <ShieldCheck aria-hidden="true" />
        <div>
          <p className="eyebrow">PRIVACY BOUNDARY</p>
          <h2>สาธารณะเห็น Demand รวม ไม่เห็นบ้านของใคร</h2>
          <p>ชื่อ อีเมล เบอร์โทร และพิกัดจริงถูกเก็บแยกในพื้นที่ Private การลงทะเบียนยังไม่ใช่คำสั่งซื้อหรือสัญญากับ EPC และถอนความสนใจได้ทุกเมื่อ</p>
        </div>
        <Link className="button button--sun" href="/community-buy/join">เริ่มลงทะเบียน<ArrowRight size={18} aria-hidden="true" /></Link>
      </section>
      <SiteFooter />
    </main>
  );
}
