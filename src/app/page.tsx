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
  const lineOaUrl = process.env.NEXT_PUBLIC_LINE_OA_URL;
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
            ดูสเปกอุปกรณ์ ดาวน์โหลด Datasheet และจับคู่แผงกับอินเวอร์เตอร์ด้วยสูตรที่ตรวจสอบได้
            สำหรับ EPC และช่างติดตั้ง แล้วสั่งซื้ออุปกรณ์ผ่าน LINE OA
          </p>
          <div className="hero__actions">
            <Link className="button button--sun" href="/equipment">
              เปิดคลังอุปกรณ์
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="text-link text-link--light" href="/checker">
              <Search size={17} aria-hidden="true" />
              จับคู่แผงกับอินเวอร์เตอร์
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
          <p className="eyebrow eyebrow--dark">FOR EPC / INSTALLER</p>
          <h2 id="audience-heading">ดูข้อมูล คำนวณ แล้วสั่งซื้อในที่เดียว</h2>
          <p>
            ไม่ต้องสมัครสมาชิก ทุกเครื่องมือเปิดใช้ได้ทันที และสั่งซื้อหรือขอราคาผ่าน LINE OA
          </p>
        </div>
        <div className="audience-paths">
          <article className="audience-path" id="epc">
            <span className="audience-path__number">01 · EQUIPMENT & DATASHEET</span>
            <div>
              <BriefcaseBusiness className="audience-path__icon" aria-hidden="true" />
              <h3>คลังอุปกรณ์</h3>
              <p>ค้นหาแผง PV และอินเวอร์เตอร์ ดูสเปกทางเทคนิค และดาวน์โหลด Datasheet ฉบับตรวจสอบแล้ว</p>
            </div>
            <div className="audience-path__actions">
              <Link className="text-link" href="/equipment">
                เปิดคลังอุปกรณ์
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </article>
          <article className="audience-path" id="checker">
            <span className="audience-path__number">02 · SIMPLE CALCULATOR</span>
            <div>
              <PenTool className="audience-path__icon" aria-hidden="true" />
              <h3>จับคู่แผง–อินเวอร์เตอร์</h3>
              <p>เลือกยี่ห้อและรุ่น ระบบคำนวณจำนวนแผงต่อสตริง สตริงต่อ MPPT และรูปแบบการต่อ พร้อมสูตรทุกขั้น</p>
            </div>
            <div className="audience-path__actions">
              <Link className="text-link" href="/checker">
                เปิดตัวช่วยจับคู่
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </article>
          <article className="audience-path" id="order">
            <span className="audience-path__number">03 · ORDER</span>
            <div>
              <Calculator className="audience-path__icon" aria-hidden="true" />
              <h3>สั่งซื้อผ่าน LINE OA</h3>
              <p>แอด LINE OA ของ EasySolar แล้วสั่งซื้อและขอราคาผ่านเมนูใน LINE ทีมงานตอบกลับโดยตรง</p>
            </div>
            <div className="audience-path__actions">
              {lineOaUrl ? (
                <a className="text-link" href={lineOaUrl} rel="noopener noreferrer" target="_blank">
                  แอด LINE เพื่อสั่งซื้อ
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              ) : null}
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
            เปิดตัวช่วยจับคู่
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
