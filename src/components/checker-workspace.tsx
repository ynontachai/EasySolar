"use client";

import { useRef, useState } from "react";
import { Check, ChevronRight, Download, X } from "lucide-react";
import type { OverallStatus, RuleFinding, SizingResult } from "@/domain/sizing/types";
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
    detail: "ตัวเลขไฟฟ้าผ่าน แต่ข้อมูลบางส่วนยังไม่ได้ตรวจสอบกับ Datasheet จริง",
  },
};

function Pass({ ok }: { ok: boolean }) {
  return (
    <span className={`mark mark--${ok ? "pass" : "fail"}`} role="img" aria-label={ok ? "ผ่าน" : "ไม่ผ่าน"}>
      {ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
    </span>
  );
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
  rows: [string, string][];
  title: string;
}) {
  return (
    <article className="spec-card">
      <h3>{title}</h3>
      <div className="spec-card__body">
        <div className={`spec-card__image${option?.imageUrl ? "" : " spec-card__image--empty"}`}>
          {option?.imageUrl ? <img alt={option.imageAlt ?? ""} src={option.imageUrl} /> : null}
        </div>
        <dl>
          {rows.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
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
      <Pass ok={finding.status === "PASS"} />
      <span>
        <strong>{finding.label}</strong>
        <small>
          {finding.measured} · เกณฑ์ {finding.limit}
        </small>
      </span>
    </li>
  );
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
  const latestRequest = useRef(0);

  async function calculate(next: { inverter?: string; pvModule?: string } = {}) {
    const pvModuleId = next.pvModule ?? pvModule;
    const inverterId = next.inverter ?? inverter;
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/v1/sizing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pvModuleId,
          inverterId,
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
  const inv = wt.inverterLimits;
  const verdict = verdictCopy[result.overallStatus];
  const pvOption = pvOptions.find((option) => option.value === result.equipment.pvModule.id);
  const inverterOption = inverterOptions.find((option) => option.value === result.equipment.inverter.id);
  const passingStrings = wt.currents.stringRows.filter((row) => row.pass).length;
  const bestCandidate = result.candidates[0];

  return (
    <div className="calc">
      <div className="calc__pickers">
        <EquipmentPicker
          idPrefix="inverter"
          label="ข้อมูลอินเวอร์เตอร์"
          onChange={(value) => {
            setInverter(value);
            void calculate({ inverter: value });
          }}
          options={inverterOptions}
          value={inverter}
        />
        <EquipmentPicker
          idPrefix="pv-module"
          label="ข้อมูลแผง PV"
          onChange={(value) => {
            setPvModule(value);
            void calculate({ pvModule: value });
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
            ["Vdc สูงสุด", `${inv.maxDcVoltageV} V`],
            ["แรงดัน MPPT", `${inv.mpptMinV}–${inv.mpptMaxV} V`],
            ["กระแสขาเข้าสูงสุด/MPPT", `${inv.maxOperatingCurrentA} A`],
            ["Isc สูงสุด/MPPT", `${inv.maxShortCircuitCurrentA} A`],
            ["กำลัง PV สูงสุดที่แนะนำ", inv.maxRecommendedPvWp === null ? "ไม่ระบุ" : `${inv.maxRecommendedPvWp.toLocaleString("en-US")} Wp`],
            ["กำลัง PV ที่ใช้งานได้", inv.maxDcPowerWp === null ? "ไม่ระบุ" : `${inv.maxDcPowerWp.toLocaleString("en-US")} Wp`],
            ["MPPT / สตริงสูงสุด", `${inv.trackerCount} MPPT · ${inv.inputsPerMppt} สตริง`],
          ]}
          title={`${result.equipment.inverter.manufacturer} ${result.equipment.inverter.model}`}
        />
        <SpecCard
          option={pvOption}
          rows={[
            ["Pmax", `${pv.pmaxWp} Wp`],
            ["Voc", `${pv.vocV} V`],
            ["Vmp", `${pv.vmpV} V`],
            ["Isc", `${pv.iscA} A`],
            ["Imp", `${pv.impA} A`],
            ["Beta (Voc / Vmp)", `${pv.betaVocPerC ?? "ไม่ระบุ"} / ${pv.betaVmpPerC ?? "ไม่ระบุ"} /°C`],
          ]}
          title={`${result.equipment.pvModule.manufacturer} ${result.equipment.pvModule.model}`}
        />
      </div>

      <div className={`calc__verdict calc__verdict--${result.overallStatus.toLowerCase()}`}>
        <strong>{verdict.label}</strong>
        <span>{verdict.detail}</span>
      </div>

      <div className="calc__steps">
        <Step number={1} title="จำนวนแผงรวมสูงสุด">
          {wt.maxModules ? (
            <div className="formula">
              <p>ขนาด PV แนะนำสูงสุด ÷ กำลังแผง</p>
              <p>
                {wt.maxModules.limitWp.toLocaleString("en-US")} ÷ {pv.pmaxWp} = {(wt.maxModules.limitWp / pv.pmaxWp).toFixed(1)}
              </p>
              <strong>{wt.maxModules.modules} แผง</strong>
            </div>
          ) : (
            <p className="calc__missing">Datasheet ไม่ระบุกำลัง PV สูงสุด จึงคำนวณข้อนี้ไม่ได้</p>
          )}
        </Step>

        <Step number={2} title="แรงดันตามอุณหภูมิ">
          {wt.temperature ? (
            <>
              <div className="formula">
                <p><b>Vmp ร้อน</b> = Vmp × [1 + β × (T สูงสุด − 25)]</p>
                <p>{pv.vmpV} × [1 + ({pv.betaVmpPerC}) × ({result.assumptions.tcellMaxC} − 25)]</p>
                <strong>{wt.temperature.vmpHotV} V</strong>
              </div>
              <div className="formula">
                <p><b>Voc เย็น</b> = Voc × [1 + β × (T ต่ำสุด − 25)]</p>
                <p>{pv.vocV} × [1 + ({pv.betaVocPerC}) × ({result.assumptions.tcellMinC} − 25)]</p>
                <strong>{wt.temperature.vocColdV} V</strong>
              </div>
              <div className="formula">
                <p><b>Vmp เย็น</b> = Vmp × [1 + β × (T ต่ำสุด − 25)]</p>
                <p>{pv.vmpV} × [1 + ({pv.betaVmpPerC}) × ({result.assumptions.tcellMinC} − 25)]</p>
                <strong>{wt.temperature.vmpColdV} V</strong>
              </div>
            </>
          ) : (
            <p className="calc__missing">Datasheet ไม่ระบุค่า Beta จึงคำนวณแรงดันตามอุณหภูมิไม่ได้</p>
          )}
        </Step>

        <Step number={3} title="จำนวนแผงต่ออนุกรม / สตริง">
          {wt.seriesRange && wt.temperature ? (
            <>
              <div className="formula">
                <p><b>แผงมากสุด</b> = Vdc สูงสุด ÷ Voc เย็น</p>
                <p>{wt.seriesRange.voltageCeilingV} ÷ {wt.temperature.vocColdV}</p>
                <strong>{wt.seriesRange.maxModules} แผง <Pass ok={wt.seriesRange.maxModules >= 1} /></strong>
                <small>ไม่เกินแรงดัน DC สูงสุดของอินเวอร์เตอร์</small>
              </div>
              <div className="formula">
                <p><b>แผงน้อยสุด</b> = แรงดันต่ำสุดของ MPPT ÷ Vmp ร้อน</p>
                <p>{inv.mpptMinV} ÷ {wt.temperature.vmpHotV}</p>
                <strong>{wt.seriesRange.minModules} แผง <Pass ok={wt.seriesRange.minModules <= wt.seriesRange.maxModules} /></strong>
                <small>ต้องไม่ต่ำกว่าแรงดันต่ำสุดของ MPPT</small>
              </div>
              <p className="calc__answer">
                {wt.seriesRange.minModules <= wt.seriesRange.maxModules
                  ? `ใช้แผงได้ ${wt.seriesRange.minModules} ถึง ${wt.seriesRange.maxModules} แผงต่อสตริง`
                  : "ไม่มีจำนวนแผงที่ผ่านทั้งสองขอบเขต"}
              </p>
            </>
          ) : (
            <p className="calc__missing">ต้องมีค่า Beta จึงจะคำนวณข้อนี้ได้</p>
          )}
        </Step>

        <Step number={4} title="จำนวนสตริงต่อ MPPT">
          <div className="formula">
            <p>
              กระแสของแผง (Imp) {pv.impA} A ต้องน้อยกว่ากระแสขาเข้าสูงสุด/MPPT {inv.maxOperatingCurrentA} A{" "}
              <Pass ok={pv.impA <= inv.maxOperatingCurrentA} />
            </p>
            <p>
              กระแสลัดวงจร (Isc) {pv.iscA} A × {wt.currents.safetyFactor} = {wt.currents.designIscA} A ต้องน้อยกว่า {inv.maxShortCircuitCurrentA} A{" "}
              <Pass ok={wt.currents.designIscA <= inv.maxShortCircuitCurrentA} />
            </p>
          </div>
          <ul className="calc__rows">
            {wt.currents.stringRows.map((row) => (
              <li key={row.strings}>
                <Pass ok={row.pass} />
                <span>
                  {row.strings} สตริงต่อ 1 MPPT: {row.operatingA} A {row.pass ? "<" : ">"} {inv.maxOperatingCurrentA} A
                </span>
              </li>
            ))}
          </ul>
          <p className="calc__answer">ต่อได้สูงสุด {passingStrings} สตริงต่อ MPPT</p>
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
                    <span>DC/AC {candidate.dcAcRatio.toFixed(2)}</span>
                  </header>
                  {candidate.mpptConfigurations.map((configuration) => (
                    <div className="layout-card__row" key={configuration.trackerIndex}>
                      <span>MPPT {configuration.trackerIndex}</span>
                      <div className="layout-card__panels" aria-hidden="true">
                        {Array.from({ length: Math.min(configuration.seriesModules, 16) }).map((_, index) => (
                          <i key={index} />
                        ))}
                      </div>
                      <strong>
                        {configuration.seriesModules} แผง × {configuration.parallelStrings} สตริง
                      </strong>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          ) : (
            <p className="calc__missing">ไม่พบรูปแบบการต่อที่ผ่านเงื่อนไข ลองเปลี่ยนรุ่นหรือปรับเงื่อนไขด้านล่าง</p>
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
                <input id="current-factor" max={2} min={1} onChange={(event) => setCurrentSafetyFactor(event.target.valueAsNumber)} required step="0.01" type="number" value={currentSafetyFactor} />
                <span>×</span>
              </div>
            </div>
          </div>
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

      <section className="line-cta" id="order">
        <div>
          <p className="eyebrow">สั่งซื้ออุปกรณ์</p>
          <h2>สนใจอุปกรณ์ชุดนี้</h2>
          <p>แอด LINE OA ของ EasySolar เพื่อสอบถามและสั่งซื้อ ทีมงานตอบกลับโดยตรง</p>
        </div>
        {lineOaUrl ? (
          <a className="button button--sun" href={lineOaUrl} rel="noopener noreferrer" target="_blank">
            แอด LINE เพื่อสั่งซื้อ
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
