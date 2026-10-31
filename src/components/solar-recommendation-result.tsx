"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Info,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Sun,
  TrendingUp,
  UsersRound,
  Zap,
} from "lucide-react";
import type { SolarAssessmentDraft } from "@/domain/assessment/schema";
import {
  createSolarRecommendation,
  solarRecommendationAssumptions,
  type PaybackRange,
} from "@/domain/assessment/solar-recommendation";

interface SolarRecommendationResultProps {
  draft: SolarAssessmentDraft;
  onEdit: () => void;
  onReset: () => void;
}

const confidenceLabels = {
  high: "ความมั่นใจสูง",
  medium: "ความมั่นใจปานกลาง",
  low: "ความมั่นใจเบื้องต้น",
} as const;

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits }).format(value);
}

function parsePrice(value: string) {
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatPayback(payback: PaybackRange | null) {
  if (!payback) return "กรอกราคา Package";
  if (payback.slowestYears > 30) return "มากกว่า 30 ปี";
  return `${formatNumber(payback.fastestYears, 1)}–${formatNumber(payback.slowestYears, 1)} ปี`;
}

function getPaybackSignal(payback: PaybackRange | null) {
  if (!payback) return "ระบบจะคำนวณทันทีเมื่อมีราคาติดตั้ง";
  const midpoint = (payback.fastestYears + payback.slowestYears) / 2;
  if (midpoint <= 8) return "ช่วงคืนทุนค่อนข้างเร็วสำหรับแบบจำลองเบื้องต้น";
  if (midpoint <= 12) return "อยู่ในช่วงที่ควรเทียบราคาและตรวจหลังคาเพิ่มเติม";
  return "ควรทบทวนราคา Package หรือเลือกขนาดที่เล็กลง";
}

export function SolarRecommendationResult({
  draft,
  onEdit,
  onReset,
}: SolarRecommendationResultProps) {
  const baseRecommendation = useMemo(
    () => createSolarRecommendation(draft),
    [draft],
  );
  const [selectedSystemSizeKw, setSelectedSystemSizeKw] = useState(
    baseRecommendation.recommendedSystemSizeKw,
  );
  const [packagePriceInput, setPackagePriceInput] = useState("");
  const packagePriceThb = parsePrice(packagePriceInput);
  const recommendation = useMemo(
    () =>
      createSolarRecommendation(draft, {
        packagePriceThb,
        systemSizeKw: selectedSystemSizeKw,
      }),
    [draft, packagePriceThb, selectedSystemSizeKw],
  );
  const peakGeneration = recommendation.energy.peakWindow.generationKwh;
  const peakSelfUsePercent = peakGeneration > 0
    ? (recommendation.energy.peakWindow.selfUseKwh / peakGeneration) * 100
    : 0;
  const peakExportPercent = Math.max(100 - peakSelfUsePercent, 0);
  const isRecommendedScenario =
    selectedSystemSizeKw === recommendation.recommendedSystemSizeKw;
  const paybackForDecision = recommendation.confirmedPayback;
  const communityHref = `/community-buy/join?systemSizeKw=${selectedSystemSizeKw}${
    packagePriceThb > 0 ? `&packagePriceThb=${packagePriceThb}` : ""
  }${
    recommendation.investmentScore
      ? `&investmentScore=${recommendation.investmentScore.score}`
      : ""
  }`;

  return (
    <section
      className="assessment-result"
      aria-labelledby="assessment-result-title"
    >
      <header className="assessment-result__hero">
        <div>
          <p className="eyebrow eyebrow--dark">ENERGY FIT RECOMMENDATION</p>
          <h1 id="assessment-result-title">
            เริ่มพิจารณาที่ {recommendation.recommendedSystemSizeKw} kW
          </h1>
          <p>
            ขนาดนี้สมดุลระหว่างไฟที่บ้านใช้กับพลังงานที่คาดว่าจะผลิตได้
            คุณสามารถลอง Package อื่นและใส่ราคาจริงเพื่อดูช่วงคืนทุนได้ทันที
          </p>
        </div>
        <div className="assessment-result__confidence">
          <span>{confidenceLabels[recommendation.confidence]}</span>
          <strong>
            {recommendation.consumptionSource === "bill-kwh"
              ? "ใช้หน่วย kWh จากบิล"
              : "ประมาณหน่วยไฟจากยอดค่าไฟ"}
          </strong>
          <small>ยังไม่รวมพื้นที่หลังคา ทิศ เงาบัง และข้อจำกัดอินเวอร์เตอร์</small>
        </div>
      </header>

      <div className="assessment-result__metrics" aria-label="ผลผลิตพลังงานรายเดือน">
        <article>
          <Sun size={21} aria-hidden="true" />
          <span>ผลิตไฟได้ประมาณ</span>
          <strong>{formatNumber(recommendation.energy.monthlyGenerationKwh)} kWh</strong>
          <small>ต่อเดือน · Package {selectedSystemSizeKw} kW</small>
        </article>
        <article>
          <Zap size={21} aria-hidden="true" />
          <span>คาดว่าใช้เอง</span>
          <strong>{formatNumber(recommendation.energy.monthlySelfUseKwh)} kWh</strong>
          <small>
            {formatNumber(recommendation.energy.selfConsumptionRatio * 100)}% ของไฟที่ผลิต
          </small>
        </article>
        <article>
          <TrendingUp size={21} aria-hidden="true" />
          <span>เหลือส่งออก</span>
          <strong>{formatNumber(recommendation.energy.monthlyExportKwh)} kWh</strong>
          <small>
            {draft.exportIntent === "none"
              ? "ไม่นับเป็นรายได้ตามตัวเลือกของคุณ"
              : `มูลค่าศักยภาพ ≈ ${formatNumber(recommendation.monthlyExportValueThb)} บาท/เดือน`}
          </small>
        </article>
      </div>

      <section className="peak-window" aria-labelledby="peak-window-title">
        <div className="peak-window__heading">
          <div>
            <p className="eyebrow eyebrow--dark">PEAK PRODUCTION WINDOW</p>
            <h2 id="peak-window-title">ช่วง 10:00–14:00 จะเหลือไฟเท่าไร</h2>
          </div>
          <p>
            ถ้าช่วงนี้มีคนน้อยและเปิดแอร์น้อย สัดส่วนไฟส่งออกจะสูงขึ้น
            แบบจำลองจึงเทียบกำลังผลิตกับโหลดช่วงกลางวันโดยตรง
          </p>
        </div>

        <div className="peak-window__figures">
          <div>
            <span>ผลิตช่วง Peak</span>
            <strong>{formatNumber(peakGeneration)} kWh/เดือน</strong>
          </div>
          <div>
            <span>โหลดช่วง Peak</span>
            <strong>{formatNumber(recommendation.energy.peakWindow.loadKwh)} kWh/เดือน</strong>
          </div>
          <div>
            <span>เหลือจากช่วง Peak</span>
            <strong>{formatNumber(recommendation.energy.peakWindow.exportKwh)} kWh/เดือน</strong>
          </div>
        </div>

        <div
          className="peak-window__bar"
          aria-label={`ไฟช่วง 10 ถึง 14 นาฬิกา ใช้เอง ${formatNumber(peakSelfUsePercent)} เปอร์เซ็นต์ ส่งออก ${formatNumber(peakExportPercent)} เปอร์เซ็นต์`}
        >
          <span
            className="peak-window__self-use"
            style={{ width: `${peakSelfUsePercent}%` }}
          />
          <span
            className="peak-window__export"
            style={{ width: `${peakExportPercent}%` }}
          />
        </div>
        <div className="peak-window__legend">
          <span><i data-tone="self" />ใช้เอง {formatNumber(peakSelfUsePercent)}%</span>
          <span><i data-tone="export" />ส่งออก {formatNumber(peakExportPercent)}%</span>
        </div>
      </section>

      <section className="package-simulator" aria-labelledby="package-simulator-title">
        <div className="package-simulator__intro">
          <p className="eyebrow eyebrow--dark">PACKAGE SIMULATOR</p>
          <h2 id="package-simulator-title">ลองขนาดและราคาที่ได้รับเสนอ</h2>
          <p>
            เลือกขนาดระบบ แล้วกรอกราคารวมอุปกรณ์และติดตั้ง
            ระบบจะแสดงช่วงคืนทุนจากผลผลิตต่ำ–สูง ไม่ใช้ตัวเลขเดียวตัดสินความคุ้มค่า
          </p>
        </div>

        <div className="package-simulator__controls">
          <fieldset>
            <legend>ขนาด Package</legend>
            <div className="package-size-options">
              {solarRecommendationAssumptions.candidateSystemSizesKw.map((sizeKw) => (
                <button
                  key={sizeKw}
                  type="button"
                  data-selected={selectedSystemSizeKw === sizeKw}
                  onClick={() => setSelectedSystemSizeKw(sizeKw)}
                >
                  <strong>{sizeKw} kW</strong>
                  <span>
                    {sizeKw === recommendation.recommendedSystemSizeKw
                      ? "แนะนำ"
                      : "ลองสถานการณ์"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="package-price-input">
            <span>ราคา Package รวมติดตั้ง</span>
            <div>
              <Banknote size={20} aria-hidden="true" />
              <input
                autoComplete="off"
                inputMode="decimal"
                placeholder="เช่น 220,000"
                type="text"
                value={packagePriceInput}
                onChange={(event) => setPackagePriceInput(event.target.value)}
              />
              <span>บาท</span>
            </div>
            <small>ใช้ราคาสุทธิที่ต้องจ่ายจริงหลังส่วนลด</small>
          </label>
        </div>

        <div className="package-value-grid" aria-live="polite">
          <article>
            <Activity size={21} aria-hidden="true" />
            <span>ลดค่าไฟจากการใช้เอง</span>
            <strong>≈ {formatNumber(recommendation.monthlyBillSavingThb)} บาท/เดือน</strong>
            <small>
              คิดที่ {formatNumber(recommendation.selfUseValueBahtPerKwh, 2)} บาท/kWh
            </small>
          </article>
          <article>
            <TrendingUp size={21} aria-hidden="true" />
            <span>รายได้ขายคืนที่เป็นไปได้</span>
            <strong>≈ {formatNumber(recommendation.monthlyExportValueThb)} บาท/เดือน</strong>
            <small>
              {draft.exportIntent === "contracted"
                ? "รวมในผลตอบแทน เพราะระบุว่ามีสัญญาแล้ว"
                : draft.exportIntent === "interested"
                  ? "แสดงเป็น upside ยังไม่รวมในผลตอบแทนยืนยัน"
                  : "ไม่นับรายได้ เพราะเลือกไม่ขายคืน"}
            </small>
          </article>
          <article className="package-value-grid__payback">
            <Banknote size={21} aria-hidden="true" />
            <span>ระยะคืนทุนอย่างง่าย</span>
            <strong>{formatPayback(paybackForDecision)}</strong>
            <small>{getPaybackSignal(paybackForDecision)}</small>
          </article>
        </div>

        {draft.exportIntent === "interested" && packagePriceThb > 0 ? (
          <div className="package-export-boundary">
            <Info size={20} aria-hidden="true" />
            <p>
              ไม่รวมรายได้ขายคืน: {formatPayback(recommendation.confirmedPayback)} ·
              หากขายได้ที่ 2.20 บาท/kWh: {formatPayback(recommendation.potentialPayback)}
            </p>
          </div>
        ) : null}

        <section className="investment-score" aria-labelledby="investment-score-title">
          <div className="investment-score__gauge" data-band={recommendation.investmentScore?.band ?? "pending"}>
            <span>SCORE</span>
            <strong>{recommendation.investmentScore?.score ?? "—"}</strong>
            <small>/ 100</small>
          </div>
          <div className="investment-score__content">
            <p className="eyebrow">INVESTMENT VALUE SCORE</p>
            <h3 id="investment-score-title">
              {recommendation.investmentScore?.label ?? "ใส่ราคา Package เพื่อดูคะแนน"}
            </h3>
            <p>
              คะแนนคัดกรองจากระยะคืนทุนที่ยืนยันได้ สัดส่วนใช้ไฟเอง และความครบของข้อมูล
              ไม่รวมรายได้ขายคืนที่ยังไม่มีสัญญา
            </p>
            {recommendation.investmentScore ? (
              <dl className="investment-score__breakdown">
                <div><dt>คืนทุน</dt><dd>{recommendation.investmentScore.paybackPoints}/55</dd></div>
                <div><dt>ใช้ไฟเอง</dt><dd>{recommendation.investmentScore.selfUsePoints}/25</dd></div>
                <div><dt>ความมั่นใจ</dt><dd>{recommendation.investmentScore.confidencePoints}/20</dd></div>
              </dl>
            ) : null}
            <small>เป็น Screening Score ไม่ใช่การรับประกันผลตอบแทนทางการเงิน</small>
          </div>
        </section>
      </section>

      <section className="community-next" aria-labelledby="community-next-title">
        <div className="community-next__icon" aria-hidden="true"><UsersRound /></div>
        <div>
          <p className="eyebrow eyebrow--dark">NEXT · COMMUNITY BUY</p>
          <h2 id="community-next-title">รวมความต้องการใกล้บ้าน เพื่อให้ต่อรองได้มากขึ้น</h2>
          <p>
            ลงทะเบียนความสนใจตามพื้นที่และระยะ 10–20 กม. EasySolar จะรวม Demand
            ก่อนคัดเลือก EPC และ Package มาตรฐาน โดยยังไม่มีข้อผูกมัดในการซื้อ
          </p>
          <ul>
            <li><MapPin size={17} aria-hidden="true" />พิกัดจริงเก็บเป็นข้อมูลส่วนตัว</li>
            <li><ShieldCheck size={17} aria-hidden="true" />ไม่ส่งข้อมูลให้ EPC จนกว่าจะถึงขั้นยืนยัน</li>
          </ul>
        </div>
        <Link className="button button--sun" href={communityHref}>
          ลงทะเบียนความสนใจ
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>

      <section className="model-assumptions" aria-labelledby="model-assumptions-title">
        <Info size={20} aria-hidden="true" />
        <div>
          <h2 id="model-assumptions-title">สมมติฐานที่ใช้ในแบบจำลอง</h2>
          <ul>
            <li>
              ผลผลิตสุทธิ {solarRecommendationAssumptions.yieldKwhPerKwpDay.conservative}–{solarRecommendationAssumptions.yieldKwhPerKwpDay.optimistic} kWh/kWp/วัน
              และใช้ค่ากลาง {solarRecommendationAssumptions.yieldKwhPerKwpDay.expected} kWh/kWp/วัน
            </li>
            <li>
              กระจาย 58% ของพลังงานไปที่ช่วง 10:00–14:00 แล้วเทียบกับจำนวนคนและแอร์ช่วงกลางวัน
            </li>
            <li>
              ราคาไฟขายคืน 2.20 บาท/kWh เป็น Product Owner assumption และสิทธิ์จริงขึ้นกับโครงการ/สัญญา
            </li>
            <li>ยังไม่รวม degradation, maintenance, financing, เงาหลังคา และการจำกัดการส่งออก</li>
          </ul>
          <p>
            อ้างอิงวิธีสื่อสารผลผลิตจาก{" "}
            <a href="https://globalsolaratlas.info/support/methodology" rel="noreferrer" target="_blank">
              Global Solar Atlas
            </a>{" "}
            และกรอบความไม่แน่นอนของ{" "}
            <a href="https://pvwatts.nrel.gov/" rel="noreferrer" target="_blank">
              NREL PVWatts
            </a>
          </p>
        </div>
      </section>

      <div className="assessment-result__actions">
        <button className="button button--ink" type="button" onClick={onEdit}>
          แก้ไขข้อมูล
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <button className="assessment-reset" type="button" onClick={onReset}>
          <RotateCcw size={17} aria-hidden="true" />
          เริ่มแบบประเมินใหม่
        </button>
        {!isRecommendedScenario ? (
          <button
            className="text-link package-reset-size"
            type="button"
            onClick={() =>
              setSelectedSystemSizeKw(recommendation.recommendedSystemSizeKw)
            }
          >
            กลับไปขนาดแนะนำ {recommendation.recommendedSystemSizeKw} kW
          </button>
        ) : null}
      </div>
    </section>
  );
}
