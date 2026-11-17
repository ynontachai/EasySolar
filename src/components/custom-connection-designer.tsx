"use client";

import { useState } from "react";
import { AlertTriangle, Check, Minus, Plus, X } from "lucide-react";
import {
  createDefaultCustomLayout,
  evaluateCustomLayout,
  type CustomCheckStatus,
  type CustomLayoutEvaluation,
  type CustomTrackerLayout,
} from "@/domain/sizing/custom-layout";
import {
  MAX_RECOMMENDED_DC_AC_RATIO,
  MAX_SERIES_MODULES,
  MIN_RECOMMENDED_DC_AC_RATIO,
} from "@/domain/sizing/constants";
import type { SizingResult } from "@/domain/sizing/types";

function CheckStatus({ status }: { status: CustomCheckStatus }) {
  const label = status === "PASS" ? "ผ่าน" : status === "FAIL" ? "ไม่ผ่าน" : "ข้อมูลไม่ครบ";
  return (
    <span
      aria-label={label}
      className={`custom-check__status custom-check__status--${status.toLowerCase()}`}
      role="img"
    >
      {status === "PASS" ? (
        <Check aria-hidden="true" size={16} />
      ) : status === "FAIL" ? (
        <X aria-hidden="true" size={16} />
      ) : (
        <AlertTriangle aria-hidden="true" size={16} />
      )}
    </span>
  );
}

function MetricRow({
  label,
  limit,
  status,
  value,
}: {
  label: string;
  limit: string;
  status: CustomCheckStatus;
  value: string;
}) {
  return (
    <li className="custom-check__metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <span>{limit}</span>
      <CheckStatus status={status} />
    </li>
  );
}

function resultLabel(status: CustomCheckStatus) {
  if (status === "PASS") return "แบบ Custom ผ่านเงื่อนไขที่ระบบตรวจ";
  if (status === "FAIL") return "แบบ Custom ยังไม่ผ่านเงื่อนไข";
  return "ยังตรวจแบบ Custom ได้ไม่ครบ";
}

export function CustomConnectionDesigner({ result }: { result: SizingResult }) {
  const [layout, setLayout] = useState<CustomTrackerLayout[]>(() =>
    createDefaultCustomLayout(result),
  );
  const [evaluation, setEvaluation] = useState<CustomLayoutEvaluation | null>(null);

  function updateSeriesModules(trackerIndex: number, stringIndex: number, nextValue: number) {
    const normalized = Number.isFinite(nextValue)
      ? Math.min(MAX_SERIES_MODULES, Math.max(0, Math.trunc(nextValue)))
      : 0;
    setLayout((current) => current.map((tracker) =>
      tracker.trackerIndex === trackerIndex
        ? {
            ...tracker,
            seriesModules: tracker.seriesModules.map((modules, index) =>
              index === stringIndex ? normalized : modules,
            ),
          }
        : tracker,
    ));
    setEvaluation(null);
  }

  return (
    <div className="custom-layout">
      <p className="custom-layout__intro">
        กำหนดจำนวนแผงในแต่ละ String ได้เอง โดยจำนวน MPPT และช่อง String อ้างอิงจากสเปกอินเวอร์เตอร์ที่เลือก ค่า 0 หมายถึงไม่ใช้ String นั้น
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setEvaluation(evaluateCustomLayout(result, layout));
        }}
      >
        <div className="connection-layout custom-layout__connections">
          {layout.map((trackerLayout) => {
            const activeStrings = trackerLayout.seriesModules.filter((modules) => modules > 0).length;
            return (
              <section className="connection-mppt" key={trackerLayout.trackerIndex}>
                <div className="connection-mppt__strings">
                  {trackerLayout.seriesModules.map((seriesModules, stringIndex) => (
                    <div className="connection-string custom-string" key={stringIndex}>
                      <span>String {stringIndex + 1}</span>
                      <div
                        aria-label={seriesModules > 0 ? `${seriesModules} แผงต่ออนุกรม` : "ยังไม่ใช้ String นี้"}
                        className="connection-string__modules"
                        role="img"
                      >
                        {Array.from({ length: seriesModules }, (_, moduleIndex) => (
                          <i aria-hidden="true" key={moduleIndex} />
                        ))}
                        {seriesModules === 0 ? <small>ยังไม่ใช้</small> : null}
                      </div>
                      <div className="custom-string__control">
                        <button
                          aria-label={`ลดจำนวนแผง MPPT ${trackerLayout.trackerIndex} String ${stringIndex + 1}`}
                          disabled={seriesModules === 0}
                          onClick={() => updateSeriesModules(trackerLayout.trackerIndex, stringIndex, seriesModules - 1)}
                          type="button"
                        >
                          <Minus aria-hidden="true" size={16} />
                        </button>
                        <label>
                          <span className="sr-only">
                            จำนวนแผง MPPT {trackerLayout.trackerIndex} String {stringIndex + 1}
                          </span>
                          <input
                            aria-label={`จำนวนแผง MPPT ${trackerLayout.trackerIndex} String ${stringIndex + 1}`}
                            inputMode="numeric"
                            max={MAX_SERIES_MODULES}
                            min={0}
                            onChange={(event) => updateSeriesModules(
                              trackerLayout.trackerIndex,
                              stringIndex,
                              event.currentTarget.valueAsNumber,
                            )}
                            type="number"
                            value={seriesModules}
                          />
                        </label>
                        <button
                          aria-label={`เพิ่มจำนวนแผง MPPT ${trackerLayout.trackerIndex} String ${stringIndex + 1}`}
                          disabled={seriesModules === MAX_SERIES_MODULES}
                          onClick={() => updateSeriesModules(trackerLayout.trackerIndex, stringIndex, seriesModules + 1)}
                          type="button"
                        >
                          <Plus aria-hidden="true" size={16} />
                        </button>
                        <strong>แผง</strong>
                      </div>
                    </div>
                  ))}
                </div>
                <div aria-hidden="true" className="connection-mppt__wire" />
                <div className="connection-mppt__target">
                  <small>INVERTER</small>
                  <strong>MPPT {trackerLayout.trackerIndex}</strong>
                  <span>{activeStrings} / {trackerLayout.seriesModules.length} String</span>
                </div>
              </section>
            );
          })}
        </div>

        <button className="button button--ink custom-layout__check-button" type="submit">
          ตรวจสอบแบบ Custom
        </button>
      </form>

      {evaluation ? (
        <section aria-live="polite" className="custom-check" aria-labelledby="custom-check-heading">
          <header>
            <div>
              <h4 id="custom-check-heading">ผลตรวจสอบแบบ Custom</h4>
              <p>{resultLabel(evaluation.overallStatus)}</p>
            </div>
            <CheckStatus status={evaluation.overallStatus} />
          </header>

          <ul className="custom-check__metrics custom-check__metrics--summary">
            <MetricRow
              label="ความครบถ้วนของข้อมูล"
              limit={evaluation.blockingReasons.length
                ? evaluation.blockingReasons.join(" · ")
                : "Datasheet ผ่านการตรวจสอบ"}
              status={evaluation.dataStatus}
              value={evaluation.dataStatus === "PASS" ? "พร้อมตรวจ" : "ข้อมูลไม่ครบ"}
            />
            <MetricRow
              label="DC / AC"
              limit={`อยู่ในช่วง ${MIN_RECOMMENDED_DC_AC_RATIO.toFixed(2)}–${MAX_RECOMMENDED_DC_AC_RATIO.toFixed(2)}`}
              status={evaluation.dcAcStatus}
              value={evaluation.dcAcRatio.toFixed(2)}
            />
            <MetricRow
              label="กำลังไฟฟ้ารวม"
              limit={evaluation.maxDcPowerWp === null ? "ไม่พบกำลัง DC สูงสุด" : `≤ ${(evaluation.maxDcPowerWp / 1000).toFixed(2)} kW`}
              status={evaluation.powerStatus}
              value={`${(evaluation.totalDesignDcPowerWp / 1000).toFixed(2)} kW`}
            />
            <MetricRow
              label="จำนวนแผงรวม"
              limit={evaluation.maxModules === null ? "ยังสรุปจำนวนสูงสุดไม่ได้" : `≤ ${evaluation.maxModules} แผง`}
              status={evaluation.moduleCountStatus}
              value={`${evaluation.totalModules} แผง`}
            />
          </ul>

          <div className="custom-check__trackers">
            {evaluation.trackers.map((tracker) => (
              <section key={tracker.trackerIndex}>
                <h5>MPPT {tracker.trackerIndex}</h5>
                <ul className="custom-check__metrics">
                  <MetricRow
                    label="จำนวน String ที่ใช้งาน"
                    limit={`1–${tracker.inputCount} String ตามสเปก`}
                    status={tracker.topologyStatus}
                    value={`${tracker.activeStrings} String`}
                  />
                  <MetricRow
                    label="จำนวนแผงของ String ขนาน"
                    limit="ต้องเท่ากันบน MPPT เดียวกัน"
                    status={tracker.balancedStatus}
                    value={tracker.activeStrings > 1
                      ? `${tracker.strings.map((string) => string.seriesModules).join(" / ")} แผง`
                      : "1 String"}
                  />
                  <MetricRow
                    label="Imp รวม"
                    limit={`≤ ${tracker.maxOperatingCurrentA} A`}
                    status={tracker.operatingStatus}
                    value={`${tracker.operatingA} A`}
                  />
                  <MetricRow
                    label="Isc ออกแบบรวม"
                    limit={`≤ ${tracker.maxShortCircuitCurrentA} A`}
                    status={tracker.shortCircuitStatus}
                    value={`${tracker.shortCircuitA} A`}
                  />
                </ul>

                {tracker.strings.map((string) => (
                  <div className="custom-check__string" key={string.stringIndex}>
                    <h6>String {string.stringIndex}</h6>
                    <ul className="custom-check__metrics">
                      <MetricRow
                        label="จำนวนแผงต่อสตริง"
                        limit={tracker.seriesMinModules === null || tracker.seriesMaxModules === null
                          ? "ยังสรุปช่วงจำนวนแผงไม่ได้"
                          : `${tracker.seriesMinModules}–${tracker.seriesMaxModules} แผง`}
                        status={string.seriesStatus}
                        value={`${string.seriesModules} แผง`}
                      />
                      <MetricRow
                        label="Voc สตริง (เย็น)"
                        limit={`≤ ${tracker.voltageCeilingV} V`}
                        status={string.vocStatus}
                        value={string.vocColdV === null ? "—" : `${string.vocColdV} V`}
                      />
                      <MetricRow
                        label="Vmp สตริง (ร้อน–เย็น)"
                        limit={`อยู่ในช่วง MPPT ${tracker.mpptMinV}–${tracker.mpptMaxV} V`}
                        status={string.vmpStatus}
                        value={string.vmpHotV === null || string.vmpColdV === null ? "—" : `${string.vmpHotV}–${string.vmpColdV} V`}
                      />
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
