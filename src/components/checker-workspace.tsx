"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDashed,
  FileDown,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import type {
  OverallStatus,
  RuleFinding,
  SizingResult,
} from "@/domain/sizing/types";
import { ThemeSelect } from "@/components/theme-select";

export interface CheckerEquipmentOption {
  isDemo: boolean;
  manufacturer: string;
  model: string;
  label: string;
  revisionLabel: string;
  value: string;
}

interface CheckerWorkspaceProps {
  initialInverterId: string;
  initialPvModuleId: string;
  initialResult: SizingResult;
  inverterOptions: CheckerEquipmentOption[];
  pvOptions: CheckerEquipmentOption[];
}

function selectionHelp(option: CheckerEquipmentOption | undefined) {
  if (!option) return "";
  return option.isDemo
    ? "ข้อมูลสังเคราะห์ · ยังไม่ผ่านการตรวจสอบ"
    : `Revision ${option.revisionLabel} · Published`;
}

const statusCopy: Record<OverallStatus, { label: string; detail: string }> = {
  PRELIMINARY_COMPATIBLE: {
    label: "PRELIMINARY COMPATIBLE",
    detail: "กฎสำคัญที่ระบบรองรับผ่านครบ กรุณาให้วิศวกรตรวจทานต่อ",
  },
  INCOMPATIBLE: {
    label: "INCOMPATIBLE",
    detail: "พบข้อจำกัดแบบ hard fail อย่างน้อยหนึ่งรายการ",
  },
  INSUFFICIENT_DATA: {
    label: "INSUFFICIENT DATA",
    detail: "ค่าทางไฟฟ้าบางส่วนผ่าน แต่ข้อมูลยังไม่พอสำหรับยืนยันผล",
  },
};

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
    <div className="field-group">
      <label htmlFor={`${idPrefix}-brand`}>{label}</label>
      <div className="field-row">
        <ThemeSelect
          id={`${idPrefix}-brand`}
          onValueChange={(brand) =>
            onChange(options.find((option) => option.manufacturer === brand)?.value ?? value)
          }
          options={brands.map((brand) => ({ label: brand, value: brand }))}
          placeholder="เลือกยี่ห้อ"
          value={selected?.manufacturer ?? ""}
        />
        <ThemeSelect
          id={`${idPrefix}-model`}
          onValueChange={onChange}
          options={models.map((option) => ({ label: option.model, value: option.value }))}
          placeholder="เลือกรุ่น"
          searchable={models.length > 8}
          value={value}
        />
      </div>
      <p className={`field-help${selected?.isDemo ? " field-help--warning" : ""}`}>
        {selectionHelp(selected)}
      </p>
    </div>
  );
}

function FormulaBlock({
  children,
  formula,
  title,
  result,
}: {
  children?: React.ReactNode;
  formula: string;
  result: string;
  title: string;
}) {
  return (
    <div className="formula-block">
      <h3>{title}</h3>
      <p>{formula}</p>
      <strong>{result}</strong>
      {children}
    </div>
  );
}

function FindingIcon({ status }: { status: RuleFinding["status"] }) {
  if (status === "PASS") return <Check size={15} aria-hidden="true" />;
  if (status === "FAIL") return <X size={15} aria-hidden="true" />;
  if (status === "WARNING")
    return <AlertTriangle size={15} aria-hidden="true" />;
  return <CircleDashed size={15} aria-hidden="true" />;
}

export function CheckerWorkspace({
  initialInverterId,
  initialPvModuleId,
  initialResult,
  inverterOptions,
  pvOptions,
}: CheckerWorkspaceProps) {
  const [tcellMinC, setTcellMinC] = useState(-10);
  const [tcellMaxC, setTcellMaxC] = useState(70);
  const [targetDcPowerKw, setTargetDcPowerKw] = useState(11);
  const [currentSafetyFactor, setCurrentSafetyFactor] = useState(1.25);
  const [pvModule, setPvModule] = useState(initialPvModuleId);
  const [inverter, setInverter] = useState(initialInverterId);
  const [result, setResult] = useState(initialResult);
  const [selectedCandidateId, setSelectedCandidateId] = useState(
    initialResult.candidates[0]?.id ?? "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedCandidate = useMemo(
    () =>
      result.candidates.find(
        (candidate) => candidate.id === selectedCandidateId,
      ) ?? result.candidates[0],
    [result, selectedCandidateId],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/v1/sizing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pvModuleId: pvModule,
          inverterId: inverter,
          assumptions: {
            tcellMinC,
            tcellMaxC,
            currentSafetyFactor,
            targetDcPowerWp: targetDcPowerKw * 1000,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.message ?? "ไม่สามารถคำนวณได้");

      const nextResult = payload as SizingResult;
      setResult(nextResult);
      setSelectedCandidateId(nextResult.candidates[0]?.id ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const overallCopy = statusCopy[result.overallStatus];
  const wt = result.walkthrough;
  const lineOaUrl = process.env.NEXT_PUBLIC_LINE_OA_URL;
  const pv = wt.pvModule;

  return (
    <div className="checker-shell">
      <aside className="checker-controls">
        <div className="workspace-step">
          <span>01</span>
          <div>
            <p>อุปกรณ์</p>
            <h2>เลือก exact model</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <EquipmentPicker
            idPrefix="inverter"
            label="Inverter"
            onChange={setInverter}
            options={inverterOptions}
            value={inverter}
          />
          <EquipmentPicker
            idPrefix="pv-module"
            label="PV Module"
            onChange={setPvModule}
            options={pvOptions}
            value={pvModule}
          />

          <div className="workspace-step workspace-step--compact">
            <span>02</span>
            <div>
              <p>Design conditions</p>
              <h2>กำหนดอุณหภูมิเซลล์</h2>
            </div>
          </div>

          <div className="field-row">
            <div className="field-group">
              <label htmlFor="tcell-min">Tcell ต่ำสุด</label>
              <div className="unit-input">
                <input
                  id="tcell-min"
                  max={40}
                  min={-60}
                  onChange={(event) => setTcellMinC(event.target.valueAsNumber)}
                  required
                  type="number"
                  value={tcellMinC}
                />
                <span>°C</span>
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="tcell-max">Tcell สูงสุด</label>
              <div className="unit-input">
                <input
                  id="tcell-max"
                  max={100}
                  min={25}
                  onChange={(event) => setTcellMaxC(event.target.valueAsNumber)}
                  required
                  type="number"
                  value={tcellMaxC}
                />
                <span>°C</span>
              </div>
            </div>
          </div>

          <p className="field-help">
            ใช้อุณหภูมิเซลล์ ไม่ใช่อุณหภูมิอากาศ กรุณายืนยันกับเงื่อนไขไซต์จริง
          </p>

          <div className="field-row">
            <div className="field-group">
              <label htmlFor="target-power">เป้าหมายกำลัง DC</label>
              <div className="unit-input">
                <input
                  id="target-power"
                  max={10000}
                  min={0.1}
                  onChange={(event) =>
                    setTargetDcPowerKw(event.target.valueAsNumber)
                  }
                  required
                  step="0.1"
                  type="number"
                  value={targetDcPowerKw}
                />
                <span>kWp</span>
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="current-factor">Isc factor</label>
              <div className="unit-input">
                <input
                  id="current-factor"
                  max={2}
                  min={1}
                  onChange={(event) =>
                    setCurrentSafetyFactor(event.target.valueAsNumber)
                  }
                  required
                  step="0.01"
                  type="number"
                  value={currentSafetyFactor}
                />
                <span>×</span>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="button button--sun button--full" disabled={isLoading}>
            {isLoading ? "กำลังคำนวณ…" : "คำนวณการนำไปใช้ด้วยกัน"}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button
            className="reset-button"
            onClick={() => {
              setTcellMinC(-10);
              setTcellMaxC(70);
              setTargetDcPowerKw(11);
              setCurrentSafetyFactor(1.25);
            }}
            type="button"
          >
            <RotateCcw size={14} aria-hidden="true" />
            คืนค่าเงื่อนไขตัวอย่าง
          </button>
        </form>
      </aside>

      <section className="checker-results" aria-live="polite">
        <div className={`result-status result-status--${result.overallStatus.toLowerCase()}`}>
          <div className="result-status__icon">
            <ShieldAlert size={22} aria-hidden="true" />
          </div>
          <div>
            <p>OVERALL RESULT</p>
            <h1>{overallCopy.label}</h1>
            <span>{overallCopy.detail}</span>
          </div>
          <button
            className="print-button"
            onClick={() => window.print()}
            type="button"
          >
            <FileDown size={16} aria-hidden="true" />
            Print report
          </button>
        </div>

        <div className="result-meta">
          <span>Engine {result.engineVersion}</span>
          <span>Calculation {result.calculationId.slice(0, 8)}</span>
          <span>{new Date(result.calculatedAt).toLocaleString("th-TH")}</span>
        </div>

        <div className="spec-cards">
          <article>
            <h2>ข้อมูลอินเวอร์เตอร์</h2>
            <h3>{result.equipment.inverter.manufacturer} {result.equipment.inverter.model}</h3>
            <dl>
              <div><dt>Vdc สูงสุด</dt><dd>{wt.inverterLimits.maxDcVoltageV} V</dd></div>
              <div><dt>แรงดัน MPPT</dt><dd>{wt.inverterLimits.mpptMinV}–{wt.inverterLimits.mpptMaxV} V</dd></div>
              <div><dt>กระแสขาเข้าสูงสุด/MPPT</dt><dd>{wt.inverterLimits.maxOperatingCurrentA} A</dd></div>
              <div><dt>Isc สูงสุด/MPPT</dt><dd>{wt.inverterLimits.maxShortCircuitCurrentA} A</dd></div>
              <div><dt>กำลัง PV สูงสุดที่แนะนำ</dt><dd>{wt.inverterLimits.maxRecommendedPvWp === null ? "ไม่ระบุ" : `${wt.inverterLimits.maxRecommendedPvWp} Wp`}</dd></div>
              <div><dt>กำลัง PV ที่ใช้งานได้</dt><dd>{wt.inverterLimits.maxDcPowerWp === null ? "ไม่ระบุ" : `${wt.inverterLimits.maxDcPowerWp} Wp`}</dd></div>
              <div><dt>MPPT / สตริงสูงสุด</dt><dd>{wt.inverterLimits.trackerCount} MPPT · {wt.inverterLimits.inputsPerMppt} สตริง</dd></div>
            </dl>
          </article>
          <article>
            <h2>ข้อมูลแผง PV</h2>
            <h3>{result.equipment.pvModule.manufacturer} {result.equipment.pvModule.model}</h3>
            <dl>
              <div><dt>Pmax</dt><dd>{pv.pmaxWp} Wp</dd></div>
              <div><dt>Voc</dt><dd>{pv.vocV} V</dd></div>
              <div><dt>Vmp</dt><dd>{pv.vmpV} V</dd></div>
              <div><dt>Isc</dt><dd>{pv.iscA} A</dd></div>
              <div><dt>Imp</dt><dd>{pv.impA} A</dd></div>
              <div><dt>Beta (Voc / Vmp)</dt><dd>{pv.betaVocPerC ?? "ไม่ระบุ"} / {pv.betaVmpPerC ?? "ไม่ระบุ"} /°C</dd></div>
            </dl>
          </article>
        </div>

        <div className="result-section-heading">
          <div>
            <p>CALCULATION STEPS</p>
            <h2>คำนวณทีละขั้น พร้อมสูตรและค่าที่ใช้</h2>
          </div>
        </div>

        <div className="formula-list">
          {wt.maxModules ? (
            <FormulaBlock
              title="1. จำนวนแผงรวมสูงสุด"
              formula={`${wt.maxModules.limitWp.toLocaleString("en-US")} Wp ÷ ${pv.pmaxWp} Wp = ${(wt.maxModules.limitWp / pv.pmaxWp).toFixed(1)}`}
              result={`${wt.maxModules.modules} แผง`}
            />
          ) : (
            <FormulaBlock title="1. จำนวนแผงรวมสูงสุด" formula="Datasheet ไม่ระบุกำลัง PV สูงสุด" result="ข้อมูลไม่ครบ" />
          )}
          {wt.temperature ? (
            <>
              <h3 className="formula-heading">2. แรงดันตามอุณหภูมิ (Tstc = 25 °C)</h3>
              <FormulaBlock
                title="Vmp ร้อน"
                formula={`${pv.vmpV} × [1 + (${pv.betaVmpPerC}) × (${result.assumptions.tcellMaxC} − 25)]`}
                result={`${wt.temperature.vmpHotV} V`}
              />
              <FormulaBlock
                title="Voc เย็น"
                formula={`${pv.vocV} × [1 + (${pv.betaVocPerC}) × (${result.assumptions.tcellMinC} − 25)]`}
                result={`${wt.temperature.vocColdV} V`}
              />
              <FormulaBlock
                title="Vmp เย็น"
                formula={`${pv.vmpV} × [1 + (${pv.betaVmpPerC}) × (${result.assumptions.tcellMinC} − 25)]`}
                result={`${wt.temperature.vmpColdV} V`}
              />
            </>
          ) : (
            <FormulaBlock title="2. แรงดันตามอุณหภูมิ" formula="Datasheet ไม่ระบุ temperature coefficient" result="ข้อมูลไม่ครบ" />
          )}
          {wt.seriesRange && wt.temperature ? (
            <FormulaBlock
              title="3. จำนวนแผงต่อสตริง"
              formula={`มากสุด = ${wt.seriesRange.voltageCeilingV} ÷ ${wt.temperature.vocColdV} → ${wt.seriesRange.maxModules} แผง · น้อยสุด = ${wt.inverterLimits.mpptMinV} ÷ ${wt.temperature.vmpHotV} → ${wt.seriesRange.minModules} แผง`}
              result={
                wt.seriesRange.minModules <= wt.seriesRange.maxModules
                  ? `ใช้ ${wt.seriesRange.minModules} ถึง ${wt.seriesRange.maxModules} แผงต่อสตริง`
                  : "ไม่มีจำนวนแผงที่ผ่านทั้งสองขอบเขต"
              }
            />
          ) : null}
          <FormulaBlock
            title="4. จำนวนสตริงต่อ MPPT"
            formula={`Imp ${pv.impA} A ≤ ${wt.inverterLimits.maxOperatingCurrentA} A · Isc ${pv.iscA} A × ${wt.currents.safetyFactor} = ${wt.currents.designIscA} A ≤ ${wt.inverterLimits.maxShortCircuitCurrentA} A`}
            result={`ต่อได้สูงสุด ${wt.currents.stringRows.filter((row) => row.pass).length} สตริงต่อ MPPT`}
          >
            <ul className="formula-rows">
              {wt.currents.stringRows.map((row) => (
                <li key={row.strings}>
                  {row.pass ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
                  <span>{row.strings} สตริงต่อ 1 MPPT: Imp {row.operatingA} A · Isc ออกแบบ {row.shortCircuitA} A</span>
                  <strong>{row.pass ? "ผ่าน" : "ไม่ผ่าน"}</strong>
                </li>
              ))}
            </ul>
          </FormulaBlock>
        </div>

        <div className="result-section-heading">
          <div>
            <p>5 · RECOMMENDED LAYOUTS</p>
            <h2>5. รูปแบบการต่อที่เหมาะสม</h2>
          </div>
          <span>{result.candidates.length} candidates</span>
        </div>

        {result.candidates.length ? (
          <div className="candidate-list">
            {result.candidates.map((candidate) => (
              <button
                aria-pressed={selectedCandidate?.id === candidate.id}
                className={`candidate-row ${
                  selectedCandidate?.id === candidate.id
                    ? "candidate-row--selected"
                    : ""
                }`}
                key={candidate.id}
                onClick={() => setSelectedCandidateId(candidate.id)}
                type="button"
              >
                <span className="candidate-row__rank">#{candidate.rank}</span>
                <span>
                  <small>DC POWER</small>
                  <strong>{(candidate.totalDcPowerWp / 1000).toFixed(2)} kWp</strong>
                </span>
                <span>
                  <small>MODULES</small>
                  <strong>{candidate.totalModules}</strong>
                </span>
                <span>
                  <small>DC/AC</small>
                  <strong>{candidate.dcAcRatio.toFixed(2)}</strong>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-result">
            ไม่พบ configuration ที่ผ่านข้อจำกัด กรุณาปรับเงื่อนไขหรือเลือกอุปกรณ์ใหม่
          </div>
        )}

        {selectedCandidate ? (
          <>
            <div className="mppt-layout">
              <div className="mppt-layout__title">
                <p>PROPOSED WIRING CONCEPT</p>
                <span>แยกตาม tracker จริง</span>
              </div>
              {selectedCandidate.mpptConfigurations.map((configuration) => (
                <div className="mppt-row" key={configuration.trackerIndex}>
                  <span className="mppt-row__index">
                    MPPT {String(configuration.trackerIndex).padStart(2, "0")}
                  </span>
                  <div className="mppt-row__string">
                    {Array.from({ length: Math.min(configuration.seriesModules, 16) }).map(
                      (_, index) => (
                        <i key={index} />
                      ),
                    )}
                  </div>
                  <strong>
                    {configuration.seriesModules}S × {configuration.parallelStrings}P
                  </strong>
                  <span>{configuration.dcPowerWp / 1000} kWp</span>
                </div>
              ))}
            </div>

            <div className="findings">
              <div className="result-section-heading">
                <div>
                  <p>RULE TRACE</p>
                  <h2>เหตุผลรายข้อ</h2>
                </div>
              </div>
              <div className="findings-table" role="table" aria-label="ผลตรวจรายกฎ">
                {selectedCandidate.findings.map((finding, index) => (
                  <div
                    className="finding-row"
                    key={`${finding.ruleId}-${index}`}
                    role="row"
                  >
                    <span
                      className={`finding-status finding-status--${finding.status.toLowerCase()}`}
                    >
                      <FindingIcon status={finding.status} />
                      {finding.status}
                    </span>
                    <span>
                      <small>{finding.ruleId}</small>
                      <strong>{finding.label}</strong>
                    </span>
                    <span>
                      <small>MEASURED</small>
                      <strong>{finding.measured}</strong>
                    </span>
                    <span>
                      <small>LIMIT / REQUIREMENT</small>
                      <strong>{finding.limit}</strong>
                    </span>
                    <p>{finding.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <div className="line-cta">
          <div>
            <p className="eyebrow">PRODUCT SUPPLY</p>
            <h2>สนใจสั่งซื้ออุปกรณ์ชุดนี้</h2>
            <p>แอด LINE OA ของ EasySolar แล้วสั่งซื้อและขอราคาผ่านเมนูใน LINE ทีมงานตอบกลับโดยตรง ไม่ต้องสมัครสมาชิก</p>
          </div>
          {lineOaUrl ? (
            <a className="button button--sun" href={lineOaUrl} rel="noopener noreferrer" target="_blank">
              แอด LINE เพื่อสั่งซื้อ<ChevronRight size={18} aria-hidden="true" />
            </a>
          ) : null}
        </div>

        <div className="report-disclaimer">
          <strong>PRELIMINARY ONLY — ENGINEERING REVIEW REQUIRED</strong>
          {result.limitations.map((limitation) => (
            <p key={limitation}>{limitation}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
