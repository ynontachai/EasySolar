"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, ChevronRight, Download, X } from "lucide-react";
import type { OverallStatus, RuleFinding, RuleStatus, SizingResult } from "@/domain/sizing/types";
import { ThemeSelect } from "@/components/theme-select";

export interface CheckerEquipmentOption {
  datasheetPath: string | null;
  imageAlt: string | null;
  imageUrl: string | null;
  isDemo: boolean;
  manufacturer: string;
  model: string;
  revisionLabel: string;
  value: string;
}

interface CheckerWorkspaceProps {
  initialInverterId: string;
  initialPvModuleId: string;
  initialResult: SizingResult;
  inverterOptions: CheckerEquipmentOption[];
  lineOaUrl?: string;
  pvOptions: CheckerEquipmentOption[];
}

interface SpecRow {
  label: string;
  source?: "DATASHEET" | "DERIVED" | "USER_OVERRIDE" | "MISSING";
  value: string;
}

const verdictCopy: Record<OverallStatus, { label: string; detail: string }> = {
  PRELIMINARY_COMPATIBLE: {
    label: "จับคู่นี้ใช้ได้เบื้องต้น",
    detail: "ผ่านเงื่อนไขไฟฟ้าที่ระบบตรวจ ควรให้วิศวกรตรวจทานก่อนติดตั้งจริง",
  },
  INCOMPATIBLE: {
    label: "จับคู่นี้ใช้ไม่ได้ตามเงื่อนไข",
    detail: "ไม่มีรูปแบบการต่อที่ผ่านเงื่อนไข ลองเปลี่ยนรุ่นอินเวอร์เตอร์หรือแผง",
  },
  INSUFFICIENT_DATA: {
    label: "ข้อมูลยังไม่พอยืนยัน",
    detail: "ระบบหยุดการแนะนำชุดจนกว่าจะมีข้อมูลสำคัญครบและตรวจสอบกับ Datasheet แล้ว",
  },
};

function StatusMark({ status }: { status: RuleStatus }) {
  const isPass = status === "PASS";
  const isWarning = status === "WARNING" || status === "INCOMPLETE";
  const label = isPass ? "ผ่าน" : status === "WARNING" ? "คำเตือน" : status === "INCOMPLETE" ? "ข้อมูลไม่ครบ" : "ไม่ผ่าน";
  return (
    <span className={`mark mark--${isPass ? "pass" : isWarning ? "warning" : "fail"}`} role="img" aria-label={label}>
      {isPass ? <Check size={14} aria-hidden="true" /> : isWarning ? <AlertTriangle size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
    </span>
  );
}

function Pass({ ok }: { ok: boolean }) {
  return <StatusMark status={ok ? "PASS" : "FAIL"} />;
}

function EquipmentPicker({
  idPrefix,
  label,
  onChange,
  options,
  value,
}: {
  idPrefix: string;
  label: string;
  onChange: (value: string) => void;
  options: CheckerEquipmentOption[];
  value: string;
}) {
  const selected = options.find((option) => option.value === value);
  const brands = Array.from(new Set(options.map((option) => option.manufacturer)));
  const models = options.filter((option) => option.manufacturer === selected?.manufacturer);

  return (
    <div className="picker">
      <h2>{label}</h2>
      <div className="picker__row">
        <div className="field-group">
          <label htmlFor={`${idPrefix}-brand`}>เลือกยี่ห้อ</label>
          <ThemeSelect
            id={`${idPrefix}-brand`}
            onValueChange={(brand) =>
              onChange(options.find((option) => option.manufacturer === brand)?.value ?? value)
            }
            options={brands.map((brand) => ({ label: brand, value: brand }))}
            value={selected?.manufacturer ?? ""}
          />
        </div>
        <div className="field-group">
          <label htmlFor={`${idPrefix}-model`}>เลือกรุ่น</label>
          <ThemeSelect
            id={`${idPrefix}-model`}
            onValueChange={onChange}
            options={models.map((option) => ({ label: option.model, value: option.value }))}
            searchable={models.length > 8}
            value={value}
          />
        </div>
      </div>
    </div>
  );
}

function SpecCard({
  option,
  rows,
  title,
}: {
  option: CheckerEquipmentOption | undefined;
  rows: SpecRow[];
  title: string;
}) {
  return (
    <article className="spec-card">
      <h3>{title}</h3>
      <p className="spec-card__meta">
        Revision {option?.revisionLabel ?? "ไม่ทราบ"} · {option?.isDemo ? "ข้อมูลทดลอง · ยังไม่ verified" : "ตรวจสอบและเผยแพร่แล้ว"}
      </p>
      <div className="spec-card__body">
        <div className={`spec-card__image${option?.imageUrl ? "" : " spec-card__image--empty"}`}>
          {option?.imageUrl ? (
            <Image alt={option.imageAlt ?? ""} fill sizes="96px" src={option.imageUrl} unoptimized />
          ) : null}
        </div>
        <dl>
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                {row.value}
                {row.source ? (
                  <small className={`spec-source spec-source--${row.source.toLowerCase()}`}>
                    {row.source === "DATASHEET"
                      ? "Datasheet"
                      : row.source === "DERIVED"
                        ? "Derived · อนุมัติแล้ว"
                        : row.source === "USER_OVERRIDE"
                          ? "ผู้ใช้กรอก"
                        : "ไม่พบ"}
                  </small>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {option?.datasheetPath ? (
        <a className="spec-card__download" href={option.datasheetPath}>
          <Download size={16} aria-hidden="true" /> ดาวน์โหลด Datasheet
        </a>
      ) : (
        <p className="spec-card__note">
          {option?.isDemo ? "ข้อมูลตัวอย่างสำหรับทดลอง" : "ยังไม่มีไฟล์ Datasheet"}
        </p>
      )}
    </article>
  );
}

function ConnectionLayout({ candidate }: { candidate: SizingResult["candidates"][number] }) {
  return (
    <div className="connection-layout">
      {candidate.mpptConfigurations.map((configuration) => (
        <section className="connection-mppt" key={configuration.trackerIndex}>
          <div className="connection-mppt__strings">
            {Array.from({ length: configuration.parallelStrings }, (_, stringIndex) => (
              <div className="connection-string" key={stringIndex}>
                <span>String {stringIndex + 1}</span>
                <div
                  aria-label={`${configuration.seriesModules} แผงต่ออนุกรม`}
                  className="connection-string__modules"
                  role="img"
                >
                  {Array.from({ length: configuration.seriesModules }, (_, moduleIndex) => (
                    <i aria-hidden="true" key={moduleIndex} />
                  ))}
                </div>
                <strong>{configuration.seriesModules} แผง</strong>
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="connection-mppt__wire" />
          <div className="connection-mppt__target">
            <small>INVERTER</small>
            <strong>MPPT {configuration.trackerIndex}</strong>
            <span>{configuration.parallelStrings} String</span>
          </div>
        </section>
      ))}
    </div>
  );
}

function Step({ children, number, title }: { children: React.ReactNode; number: number; title: string }) {
  return (
    <section className="calc-step">
      <h3>
        <span>{number}</span> {title}
      </h3>
      {children}
    </section>
  );
}

function FindingRow({ finding }: { finding: RuleFinding }) {
  return (
    <li>
      <StatusMark status={finding.status} />
      <span>
        <strong>{finding.label}</strong>
        <small>
          {finding.measured} · เกณฑ์ {finding.limit}
        </small>
      </span>
    </li>
  );
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function CheckerWorkspace({
  initialInverterId,
  initialPvModuleId,
  initialResult,
  inverterOptions,
  lineOaUrl,
  pvOptions,
}: CheckerWorkspaceProps) {
  const [tcellMinC, setTcellMinC] = useState(-10);
  const [tcellMaxC, setTcellMaxC] = useState(70);
  const [targetDcPowerKw, setTargetDcPowerKw] = useState(11);
  const [currentSafetyFactor, setCurrentSafetyFactor] = useState(1.25);
  const [pvModule, setPvModule] = useState(initialPvModuleId);
  const [inverter, setInverter] = useState(initialInverterId);
  const [result, setResult] = useState(initialResult);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [overrideMaxDcPowerKw, setOverrideMaxDcPowerKw] = useState("");
  const [overrideStartupVoltageV, setOverrideStartupVoltageV] = useState("");
  const [overrideBetaVocPercent, setOverrideBetaVocPercent] = useState("");
  const [overrideBetaVmpPercent, setOverrideBetaVmpPercent] = useState("");
  const [bifacialMode, setBifacialMode] = useState<"" | "FRONT_SIDE_ONLY" | "USER_DESIGN_CASE">("");
  const [bifacialAcknowledged, setBifacialAcknowledged] = useState(false);
  const [rearGainPercent, setRearGainPercent] = useState("");
  const [rearPmaxWp, setRearPmaxWp] = useState("");
  const [rearVocV, setRearVocV] = useState("");
  const [rearVmpV, setRearVmpV] = useState("");
  const [rearIscA, setRearIscA] = useState("");
  const [rearImpA, setRearImpA] = useState("");
  const latestRequest = useRef(0);

  function clearOverrides() {
    setOverrideMaxDcPowerKw("");
    setOverrideStartupVoltageV("");
    setOverrideBetaVocPercent("");
    setOverrideBetaVmpPercent("");
    setBifacialMode("");
    setBifacialAcknowledged(false);
    setRearGainPercent("");
    setRearPmaxWp("");
    setRearVocV("");
    setRearVmpV("");
    setRearIscA("");
    setRearImpA("");
  }

  async function calculate(next: { inverter?: string; pvModule?: string; resetOverrides?: boolean } = {}) {
    const pvModuleId = next.pvModule ?? pvModule;
    const inverterId = next.inverter ?? inverter;
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setErrorMessage("");

    try {
      const maxDcPowerKw = optionalNumber(overrideMaxDcPowerKw);
      const startupVoltageV = optionalNumber(overrideStartupVoltageV);
      const betaVocPercent = optionalNumber(overrideBetaVocPercent);
      const betaVmpPercent = optionalNumber(overrideBetaVmpPercent);
      const bifacial = bifacialMode === "FRONT_SIDE_ONLY" && bifacialAcknowledged
        ? { acknowledged: true as const, mode: "FRONT_SIDE_ONLY" as const }
        : bifacialMode === "USER_DESIGN_CASE"
          ? {
              impA: Number(rearImpA),
              iscA: Number(rearIscA),
              mode: "USER_DESIGN_CASE" as const,
              pmaxWp: Number(rearPmaxWp),
              rearGainFraction: Number(rearGainPercent) / 100,
              vmpV: Number(rearVmpV),
              vocV: Number(rearVocV),
            }
          : undefined;
      const overrides = next.resetOverrides
        ? undefined
        : {
            ...(maxDcPowerKw === undefined ? {} : { maxDcPowerWp: maxDcPowerKw * 1000 }),
            ...(startupVoltageV === undefined ? {} : { startupVoltageV }),
            ...(betaVocPercent === undefined ? {} : { betaVocPerC: betaVocPercent / 100 }),
            ...(betaVmpPercent === undefined ? {} : { betaVmpPerC: betaVmpPercent / 100 }),
            ...(bifacial ? { bifacial } : {}),
          };
      const response = await fetch("/api/v1/sizing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pvModuleId,
          inverterId,
          ...(overrides && Object.keys(overrides).length ? { overrides } : {}),
          assumptions: {
            tcellMinC,
            tcellMaxC,
            currentSafetyFactor,
            targetDcPowerWp: targetDcPowerKw * 1000,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "ไม่สามารถคำนวณได้");
      if (requestId === latestRequest.current) setResult(payload as SizingResult);
    } catch (error) {
      if (requestId === latestRequest.current) {
        setErrorMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ");
      }
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  }

  const wt = result.walkthrough;
  const pv = wt.pvModule;
  const design = wt.designElectricals;
  const calculationVmpV = design?.vmpV ?? pv.vmpV;
  const calculationVocV = design?.vocV ?? pv.vocV;
  const inv = wt.inverterLimits;
  const verdict = verdictCopy[result.overallStatus];
  const pvOption = pvOptions.find((option) => option.value === result.equipment.pvModule.id);
  const inverterOption = inverterOptions.find((option) => option.value === result.equipment.inverter.id);
  const bestCandidate = result.candidates[0];
  const hasUserOverrides = result.overrides !== null;
  const canOrder = result.overallStatus === "PRELIMINARY_COMPATIBLE" && Boolean(bestCandidate) && result.blockingReasons.length === 0;

  return (
    <div className="calc">
      <div className="calc__pickers">
        <EquipmentPicker
          idPrefix="inverter"
          label="ข้อมูลอินเวอร์เตอร์"
          onChange={(value) => {
            setInverter(value);
            clearOverrides();
            void calculate({ inverter: value, resetOverrides: true });
          }}
          options={inverterOptions}
          value={inverter}
        />
        <EquipmentPicker
          idPrefix="pv-module"
          label="ข้อมูลแผง PV"
          onChange={(value) => {
            setPvModule(value);
            clearOverrides();
            void calculate({ pvModule: value, resetOverrides: true });
          }}
          options={pvOptions}
          value={pvModule}
        />
      </div>

      <div aria-live="polite" className="calc__status">
        {isLoading ? <p>กำลังคำนวณ…</p> : null}
        {errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="calc__specs">
        <SpecCard
          option={inverterOption}
          rows={[
            { label: "กำลังไฟฟ้า AC ขาออก", source: "DATASHEET", value: `${inv.ratedAcKw} kW` },
            { label: "กำลัง PV สูงสุดที่แนะนำ", source: inv.maxRecommendedPvWp === null ? "MISSING" : "DATASHEET", value: inv.maxRecommendedPvWp === null ? "—" : `${inv.maxRecommendedPvWp.toLocaleString("en-US")} Wp` },
            { label: "กำลัง PV สูงสุดที่ใช้งานได้", source: inv.maxDcPowerSource, value: inv.maxDcPowerWp === null ? "—" : `${inv.maxDcPowerWp.toLocaleString("en-US")} Wp` },
            { label: "แรงดันขาเข้าสูงสุด", source: "DATASHEET", value: `${inv.maxDcVoltageV} Vdc` },
            { label: "แรงดันเริ่มทำงาน", source: inv.startupVoltageSource, value: inv.startupVoltageV === null ? "—" : `${inv.startupVoltageV} V` },
            { label: "ช่วงแรงดัน MPPT", source: "DATASHEET", value: wt.trackers.map((tracker) => `#${tracker.trackerIndex} ${tracker.mpptMinV}–${tracker.mpptMaxV} V`).join(" · ") },
            { label: "กระแสขาเข้าสูงสุด/MPPT", source: "DATASHEET", value: wt.trackers.map((tracker) => `#${tracker.trackerIndex} ${tracker.maxOperatingCurrentA} A`).join(" · ") },
            { label: "Isc สูงสุด/MPPT", source: "DATASHEET", value: wt.trackers.map((tracker) => `#${tracker.trackerIndex} ${tracker.maxShortCircuitCurrentA} A`).join(" · ") },
            { label: "จำนวน MPPT / input สูงสุด", source: "DATASHEET", value: `${inv.trackerCount} MPPT · ${wt.trackers.map((tracker) => `#${tracker.trackerIndex} ${tracker.inputCount}`).join(" · ")}` },
          ]}
          title={`${result.equipment.inverter.manufacturer} ${result.equipment.inverter.model}`}
        />
        <SpecCard
          option={pvOption}
          rows={[
            { label: "กำลังไฟฟ้าสูงสุดต่อแผง (Pmax)", source: "DATASHEET", value: `${pv.pmaxWp} Wp` },
            { label: "Open Circuit Voltage (Voc)", source: "DATASHEET", value: `${pv.vocV} V` },
            { label: "กระแสลัดวงจร (Isc)", source: "DATASHEET", value: `${pv.iscA} A` },
            { label: "กระแสที่กำลังสูงสุด (Imp)", source: "DATASHEET", value: `${pv.impA} A` },
            { label: "แรงดันที่กำลังสูงสุด (Vmp)", source: "DATASHEET", value: `${pv.vmpV} V` },
            { label: "Temp. coefficient of Voc", source: pv.betaVocInputSource, value: pv.betaVocPerC === null ? "—" : `${(pv.betaVocPerC * 100).toFixed(3)} %/°C` },
            { label: "βVmp (ใช้ตรวจ Vmp ตามอุณหภูมิ)", source: pv.betaVmpInputSource, value: pv.betaVmpPerC === null ? "—" : `${(pv.betaVmpPerC * 100).toFixed(3)} %/°C` },
            ...(design
              ? [
                  { label: design.source === "USER_OVERRIDE" ? "Rear-side design case" : "Approved rear-gain case", source: design.source, value: design.source === "USER_OVERRIDE" ? `${design.rearGainPercent.toFixed(0)}% · ผู้ใช้กรอก` : `${design.rearGainPercent.toFixed(0)}% · Datasheet หน้า ${design.sourcePage}` },
                  { label: "Pmax / Isc / Imp ที่ใช้ตรวจ", source: design.source, value: `${design.pmaxWp} W · ${design.iscA} A · ${design.impA} A` },
                ]
              : pv.isBifacial
                ? [{
                    label: "Bifacial design basis",
                    source: wt.designBasis === "FRONT_SIDE_USER_OVERRIDE" ? "USER_OVERRIDE" as const : "MISSING" as const,
                    value: wt.designBasis === "FRONT_SIDE_USER_OVERRIDE" ? "คำนวณเฉพาะ Front-side" : "ยังไม่มี rear-side design case",
                  }]
                : []),
          ]}
          title={`${result.equipment.pvModule.manufacturer} ${result.equipment.pvModule.model}`}
        />
      </div>

      <div className={`calc__verdict calc__verdict--${result.overallStatus.toLowerCase()}`}>
        <strong>{verdict.label}</strong>
        <span>{verdict.detail}</span>
        {result.blockingReasons.length ? (
          <ul>
            {result.blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        ) : null}
        {hasUserOverrides ? (
          <p className="calc__override-warning">
            ผลนี้มีค่าที่ผู้ใช้กรอกทดแทน Datasheet ต้องให้วิศวกรตรวจหลักฐานก่อนนำไปออกแบบหรือติดตั้ง
          </p>
        ) : null}
      </div>

      <div className="calc__steps">
        <Step number={1} title="จำนวนแผงรวมตามกำลัง PV ที่ผู้ผลิตระบุ">
          {wt.maxModules ? (
            <div className="formula">
              <p>
                {wt.maxModules.basis === "MAX_DC_POWER"
                  ? "กำลัง PV สูงสุดที่ใช้งานได้ (hard limit)"
                  : "กำลัง PV สูงสุดที่แนะนำ"} ÷ กำลังแผงที่ใช้ในการออกแบบ
              </p>
              <p>
                {wt.maxModules.limitWp.toLocaleString("en-US")} ÷ {wt.maxModules.modulePowerWp} = {(wt.maxModules.limitWp / wt.maxModules.modulePowerWp).toFixed(1)}
              </p>
              <strong>{wt.maxModules.modules} แผง</strong>
            </div>
          ) : (
            <p className="calc__missing">Datasheet ไม่ระบุกำลัง PV สูงสุด จึงคำนวณข้อนี้ไม่ได้</p>
          )}
        </Step>

        <Step number={2} title="แรงดันตามอุณหภูมิ">
          <>
            {wt.temperature.vmpHotV !== null ? (
              <div className="formula">
                <p><b>Vmp ร้อน</b> = Vmp × [1 + (βVmp% ÷ 100) × (T สูงสุด − 25)]</p>
                <p>{calculationVmpV} × [1 + ({((pv.betaVmpPerC ?? 0) * 100).toFixed(3)} ÷ 100) × ({result.assumptions.tcellMaxC} − 25)]</p>
                <strong>{wt.temperature.vmpHotV} V</strong>
              </div>
            ) : (
              <p className="calc__missing">ไม่พบ βVmp ที่ตรวจสอบแล้ว จึงยังคำนวณ Vmp ร้อนไม่ได้</p>
            )}
            {wt.temperature.vocColdV !== null ? (
              <div className="formula">
                <p><b>Voc เย็น</b> = Voc × [1 + (βVoc% ÷ 100) × (T ต่ำสุด − 25)]</p>
                <p>{calculationVocV} × [1 + ({((pv.betaVocPerC ?? 0) * 100).toFixed(3)} ÷ 100) × ({result.assumptions.tcellMinC} − 25)]</p>
                <strong>{wt.temperature.vocColdV} V</strong>
              </div>
            ) : (
              <p className="calc__missing">ไม่พบ βVoc ใน Datasheet จึงยังคำนวณ Voc เย็นไม่ได้</p>
            )}
            {wt.temperature.vmpColdV !== null ? (
              <div className="formula">
                <p><b>Vmp เย็น</b> = Vmp × [1 + (βVmp% ÷ 100) × (T ต่ำสุด − 25)]</p>
                <p>{calculationVmpV} × [1 + ({((pv.betaVmpPerC ?? 0) * 100).toFixed(3)} ÷ 100) × ({result.assumptions.tcellMinC} − 25)]</p>
                <strong>{wt.temperature.vmpColdV} V</strong>
              </div>
            ) : (
              <p className="calc__missing">ไม่พบ βVmp ที่ตรวจสอบแล้ว จึงยังคำนวณ Vmp เย็นไม่ได้</p>
            )}
          </>
        </Step>

        <Step number={3} title="จำนวนแผงต่ออนุกรม / สตริง">
          <div className="tracker-checks">
              {wt.trackers.map((tracker) => {
                const range = tracker.seriesRange;
                const isComplete = range.minModules !== null && range.maxModules !== null;
                const isValid =
                  range.minModules !== null &&
                  range.maxModules !== null &&
                  range.minModules <= range.maxModules;
                return (
                  <section className="tracker-check" key={tracker.trackerIndex}>
                    <h4>MPPT {tracker.trackerIndex}</h4>
                    <div className="formula">
                      <p><b>มากสุดจาก Voc</b> = Vdc สูงสุด ÷ Voc เย็น</p>
                      <p>{range.maxModulesByColdVoc === null ? "คำนวณไม่ได้: ไม่พบ βVoc" : `${range.voltageCeilingV} ÷ ${wt.temperature.vocColdV} = ${range.maxModulesByColdVoc}`}</p>
                      <p><b>มากสุดจาก Vmp</b> = MPPT max ÷ Vmp เย็น</p>
                      <p>{range.maxModulesByColdVmp === null ? "คำนวณไม่ได้: ไม่พบ βVmp" : `${tracker.mpptMaxV} ÷ ${wt.temperature.vmpColdV} = ${range.maxModulesByColdVmp}`}</p>
                      <strong>{range.maxModules === null ? "ยังสรุปจำนวนสูงสุดไม่ได้" : `ใช้ขอบเขตที่เข้มกว่า: ${range.maxModules} แผง`}</strong>
                    </div>
                    <div className="formula">
                      <p><b>น้อยสุดจากช่วง MPPT</b> = MPPT min ÷ Vmp ร้อน</p>
                      <p>{range.minModulesByMppt === null ? "คำนวณไม่ได้: ไม่พบ βVmp" : `${tracker.mpptMinV} ÷ ${wt.temperature.vmpHotV} = ${range.minModulesByMppt}`}</p>
                      <p><b>น้อยสุดจากแรงดันเริ่มทำงาน</b> = Startup voltage ÷ Vmp ร้อน</p>
                      <p>{range.minModulesByStartup === null ? "คำนวณไม่ได้: ไม่พบ βVmp หรือ Startup voltage" : `${inv.startupVoltageV} ÷ ${wt.temperature.vmpHotV} = ${range.minModulesByStartup}`}</p>
                      <strong>{range.minModules === null ? "ยังสรุปจำนวนต่ำสุดไม่ได้" : `ใช้ขอบเขตที่เข้มกว่า: ${range.minModules} แผง`} {isComplete ? <Pass ok={isValid} /> : null}</strong>
                    </div>
                    <p className="calc__answer">
                      {!isComplete
                        ? `MPPT ${tracker.trackerIndex}: ข้อมูลอุณหภูมิยังไม่ครบ จึงยังไม่สร้างช่วงแนะนำ`
                        : isValid
                        ? `MPPT ${tracker.trackerIndex}: ${range.minModules}–${range.maxModules} แผงต่อสตริง`
                        : `MPPT ${tracker.trackerIndex}: ไม่มีจำนวนแผงที่ผ่านทุกขอบเขต`}
                    </p>
                  </section>
                );
              })}
            </div>
        </Step>

        <Step number={4} title="จำนวนสตริงต่อ MPPT">
          <div className="tracker-checks">
            {wt.trackers.map((tracker) => {
              const passingRows = tracker.stringRows.filter((row) => row.pass);
              const maxPassingStrings = passingRows.at(-1)?.strings ?? 0;
              return (
                <section className="tracker-check" key={tracker.trackerIndex}>
                  <h4>MPPT {tracker.trackerIndex} · {tracker.inputCount} physical input</h4>
                  <ul className="calc__rows">
                    {tracker.stringRows.map((row) => (
                      <li key={row.strings}>
                        <Pass ok={row.pass} />
                        <span>
                          <strong>{row.strings} สตริง:</strong>{" "}
                          Imp รวม {row.operatingA} A {row.operatingPass ? "≤" : ">"} {tracker.maxOperatingCurrentA} A ·{" "}
                          Isc ออกแบบ {row.shortCircuitA} A {row.shortCircuitPass ? "≤" : ">"} {tracker.maxShortCircuitCurrentA} A
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="calc__answer">ต่อได้สูงสุด {maxPassingStrings} สตริงบน MPPT {tracker.trackerIndex}</p>
                </section>
              );
            })}
          </div>
        </Step>

        <Step number={5} title="รูปแบบการต่อที่เหมาะสม">
          {result.candidates.length ? (
            <div className="layout-list">
              {result.candidates.map((candidate) => (
                <article className="layout-card" key={candidate.id}>
                  <header>
                    <strong>
                      แบบที่ {candidate.rank} · {(candidate.totalDcPowerWp / 1000).toFixed(2)} kWp · {candidate.totalModules} แผง
                    </strong>
                    <span>
                      DC/AC {candidate.dcAcRatio.toFixed(2)}
                      {candidate.designTotalDcPowerWp !== candidate.totalDcPowerWp
                        ? ` · design ${(candidate.designTotalDcPowerWp / 1000).toFixed(2)} kW (${candidate.designDcAcRatio.toFixed(2)})`
                        : ""}
                    </span>
                  </header>
                  <ConnectionLayout candidate={candidate} />
                </article>
              ))}
            </div>
          ) : (
            <p className="calc__missing">
              {result.blockingReasons.length
                ? "ระบบไม่สร้างชุดแนะนำจนกว่าข้อมูลสำคัญจะครบและผ่านการตรวจสอบ"
                : "ไม่พบรูปแบบการต่อที่ผ่านเงื่อนไข ลองเปลี่ยนรุ่นหรือปรับเงื่อนไขด้านล่าง"}
            </p>
          )}
        </Step>
      </div>

      <details className="calc__advanced">
        <summary>ปรับเงื่อนไขการคำนวณ</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void calculate();
          }}
        >
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="tcell-min">อุณหภูมิเซลล์ต่ำสุด</label>
              <div className="unit-input">
                <input id="tcell-min" max={40} min={-60} onChange={(event) => setTcellMinC(event.target.valueAsNumber)} required type="number" value={tcellMinC} />
                <span>°C</span>
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="tcell-max">อุณหภูมิเซลล์สูงสุด</label>
              <div className="unit-input">
                <input id="tcell-max" max={100} min={25} onChange={(event) => setTcellMaxC(event.target.valueAsNumber)} required type="number" value={tcellMaxC} />
                <span>°C</span>
              </div>
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label htmlFor="target-power">กำลัง DC ที่ต้องการ</label>
              <div className="unit-input">
                <input id="target-power" max={10000} min={0.1} onChange={(event) => setTargetDcPowerKw(event.target.valueAsNumber)} required step="0.1" type="number" value={targetDcPowerKw} />
                <span>kWp</span>
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="current-factor">ตัวคูณ Isc</label>
              <div className="unit-input">
                <input id="current-factor" max={2} min={1.25} onChange={(event) => setCurrentSafetyFactor(event.target.valueAsNumber)} required step="0.01" type="number" value={currentSafetyFactor} />
                <span>×</span>
              </div>
            </div>
          </div>
          {(inv.maxDcPowerSource !== "DATASHEET" ||
            inv.startupVoltageSource !== "DATASHEET" ||
            pv.betaVocInputSource === "MISSING" || pv.betaVocInputSource === "USER_OVERRIDE" ||
            pv.betaVmpInputSource === "MISSING" || pv.betaVmpInputSource === "USER_OVERRIDE" ||
            (pv.isBifacial && design?.source !== "DATASHEET")) ? (
            <section className="override-panel" aria-labelledby="override-heading">
              <div className="override-panel__heading">
                <div>
                  <h3 id="override-heading">ข้อมูลทดแทนเมื่อ Datasheet ไม่ครบ</h3>
                  <p>ใช้เฉพาะการคำนวณครั้งนี้ ระบบจะติดป้าย “ผู้ใช้กรอก” และไม่แก้ข้อมูลต้นทาง</p>
                </div>
                <AlertTriangle aria-hidden="true" size={22} />
              </div>

              <div className="field-row">
                {inv.maxDcPowerSource !== "DATASHEET" ? (
                  <div className="field-group">
                    <label htmlFor="override-max-dc-power">Max DC power ที่ใช้ตรวจ</label>
                    <div className="unit-input">
                      <input id="override-max-dc-power" min={0.1} onChange={(event) => setOverrideMaxDcPowerKw(event.target.value)} required step="0.1" type="number" value={overrideMaxDcPowerKw} />
                      <span>kWp</span>
                    </div>
                  </div>
                ) : null}
                {inv.startupVoltageSource !== "DATASHEET" ? (
                  <div className="field-group">
                    <label htmlFor="override-startup-voltage">Startup voltage ที่ใช้ตรวจ</label>
                    <div className="unit-input">
                      <input id="override-startup-voltage" max={2000} min={1} onChange={(event) => setOverrideStartupVoltageV(event.target.value)} required step="0.1" type="number" value={overrideStartupVoltageV} />
                      <span>V</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="field-row">
                {pv.betaVocInputSource === "MISSING" || pv.betaVocInputSource === "USER_OVERRIDE" ? (
                  <div className="field-group">
                    <label htmlFor="override-beta-voc">βVoc ที่ใช้ตรวจ</label>
                    <div className="unit-input">
                      <input id="override-beta-voc" max={-0.001} min={-5} onChange={(event) => setOverrideBetaVocPercent(event.target.value)} required step="0.001" type="number" value={overrideBetaVocPercent} />
                      <span>%/°C</span>
                    </div>
                  </div>
                ) : null}
                {pv.betaVmpInputSource === "MISSING" || pv.betaVmpInputSource === "USER_OVERRIDE" ? (
                  <div className="field-group">
                    <label htmlFor="override-beta-vmp">βVmp ที่ใช้ตรวจ</label>
                    <div className="unit-input">
                      <input id="override-beta-vmp" max={-0.001} min={-5} onChange={(event) => setOverrideBetaVmpPercent(event.target.value)} required step="0.001" type="number" value={overrideBetaVmpPercent} />
                      <span>%/°C</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {pv.isBifacial && design?.source !== "DATASHEET" ? (
                <fieldset className="bifacial-override">
                  <legend>วิธีคิดแผง Bifacial</legend>
                  <p>อย่าใช้ Rear gain เพียงค่าเดียวเพื่อเดากระแส กรุณาเลือกฐานการออกแบบที่ตรวจสอบได้</p>
                  <label className="override-choice">
                    <input checked={bifacialMode === "FRONT_SIDE_ONLY"} name="bifacial-mode" onChange={() => setBifacialMode("FRONT_SIDE_ONLY")} required type="radio" />
                    <span><strong>คำนวณเฉพาะ Front-side</strong><small>ใช้ Pmax, Voc, Vmp, Isc และ Imp หน้าแผง โดยไม่รับรองผลจากด้านหลัง</small></span>
                  </label>
                  <label className="override-choice">
                    <input checked={bifacialMode === "USER_DESIGN_CASE"} name="bifacial-mode" onChange={() => setBifacialMode("USER_DESIGN_CASE")} required type="radio" />
                    <span><strong>กรอก Rear-side design case</strong><small>ใช้ค่าจากเอกสารออกแบบหรือ Manufacturer gain table ที่ผู้ใช้รับผิดชอบ</small></span>
                  </label>

                  {bifacialMode === "FRONT_SIDE_ONLY" ? (
                    <label className="override-acknowledgement">
                      <input checked={bifacialAcknowledged} onChange={(event) => setBifacialAcknowledged(event.target.checked)} required type="checkbox" />
                      <span>ยืนยันว่าจะใช้ผล Front-side only และให้วิศวกรตรวจผลกระทบจาก Rear irradiance ก่อนติดตั้ง</span>
                    </label>
                  ) : null}

                  {bifacialMode === "USER_DESIGN_CASE" ? (
                    <div className="bifacial-override__values">
                      {[
                        ["rear-gain", "Rear gain", rearGainPercent, setRearGainPercent, "%", 0.1, 100],
                        ["rear-pmax", "Pmax design", rearPmaxWp, setRearPmaxWp, "W", 1, 10000],
                        ["rear-voc", "Voc design", rearVocV, setRearVocV, "V", 0.01, 2000],
                        ["rear-vmp", "Vmp design", rearVmpV, setRearVmpV, "V", 0.01, 2000],
                        ["rear-isc", "Isc design", rearIscA, setRearIscA, "A", 0.01, 100],
                        ["rear-imp", "Imp design", rearImpA, setRearImpA, "A", 0.01, 100],
                      ].map(([id, label, value, setter, unit, step, max]) => (
                        <div className="field-group" key={String(id)}>
                          <label htmlFor={String(id)}>{String(label)}</label>
                          <div className="unit-input">
                            <input id={String(id)} max={Number(max)} min={Number(step)} onChange={(event) => (setter as (next: string) => void)(event.target.value)} required step={Number(step)} type="number" value={String(value)} />
                            <span>{String(unit)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </fieldset>
              ) : null}
            </section>
          ) : null}
          <button className="button button--ink" disabled={isLoading} type="submit">
            คำนวณใหม่
          </button>
        </form>
      </details>

      {bestCandidate ? (
        <details className="calc__advanced">
          <summary>ดูรายละเอียดรายข้อ (สำหรับวิศวกร)</summary>
          <ul className="calc__rows calc__rows--findings">
            {bestCandidate.findings.map((finding, index) => (
              <FindingRow finding={finding} key={`${finding.ruleId}-${index}`} />
            ))}
          </ul>
        </details>
      ) : null}

      <section className={`line-cta${canOrder ? "" : " line-cta--blocked"}`} id="order">
        <div>
          <p className="eyebrow">{canOrder ? "ขั้นตอนถัดไป" : "ต้องตรวจข้อมูลก่อน"}</p>
          <h2>{canOrder ? "ส่งชุดนี้ให้ทีมวิศวกรตรวจทาน" : "ยังไม่เปิดการสั่งซื้อชุดนี้"}</h2>
          <p>
            {canOrder
              ? hasUserOverrides
                ? "ผลผ่านกฎเบื้องต้นโดยมีค่าที่ผู้ใช้กรอก ทีมงานต้องตรวจเอกสารอ้างอิงและยืนยันค่าทดแทนก่อนเสนอราคา"
                : "ผลผ่านกฎเบื้องต้นจากข้อมูลที่ verified แล้ว ทีมงานจะตรวจแบบและ Datasheet ซ้ำก่อนเสนอราคา"
              : "กรุณาแก้ข้อมูลที่ระบบแจ้งให้ครบก่อน ระบบจะไม่ใช้ผลที่ยังไม่ยืนยันเพื่อสั่งซื้อ"}
          </p>
        </div>
        {lineOaUrl && canOrder ? (
          <a className="button button--sun" href={lineOaUrl} rel="noopener noreferrer" target="_blank">
            ส่งให้ทีมวิศวกรตรวจทาน
            <ChevronRight size={18} aria-hidden="true" />
          </a>
        ) : null}
      </section>

      <p className="calc__disclaimer">
        ผลคำนวณเบื้องต้นสำหรับฝั่ง DC เท่านั้น ไม่ใช่แบบรับรองวิศวกรรม ควรให้วิศวกรและคู่มือผู้ผลิตตรวจทานก่อนติดตั้ง
      </p>
    </div>
  );
}
