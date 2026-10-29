import type { Metadata } from "next";
import { CheckerWorkspace } from "@/components/checker-workspace";
import { SiteHeader } from "@/components/site-header";
import { demoInverters, demoPvModules } from "@/data/demo-catalog";
import { evaluateSizing } from "@/domain/sizing/engine";

export const metadata: Metadata = {
  title: "Compatibility Checker",
  description: "ตรวจ PV–Inverter compatibility และ Candidate String Layout",
};

export default function CheckerPage() {
  const initialResult = evaluateSizing({
    pvModule: demoPvModules[0],
    inverter: demoInverters[0],
    assumptions: {
      tcellMinC: -10,
      tcellMaxC: 70,
      currentSafetyFactor: 1.25,
      targetDcPowerWp: 11000,
    },
  }, {
    calculationId: "demo-preview",
    calculatedAt: "2026-10-27T00:00:00.000Z",
  });

  return (
    <main className="app-page">
      <SiteHeader />
      <div className="app-intro">
        <div>
          <p className="eyebrow eyebrow--dark">ENGINEERING WORKSPACE</p>
          <h1>PV–Inverter Compatibility Checker</h1>
        </div>
        <p>
          ตัวอย่างระบบสำหรับวางโครงเท่านั้น ข้อมูลอุปกรณ์ยังไม่ใช่ datasheet จริง
          และจงใจไม่ออกผล Compatible
        </p>
      </div>
      <CheckerWorkspace initialResult={initialResult} />
    </main>
  );
}
