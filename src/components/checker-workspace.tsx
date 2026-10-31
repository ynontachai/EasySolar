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
          <div className="field-group">
            <label htmlFor="pv-module">PV Module</label>
            <ThemeSelect
              id="pv-module"
              onValueChange={setPvModule}
              options={pvOptions}
              searchable={pvOptions.length > 8}
              value={pvModule}
            />
            <p className={`field-help${pvOptions.find((option) => option.value === pvModule)?.isDemo ? " field-help--warning" : ""}`}>
              {selectionHelp(pvOptions.find((option) => option.value === pvModule))}
            </p>
          </div>

          <div className="field-group">
            <label htmlFor="inverter">Inverter</label>
            <ThemeSelect
              id="inverter"
              onValueChange={setInverter}
              options={inverterOptions}
              searchable={inverterOptions.length > 8}
              value={inverter}
            />
            <p className={`field-help${inverterOptions.find((option) => option.value === inverter)?.isDemo ? " field-help--warning" : ""}`}>
              {selectionHelp(inverterOptions.find((option) => option.value === inverter))}
            </p>
          </div>

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
            {isLoading ? "กำลังประเมิน…" : "ประเมิน Compatibility"}
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

        <div className="result-section-heading">
          <div>
            <p>03 · CANDIDATE CONFIGURATIONS</p>
            <h2>รูปแบบ String ที่ผ่านข้อจำกัดตัวเลข</h2>
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
                  <p>04 · RULE TRACE</p>
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
