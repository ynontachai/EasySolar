import Link from "next/link";
import { ArrowDown, ArrowRight, BarChart3, FileInput, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const assessmentSteps = [
  {
    number: "01",
    title: "เข้าใจการใช้ไฟ",
    detail:
      "อ่านบิล ค่าไฟ ประเภทมิเตอร์ และช่วงเวลาที่ใช้ไฟ เพื่อแยกสิ่งที่ทราบจริงออกจากค่าประมาณ",
    icon: FileInput,
  },
  {
    number: "02",
    title: "จำลองระบบและข้อเสนอ",
    detail:
      "เทียบขนาดระบบ ผลผลิตไฟฟ้า การใช้เอง ราคา และเงื่อนไขรับประกันภายใต้สมมติฐานเดียวกัน",
    icon: BarChart3,
  },
  {
    number: "03",
    title: "สรุปความสมเหตุสมผล",
    detail:
      "แสดงช่วงคืนทุน ความไวต่อสมมติฐาน จุดเสี่ยง และคำถามที่ควรถามผู้เสนอราคา โดยไม่แทนคำปรึกษาวิศวกรรมหรือการเงิน",
    icon: ShieldCheck,
  },
];

export const metadata = {
  title: "ประเมินความคุ้มค่า Solar",
  description:
    "กรอบการประเมินขนาดระบบ ราคา ผลประหยัด และความสมเหตุสมผลของข้อเสนอ Solar อย่างโปร่งใส",
};

export default function SolarValuePage() {
  return (
    <main className="value-page">
      <SiteHeader />
      <section className="value-hero">
        <div className="value-hero__copy">
          <p className="eyebrow eyebrow--dark">SOLAR VALUE ASSESSMENT · PRODUCT DEFINITION</p>
          <h1>
            ข้อเสนอ Solar นี้
            <br />
            <em>สมเหตุสมผลไหม?</em>
          </h1>
          <p>
            EasySolar จะช่วยแยก “ข้อมูลจริง” “สมมติฐาน” และ “ความไม่แน่นอน”
            เพื่อให้เจ้าของบ้านและธุรกิจตัดสินใจได้ดีขึ้น ไม่ใช่แค่รับตัวเลขคืนทุนเพียงค่าเดียว
          </p>
          <div className="value-hero__actions">
            <Link className="button button--ink" href="/solar-value/new">
              เริ่มแบบประเมิน
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a className="text-link" href="#assessment-scope">
              ดูสิ่งที่จะประเมิน
              <ArrowDown size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
        <aside className="value-hero__status" aria-label="สถานะการพัฒนา">
          <span>STATUS / FORM BETA</span>
          <strong>เปิดแบบฟอร์มแล้ว</strong>
          <p>
            กรอกและตรวจทานข้อมูลได้แล้ว แต่ยังไม่แสดงผลประหยัดหรือขนาดระบบ
            จนกว่าจะเชื่อม Calculation Policy ที่ตรวจสอบได้
          </p>
        </aside>
      </section>

      <section className="value-assessment" id="assessment-scope">
        <div className="value-assessment__heading">
          <p className="eyebrow eyebrow--dark">ASSESSMENT LOGIC</p>
          <h2>จากบิลค่าไฟ ไปสู่คำตอบที่ตรวจสอบได้</h2>
        </div>
        <div className="value-assessment__steps">
          {assessmentSteps.map((step) => {
            const Icon = step.icon;
            return (
              <article className="value-step" key={step.number}>
                <span>{step.number}</span>
                <Icon aria-hidden="true" />
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="value-contract">
        <div className="value-contract__column">
          <p className="eyebrow">INPUTS WE NEED</p>
          <h2>ข้อมูลที่ต้องเตรียม</h2>
          <ul>
            <li>บิลค่าไฟย้อนหลังและประเภทมิเตอร์</li>
            <li>จังหวัด ประเภทอาคาร และรูปแบบการใช้ไฟกลางวัน</li>
            <li>ขนาดระบบ อุปกรณ์ ราคา และเงื่อนไขในใบเสนอราคา</li>
            <li>ข้อมูลหลังคา เงาบัง และข้อจำกัดหน้างานเท่าที่ทราบ</li>
          </ul>
        </div>
        <div className="value-contract__column">
          <p className="eyebrow">OUTPUTS WE EXPLAIN</p>
          <h2>คำตอบที่ควรได้รับ</h2>
          <ul>
            <li>ช่วงผลประหยัดและคืนทุน ไม่ใช่ตัวเลขเดียว</li>
            <li>สมมติฐานที่มีผลต่อคำตอบมากที่สุด</li>
            <li>ความสมเหตุสมผลของขนาดระบบและราคา</li>
            <li>จุดเสี่ยง ข้อมูลที่ยังขาด และคำถามสำหรับผู้เสนอราคา</li>
          </ul>
        </div>
      </section>

      <section className="value-next">
        <div>
          <p className="eyebrow eyebrow--dark">START ASSESSMENT</p>
          <h2>เริ่มจากบิลและพฤติกรรมใช้ไฟ ใช้เวลาประมาณ 3–5 นาที</h2>
        </div>
        <Link className="text-link" href="/solar-value/new">
          เริ่มกรอกข้อมูล
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
      <SiteFooter />
    </main>
  );
}
