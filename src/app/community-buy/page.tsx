import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Handshake, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "EasySolar Community Buy",
  description: "รวมความต้องการติด Solar ในพื้นที่ เพื่อสร้างอำนาจต่อรองและลดภาระจัดการให้ EPC",
};

const steps = [
  { icon: MapPin, title: "แจ้งพื้นที่", detail: "เลือกระยะ 10, 15 หรือ 20 กม. พิกัดจริงยังเป็นข้อมูลส่วนตัว" },
  { icon: UsersRound, title: "รวม Demand", detail: "ระบบประเมินกลุ่มระดับตำบล อำเภอ จังหวัด และรัศมี โดยไม่นับซ้ำ" },
  { icon: Handshake, title: "ต่อรองเป็นกลุ่ม", detail: "เมื่อกลุ่มพร้อม EasySolar จึงคัด EPC และ Package ที่เทียบกันได้" },
];

export default function CommunityBuyPage() {
  return (
    <main className="community-page">
      <SiteHeader />
      <section className="community-hero">
        <div>
          <p className="eyebrow eyebrow--dark">EASYSOLAR COMMUNITY BUY</p>
          <h1>บ้านใกล้กัน<br />ต่อรอง Solar <em>ไปด้วยกัน</em></h1>
          <p>
            รวมผู้สนใจติด Solar ตามพื้นที่ เพื่อสร้าง Demand ที่ชัดเจน ให้ EPC วางแผนหน้างานง่ายขึ้น
            และให้ผู้ซื้อเปรียบเทียบราคาและเงื่อนไขบนมาตรฐานเดียวกัน
          </p>
          <div className="community-hero__actions">
            <Link className="button button--ink" href="/community-buy/join">
              ลงทะเบียนความสนใจ<ArrowRight size={18} aria-hidden="true" />
            </Link>
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
          <h2>เริ่มจากความต้องการจริง ก่อนเริ่มการขาย</h2>
        </div>
        <div className="community-principles__steps">
          {steps.map(({ icon: Icon, title, detail }, index) => (
            <article key={title}>
              <span>0{index + 1}</span><Icon aria-hidden="true" /><h3>{title}</h3><p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="community-boundary">
        <ShieldCheck aria-hidden="true" />
        <div>
          <p className="eyebrow">PRIVACY BOUNDARY</p>
          <h2>สาธารณะเห็น Demand รวม ไม่เห็นบ้านของใคร</h2>
          <p>ชื่อ อีเมล เบอร์โทร และพิกัดจริงถูกเก็บแยกในพื้นที่ Private การลงทะเบียนยังไม่ใช่คำสั่งซื้อหรือสัญญากับ EPC</p>
        </div>
        <Link className="button button--sun" href="/community-buy/join">เริ่มลงทะเบียน<ArrowRight size={18} aria-hidden="true" /></Link>
      </section>
      <SiteFooter />
    </main>
  );
}
