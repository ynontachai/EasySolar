import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  Calculator,
  FileCheck2,
  Gauge,
  PenTool,
  Search,
  UsersRound,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SolarCircuitVisual } from "@/components/solar-circuit-visual";

const checks = [
  {
    number: "01",
    title: "แรงดันตามอุณหภูมิ",
    detail: "Cold Voc, hot/cold Vmp และช่วงเริ่มทำงาน แสดงสูตรและค่าที่ใช้ทุกครั้ง",
    icon: Gauge,
  },
  {
    number: "02",
    title: "กระแสแยกทุก MPPT",
    detail: "ไม่เหมารวมพอร์ตกับ tracker และไม่ถือว่ากระแสเกินยอมรับได้โดยไม่มีหลักฐาน",
    icon: FileCheck2,
  },
  {
    number: "03",
    title: "ย้อนกลับถึง Datasheet",
    detail: "ล็อก exact model, revision, แหล่งข้อมูล และเวอร์ชัน engine ไว้กับผลคำนวณ",
    icon: BookOpenCheck,
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <SiteHeader inverse />
        <div className="hero__grid" aria-hidden="true" />
        <div className="hero__orb" aria-hidden="true" />
        <div className="hero__content">
          <p className="eyebrow">PV EQUIPMENT INTELLIGENCE · THAILAND</p>
          <h1>
            ตัดสินใจเรื่อง Solar
            <br />
            ด้วยข้อมูล <em>ไม่ใช่เดา</em>
          </h1>
          <p className="hero__lead">
            เครื่องมือช่วยตรวจอุปกรณ์ ประเมินความคุ้มค่า และอธิบายสมมติฐาน
            สำหรับทั้งมืออาชีพและผู้ใช้ไฟที่กำลังพิจารณาติด Solar
          </p>
          <div className="hero__actions">
            <Link className="button button--sun" href="#choose-path">
              เลือกเครื่องมือที่เหมาะกับคุณ
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="text-link text-link--light" href="/checker">
              <Search size={17} aria-hidden="true" />
              เปิด Engineering Checker
            </Link>
          </div>
        </div>
        <SolarCircuitVisual />
        <div className="hero__footnote">
          <span>ENGINEERING TRUST FIRST</span>
          <span>PRELIMINARY DC-SIDE SIZING</span>
        </div>
      </section>

      <section className="trust-strip" aria-label="หลักการของผลิตภัณฑ์">
        <p>ทุกคำตอบแสดงที่มา สมมติฐาน และข้อจำกัด</p>
        <span>Deterministic</span>
        <span>Traceable</span>
        <span>Reviewable</span>
      </section>

      <section className="audience-section" id="choose-path" aria-labelledby="audience-heading">
        <div className="audience-section__intro">
          <p className="eyebrow eyebrow--dark">CHOOSE YOUR WORKSPACE</p>
          <h2 id="audience-heading">เริ่มจากคำถามที่คุณต้องการตัดสินใจ</h2>
          <p>
            EasySolar แยกเครื่องมือสำหรับงานวิศวกรรมและการตัดสินใจลงทุน
            เพื่อให้แต่ละคำตอบมีรายละเอียดและคำเตือนที่เหมาะกับผู้ใช้
          </p>
        </div>
        <div className="audience-paths">
          <article className="audience-path" id="epc">
            <span className="audience-path__number">01 · EPC / INSTALLER</span>
            <div>
              <p className="audience-path__status audience-path__status--ready">พร้อมทดลอง</p>
              <BriefcaseBusiness className="audience-path__icon" aria-hidden="true" />
              <h3>EPC / Installer</h3>
              <p>
                ค้นหาอุปกรณ์ จัดชุด Package และเตรียมข้อเสนอจาก Demand จริงในแต่ละพื้นที่
              </p>
            </div>
            <div className="audience-path__actions">
              <Link className="text-link" href="/equipment">
                เปิดคลังอุปกรณ์
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="text-link text-link--muted" href="/community-buy">
                รู้จัก Community Buy
              </Link>
            </div>
          </article>
          <article className="audience-path" id="engineer">
            <span className="audience-path__number">02 · ENGINEER</span>
            <div>
              <p className="audience-path__status audience-path__status--ready">พร้อมทดลอง</p>
              <PenTool className="audience-path__icon" aria-hidden="true" />
              <h3>Engineer</h3>
              <p>
                ตรวจ PV–Inverter compatibility ออกแบบ String เบื้องต้น และทบทวนสมมติฐานทุกกฎ
              </p>
            </div>
            <div className="audience-path__actions">
              <Link className="text-link" href="/checker">
                เปิด Engineering Checker
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </article>
          <article className="audience-path audience-path--consumer" id="electricity-user">
            <span className="audience-path__number">03 · ELECTRICITY USER</span>
            <div>
              <p className="audience-path__status audience-path__status--ready">ประเมินได้แล้ว</p>
              <Calculator className="audience-path__icon" aria-hidden="true" />
              <h3>ผู้ใช้ไฟ</h3>
              <p>
                ประเมินขนาดระบบ ราคา ช่วงคืนทุน และ Investment Score ก่อนรวมความต้องการกับคนใกล้บ้าน
              </p>
            </div>
            <div className="audience-path__actions">
              <Link className="text-link" href="/solar-value/new">
                เริ่มประเมินความคุ้มค่า
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="text-link text-link--muted" href="/community-buy">
                <UsersRound size={16} aria-hidden="true" />
                ดู Community Buy
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="checks-section">
        <div className="section-heading">
          <p className="eyebrow eyebrow--dark">ตรวจให้ครบก่อนสรุป</p>
          <h2>ทุกคำว่า “ผ่าน” ต้องมีที่มา</h2>
          <p>
            ระบบแสดง Pass, Fail หรือ Incomplete เป็นรายกฎ
            และจะไม่เปลี่ยนข้อมูลที่ขาดให้กลายเป็นไฟเขียว
          </p>
        </div>
        <div className="checks-list">
          {checks.map((check) => {
            const Icon = check.icon;
            return (
              <article className="check-row" key={check.number}>
                <span className="check-row__number">{check.number}</span>
                <Icon className="check-row__icon" aria-hidden="true" />
                <h3>{check.title}</h3>
                <p>{check.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="workflow-section">
        <div className="workflow-section__visual" aria-hidden="true">
          <div className="workflow-line" />
          <span className="workflow-node workflow-node--one">PV</span>
          <span className="workflow-node workflow-node--two">MPPT</span>
          <span className="workflow-node workflow-node--three">REPORT</span>
        </div>
        <div className="workflow-section__copy">
          <p className="eyebrow eyebrow--dark">FROM SOURCE TO REPORT</p>
          <h2>เลือกอุปกรณ์ → ตั้งเงื่อนไข → ตรวจทุกกฎ → ออกรายงาน</h2>
          <p>
            ผลลัพธ์เก็บ snapshot ของสเปกและ engine version
            เพื่อให้การคำนวณเดิมตรวจย้อนหลังได้ แม้ catalog จะมี revision ใหม่
          </p>
          <Link className="text-link" href="/checker">
            เปิด Engineering Workspace
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">START WITH A TRACEABLE ANSWER</p>
        <h2>เปลี่ยนสเปกสองแผ่น ให้เป็นคำตอบที่ตรวจสอบได้</h2>
        <Link className="button button--sun" href="/checker">
          ทดลอง Checker
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <small>
          Preliminary only — ต้องให้วิศวกรและคู่มือผู้ผลิตตรวจทานก่อนนำไปติดตั้ง
        </small>
      </section>
      <SiteFooter />
    </main>
  );
}
