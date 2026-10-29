"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Check,
  Clock3,
  FileText,
  Home,
  Info,
  Moon,
  RotateCcw,
  Snowflake,
  Sun,
  Sunset,
  Users,
  Zap,
} from "lucide-react";
import {
  acUsageStepSchema,
  assessmentPeriodKeys,
  billStepSchema,
  occupancyStepSchema,
  policyStepSchema,
  solarAssessmentDraftSchema,
  summarizeAssessmentDraft,
  type AssessmentPeriodKey,
  type SolarAssessmentDraft,
} from "@/domain/assessment/schema";

const draftStorageKey = "easysolar:assessment-draft:v1";

const steps = [
  { label: "บิลค่าไฟ", shortLabel: "บิล", icon: FileText },
  { label: "คนอยู่บ้าน", shortLabel: "การอยู่บ้าน", icon: Users },
  { label: "เครื่องปรับอากาศ", shortLabel: "แอร์", icon: Snowflake },
  { label: "อัตราและขายคืน", shortLabel: "อัตราไฟ", icon: Zap },
  { label: "ตรวจทาน", shortLabel: "ตรวจทาน", icon: BadgeCheck },
] as const;

const periodDetails: Record<
  AssessmentPeriodKey,
  { label: string; time: string; detail: string; icon: typeof Sun }
> = {
  morning: {
    label: "ช่วงเช้า",
    time: "06:00–10:00",
    detail: "ก่อนออกจากบ้านหรือเริ่มงาน",
    icon: Sun,
  },
  daytime: {
    label: "ช่วงกลางวัน",
    time: "10:00–16:00",
    detail: "ช่วงที่ Solar ผลิตไฟได้มาก",
    icon: Clock3,
  },
  evening: {
    label: "ช่วงเย็น",
    time: "16:00–22:00",
    detail: "หลังเลิกงานถึงก่อนนอน",
    icon: Sunset,
  },
  night: {
    label: "ช่วงกลางคืน",
    time: "22:00–06:00",
    detail: "ช่วงพักผ่อนและนอนหลับ",
    icon: Moon,
  },
};

const initialDraft: SolarAssessmentDraft = {
  bills: [
    { amountThb: 0, energyKwh: null },
    { amountThb: 0, energyKwh: null },
    { amountThb: 0, energyKwh: null },
  ],
  occupancy: { morning: 0, daytime: 0, evening: 0, night: 0 },
  acUsage: {
    morning: { enabled: false, hours: 0, unitCount: 0 },
    daytime: { enabled: false, hours: 0, unitCount: 0 },
    evening: { enabled: false, hours: 0, unitCount: 0 },
    night: { enabled: false, hours: 0, unitCount: 0 },
  },
  exportIntent: "none",
  tariff: "unknown",
};

const tariffLabels = {
  normal: "อัตราปกติ",
  tou: "TOU",
  unknown: "ยังไม่ทราบ",
} as const;

const exportLabels = {
  none: "ไม่ขายคืน",
  interested: "สนใจขายคืน แต่ยังไม่มีสัญญา",
  contracted: "มีสัญญาหรือเข้าร่วมโครงการแล้ว",
} as const;

function toNumber(value: string) {
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits }).format(value);
}

function getStepErrors(stepIndex: number, draft: SolarAssessmentDraft) {
  const validators = [
    billStepSchema,
    occupancyStepSchema,
    acUsageStepSchema,
    policyStepSchema,
  ];
  const validator = validators[stepIndex];
  if (!validator) return [];

  const result = validator.safeParse(draft);
  if (result.success) return [];

  const messages = result.error.issues.map((issue) => {
    if (stepIndex === 0) {
      if (issue.path.includes("amountThb")) return "กรอกยอดค่าไฟให้ครบทั้ง 3 บิล (มากกว่า 0 บาท)";
      if (issue.path.includes("energyKwh")) return "หน่วยไฟต้องมากกว่า 0 หรือเว้นว่างไว้";
    }
    return issue.message;
  });

  return [...new Set(messages)];
}

export function SolarAssessmentForm() {
  const [draft, setDraft] = useState<SolarAssessmentDraft>(initialDraft);
  const [currentStep, setCurrentStep] = useState(0);
  const [highestStep, setHighestStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const storedDraft = window.localStorage.getItem(draftStorageKey);
    if (!storedDraft) return;

    const restoreTimer = window.setTimeout(() => {
      try {
        const parsed = solarAssessmentDraftSchema.safeParse(
          JSON.parse(storedDraft),
        );
        if (parsed.success) setDraft(parsed.data);
      } catch {
        window.localStorage.removeItem(draftStorageKey);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  const summary = useMemo(() => {
    const parsed = solarAssessmentDraftSchema.safeParse(draft);
    return parsed.success ? summarizeAssessmentDraft(parsed.data) : null;
  }, [draft]);

  function updateDraft(nextDraft: SolarAssessmentDraft) {
    setDraft(nextDraft);
    window.localStorage.setItem(draftStorageKey, JSON.stringify(nextDraft));
    setErrors([]);
  }

  function moveToStep(stepIndex: number) {
    setCurrentStep(stepIndex);
    setHighestStep((value) => Math.max(value, stepIndex));
    setErrors([]);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }

  function handleNext() {
    const nextErrors = getStepErrors(currentStep, draft);
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }
    moveToStep(Math.min(currentStep + 1, steps.length - 1));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = solarAssessmentDraftSchema.safeParse(draft);
    if (!result.success) {
      setErrors(["ข้อมูลบางส่วนยังไม่ครบ กรุณาย้อนกลับไปตรวจสอบอีกครั้ง"]);
      return;
    }

    setDraft(result.data);
    window.localStorage.setItem(draftStorageKey, JSON.stringify(result.data));
    setErrors([]);
    setIsSubmitted(true);
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  function resetDraft() {
    window.localStorage.removeItem(draftStorageKey);
    setDraft(initialDraft);
    setCurrentStep(0);
    setHighestStep(0);
    setErrors([]);
    setIsSubmitted(false);
  }

  if (isSubmitted && summary) {
    return (
      <section className="assessment-complete" aria-labelledby="assessment-complete-title">
        <div className="assessment-complete__mark" aria-hidden="true">
          <Check size={30} strokeWidth={2} />
        </div>
        <p className="eyebrow eyebrow--dark">ASSESSMENT INPUT COMPLETE</p>
        <h1 id="assessment-complete-title">ข้อมูลพร้อมสำหรับสร้างแบบจำลอง</h1>
        <p className="assessment-complete__lead">
          ระบบบันทึกแบบร่างไว้บนอุปกรณ์นี้แล้ว ตัวเลขด้านล่างเป็นเพียงสรุปข้อมูลที่คุณกรอก
          ยังไม่ใช่ผลประหยัดหรือคำแนะนำขนาดระบบ
        </p>

        <div className="assessment-complete__metrics">
          <div>
            <span>ค่าไฟเฉลี่ย 3 เดือน</span>
            <strong>{formatNumber(summary.averageBillThb)} บาท</strong>
          </div>
          <div>
            <span>คนอยู่เฉลี่ยช่วงมีแสง</span>
            <strong>{formatNumber(summary.daylightAverageOccupancy, 1)} คน</strong>
          </div>
          <div>
            <span>การใช้แอร์ที่ระบุ</span>
            <strong>{formatNumber(summary.estimatedAcHours, 1)} เครื่อง·ชม.</strong>
          </div>
        </div>

        <div className="assessment-complete__notice">
          <Info size={20} aria-hidden="true" />
          <div>
            <strong>ผล Energy Fit จะเปิดหลังเชื่อม Calculation Policy</strong>
            <p>
              ต้องมี Tariff, Ft, Solar Yield และ Export Policy ที่มีวันที่และแหล่งอ้างอิงก่อน
              เพื่อไม่แสดงตัวเลขที่ดูแม่นยำเกินข้อมูลจริง
            </p>
          </div>
        </div>

        <div className="assessment-complete__actions">
          <button className="button button--ink" type="button" onClick={() => setIsSubmitted(false)}>
            แก้ไขข้อมูล
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <button className="assessment-reset" type="button" onClick={resetDraft}>
            <RotateCcw size={17} aria-hidden="true" />
            เริ่มแบบประเมินใหม่
          </button>
        </div>
      </section>
    );
  }

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div className="assessment-shell">
      <aside className="assessment-rail" aria-label="ขั้นตอนการประเมิน">
        <div className="assessment-rail__intro">
          <p className="eyebrow">SOLAR VALUE · ENERGY FIT</p>
          <h1>เริ่มจากวิธีที่คุณใช้ไฟจริง</h1>
          <p>ใช้เวลาประมาณ 3–5 นาที แบบร่างจะบันทึกไว้บนอุปกรณ์นี้</p>
        </div>

        <ol className="assessment-progress">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isCurrent = index === currentStep;
            const isCompleted = index < currentStep;
            return (
              <li key={step.label} data-active={isCurrent} data-complete={isCompleted}>
                <button
                  type="button"
                  disabled={index > highestStep}
                  aria-label={`ไปขั้น ${index + 1}: ${step.label}`}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => moveToStep(index)}
                >
                  <span className="assessment-progress__number">
                    {isCompleted ? <Check size={15} aria-hidden="true" /> : `0${index + 1}`}
                  </span>
                  <StepIcon size={18} aria-hidden="true" />
                  <span>{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="assessment-rail__privacy">
          <Home size={18} aria-hidden="true" />
          <p>
            เวอร์ชันนี้ยังไม่ส่งข้อมูลออกจากเครื่อง และไม่ขอชื่อ ที่อยู่ หรือเลขผู้ใช้ไฟ
          </p>
        </div>
      </aside>

      <form className="assessment-form" noValidate onSubmit={handleSubmit}>
        <div className="assessment-form__topline">
          <span>STEP {currentStep + 1} / {steps.length}</span>
          <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="assessment-form__bar" aria-hidden="true">
          <span style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
        </div>

        <header className="assessment-form__header">
          <CurrentIcon size={24} aria-hidden="true" />
          <div>
            <p>{steps[currentStep].shortLabel}</p>
            <h2 ref={headingRef} tabIndex={-1}>
              {currentStep === 0 && "กรอกยอดค่าไฟจากบิล 3 ใบล่าสุด"}
              {currentStep === 1 && "แต่ละช่วงเวลามีคนอยู่กี่คน"}
              {currentStep === 2 && "เปิดเครื่องปรับอากาศเมื่อไร"}
              {currentStep === 3 && "เลือกอัตราค่าไฟและการขายคืน"}
              {currentStep === 4 && "ตรวจทานก่อนสร้างแบบประเมิน"}
            </h2>
          </div>
        </header>

        <div className="assessment-form__body">
          {currentStep === 0 && (
            <BillStep draft={draft} onChange={updateDraft} />
          )}
          {currentStep === 1 && (
            <OccupancyStep draft={draft} onChange={updateDraft} />
          )}
          {currentStep === 2 && (
            <AcUsageStep draft={draft} onChange={updateDraft} />
          )}
          {currentStep === 3 && (
            <PolicyStep draft={draft} onChange={updateDraft} />
          )}
          {currentStep === 4 && <ReviewStep draft={draft} summary={summary} />}

          {errors.length > 0 && (
            <div className="assessment-errors" role="alert">
              <Info size={19} aria-hidden="true" />
              <div>
                <strong>กรุณาตรวจสอบข้อมูล</strong>
                <ul>
                  {errors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>

        <footer className="assessment-form__actions">
          <button
            className="assessment-back"
            type="button"
            disabled={currentStep === 0}
            onClick={() => moveToStep(Math.max(0, currentStep - 1))}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            ย้อนกลับ
          </button>
          {currentStep < steps.length - 1 ? (
            <button className="button button--sun" type="button" onClick={handleNext}>
              ถัดไป
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <button className="button button--sun" type="submit">
              ยืนยันข้อมูล
              <Check size={18} aria-hidden="true" />
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

interface StepProps {
  draft: SolarAssessmentDraft;
  onChange: (draft: SolarAssessmentDraft) => void;
}

function BillStep({ draft, onChange }: StepProps) {
  const [isEnergyVisible, setIsEnergyVisible] = useState(() =>
    draft.bills.some((bill) => bill.energyKwh !== null),
  );
  const validBills = draft.bills.filter((bill) => bill.amountThb > 0);
  const averageBill = validBills.length === 3
    ? validBills.reduce((total, bill) => total + bill.amountThb, 0) / 3
    : null;

  return (
    <div className="assessment-step">
      <p className="assessment-step__lead">
        ใช้เฉพาะยอดที่จ่ายจริง ไม่ต้องเลือกเดือนและไม่ต้องเรียงลำดับ
      </p>
      <div className="bill-entry-grid">
        {draft.bills.map((bill, index) => (
          <div className="bill-entry-card" key={index}>
            <span className="bill-entry-card__index">บิลที่ {index + 1}</span>
            <label className="input-with-unit">
              <span className="sr-only">ยอดค่าไฟบิลที่ {index + 1}</span>
              <input
                aria-label={`ยอดค่าไฟบิลที่ ${index + 1}`}
                autoComplete="off"
                inputMode="decimal"
                placeholder="เช่น 3,200"
                type="text"
                value={bill.amountThb || ""}
                onChange={(event) => {
                  const bills = [...draft.bills];
                  bills[index] = { ...bill, amountThb: toNumber(event.target.value) };
                  onChange({ ...draft, bills });
                }}
              />
              <span>บาท</span>
            </label>
          </div>
        ))}
      </div>

      <details
        className="bill-energy-details"
        open={isEnergyVisible}
        onToggle={(event) => setIsEnergyVisible(event.currentTarget.open)}
      >
        <summary>
          <span>มีข้อมูลหน่วยไฟ (kWh)</span>
          <small>ไม่บังคับ</small>
        </summary>
        <p>ดูตัวเลข “หน่วยที่ใช้” จากบิล หากหาไม่เจอให้เว้นไว้ได้</p>
        <div className="bill-energy-grid">
          {draft.bills.map((bill, index) => (
            <label className="input-with-unit" key={index}>
              <span className="bill-energy-grid__label">บิลที่ {index + 1}</span>
              <input
                aria-label={`หน่วยไฟบิลที่ ${index + 1}`}
                autoComplete="off"
                inputMode="decimal"
                placeholder="ไม่ทราบ"
                type="text"
                value={bill.energyKwh ?? ""}
                onChange={(event) => {
                  const bills = [...draft.bills];
                  bills[index] = {
                    ...bill,
                    energyKwh: event.target.value === "" ? null : toNumber(event.target.value),
                  };
                  onChange({ ...draft, bills });
                }}
              />
              <span>kWh</span>
            </label>
          ))}
        </div>
      </details>

      <div className="assessment-inline-result" aria-live="polite">
        <Banknote size={20} aria-hidden="true" />
        <div>
          <span>{averageBill === null ? `กรอกแล้ว ${validBills.length} จาก 3 บิล` : "ค่าไฟเฉลี่ย 3 เดือน"}</span>
          <strong>{averageBill === null ? "กรอกยอดให้ครบเพื่อไปต่อ" : `${formatNumber(averageBill)} บาท/เดือน`}</strong>
        </div>
      </div>
    </div>
  );
}

function OccupancyStep({ draft, onChange }: StepProps) {
  return (
    <div className="assessment-step">
      <p className="assessment-step__lead">
        ระบุจำนวนคนที่อยู่บ้านหรืออาคารเป็นส่วนใหญ่ในแต่ละช่วง ค่า 0 หมายถึงไม่มีคนอยู่
        ระบบจะหาค่าเฉลี่ยตามเวลา ไม่ได้นำจำนวนคนแต่ละช่วงมาบวกกัน
      </p>
      <div className="period-list">
        {assessmentPeriodKeys.map((period) => {
          const detail = periodDetails[period];
          const PeriodIcon = detail.icon;
          return (
            <label className="period-row" key={period}>
              <PeriodIcon size={21} aria-hidden="true" />
              <span className="period-row__copy">
                <strong>{detail.label}</strong>
                <small>{detail.time} · {detail.detail}</small>
              </span>
              <span className="input-with-unit input-with-unit--compact">
                <input
                  aria-label={`จำนวนคน${detail.label}`}
                  inputMode="numeric"
                  min="0"
                  max="30"
                  type="number"
                  value={draft.occupancy[period]}
                  onChange={(event) => onChange({
                    ...draft,
                    occupancy: { ...draft.occupancy, [period]: toNumber(event.target.value) },
                  })}
                />
                <span>คน</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function AcUsageStep({ draft, onChange }: StepProps) {
  return (
    <div className="assessment-step">
      <p className="assessment-step__lead">
        เปิดเฉพาะช่วงเวลาที่ใช้งานจริง แล้วประมาณจำนวนเครื่องและชั่วโมงเฉลี่ยต่อวันได้เลย
      </p>
      <div className="ac-periods">
        {assessmentPeriodKeys.map((period) => {
          const detail = periodDetails[period];
          const usage = draft.acUsage[period];
          return (
            <fieldset className="ac-period" data-enabled={usage.enabled} key={period}>
              <legend className="sr-only">การใช้แอร์{detail.label}</legend>
              <label className="ac-period__toggle">
                <input
                  type="checkbox"
                  checked={usage.enabled}
                  onChange={(event) => onChange({
                    ...draft,
                    acUsage: {
                      ...draft.acUsage,
                      [period]: event.target.checked
                        ? { enabled: true, hours: 1, unitCount: 1 }
                        : { enabled: false, hours: 0, unitCount: 0 },
                    },
                  })}
                />
                <span aria-hidden="true"><Check size={14} /></span>
                <span>
                  <strong>{detail.label}</strong>
                  <small>{detail.time}</small>
                </span>
              </label>
              <div className="ac-period__inputs" aria-hidden={!usage.enabled}>
                <label>
                  <span>จำนวนเครื่อง</span>
                  <input
                    disabled={!usage.enabled}
                    min="1"
                    max="20"
                    type="number"
                    value={usage.unitCount || ""}
                    onChange={(event) => onChange({
                      ...draft,
                      acUsage: {
                        ...draft.acUsage,
                        [period]: { ...usage, unitCount: toNumber(event.target.value) },
                      },
                    })}
                  />
                </label>
                <label>
                  <span>ชั่วโมงโดยประมาณ</span>
                  <input
                    disabled={!usage.enabled}
                    min="0.5"
                    max="12"
                    step="0.5"
                    type="number"
                    value={usage.hours || ""}
                    onChange={(event) => onChange({
                      ...draft,
                      acUsage: {
                        ...draft.acUsage,
                        [period]: { ...usage, hours: toNumber(event.target.value) },
                      },
                    })}
                  />
                </label>
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function PolicyStep({ draft, onChange }: StepProps) {
  return (
    <div className="assessment-step assessment-step--policy">
      <fieldset className="choice-group">
        <legend>อัตราค่าไฟของคุณ</legend>
        <p>หากไม่แน่ใจ เลือก “ยังไม่ทราบ” ได้ ระบบจะไม่บังคับให้เดา</p>
        <div className="choice-list">
          {([
            ["normal", "อัตราปกติ", "ค่าไฟราคาเดียวตามประเภทผู้ใช้ไฟ"],
            ["tou", "TOU", "ราคาต่างกันระหว่าง On Peak และ Off Peak"],
            ["unknown", "ยังไม่ทราบ", "ตรวจจากบิลภายหลังและลดระดับความมั่นใจ"],
          ] as const).map(([value, label, detail]) => (
            <label className="choice-row" data-selected={draft.tariff === value} key={value}>
              <input
                name="tariff"
                type="radio"
                value={value}
                checked={draft.tariff === value}
                onChange={() => onChange({ ...draft, tariff: value })}
              />
              <span className="choice-row__control" aria-hidden="true" />
              <span><strong>{label}</strong><small>{detail}</small></span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="choice-group">
        <legend>ต้องการขายไฟส่วนเกินคืนหรือไม่</legend>
        <p>รายได้จากการขายคืนจะแสดงเฉพาะเมื่อมีโครงการหรืออัตราที่ตรวจสอบได้</p>
        <div className="choice-list">
          {([
            ["none", "ไม่ขายคืน", "พลังงานส่วนเกินยังแสดง แต่รายได้ขายคืนเป็น 0"],
            ["interested", "สนใจ แต่ยังไม่มีสัญญา", "แสดงโอกาสส่งออกโดยยังไม่นับเป็นรายได้"],
            ["contracted", "มีสัญญาหรือเข้าร่วมโครงการแล้ว", "ต้องระบุโครงการและอัตราในขั้นถัดไป"],
          ] as const).map(([value, label, detail]) => (
            <label className="choice-row" data-selected={draft.exportIntent === value} key={value}>
              <input
                name="export-intent"
                type="radio"
                value={value}
                checked={draft.exportIntent === value}
                onChange={() => onChange({ ...draft, exportIntent: value })}
              />
              <span className="choice-row__control" aria-hidden="true" />
              <span><strong>{label}</strong><small>{detail}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function ReviewStep({
  draft,
  summary,
}: {
  draft: SolarAssessmentDraft;
  summary: ReturnType<typeof summarizeAssessmentDraft> | null;
}) {
  return (
    <div className="assessment-step assessment-review">
      <p className="assessment-step__lead">
        ตรวจว่าข้อมูลสะท้อนการใช้ไฟโดยทั่วไปของคุณ ข้อมูลเหล่านี้ยังไม่ใช่ข้อสรุปทางวิศวกรรมหรือการเงิน
      </p>
      <dl className="review-list">
        <div>
          <dt>ค่าไฟเฉลี่ย 3 เดือน</dt>
          <dd>{summary ? `${formatNumber(summary.averageBillThb)} บาท/เดือน` : "ข้อมูลไม่ครบ"}</dd>
        </div>
        <div>
          <dt>หน่วยไฟเฉลี่ย</dt>
          <dd>{summary?.averageEnergyKwh ? `${formatNumber(summary.averageEnergyKwh)} kWh/เดือน` : "ไม่ได้ระบุครบ 3 เดือน"}</dd>
        </div>
        <div>
          <dt>คนอยู่เฉลี่ยช่วงมีแสง (06:00–16:00)</dt>
          <dd>{summary ? `${formatNumber(summary.daylightAverageOccupancy, 1)} คน` : "—"}</dd>
        </div>
        <div>
          <dt>ช่วงเวลาที่เปิดแอร์</dt>
          <dd>{summary ? `${summary.enabledAcPeriods} จาก 4 ช่วง` : "—"}</dd>
        </div>
        <div>
          <dt>อัตราค่าไฟ</dt>
          <dd>{tariffLabels[draft.tariff]}</dd>
        </div>
        <div>
          <dt>การขายไฟคืน</dt>
          <dd>{exportLabels[draft.exportIntent]}</dd>
        </div>
      </dl>
      <div className="review-boundary">
        <Info size={20} aria-hidden="true" />
        <p>
          ขั้นตอนนี้ยืนยันเฉพาะข้อมูลนำเข้า ระบบยังไม่คำนวณ ROI, Payback หรือคำว่า “คุ้ม”
          จนกว่าจะมีต้นทุนติดตั้งและนโยบายอ้างอิงครบ
        </p>
      </div>
    </div>
  );
}
