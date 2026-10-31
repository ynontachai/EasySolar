import type { Metadata } from "next";
import { connection } from "next/server";
import {
  CheckerWorkspace,
  type CheckerEquipmentOption,
} from "@/components/checker-workspace";
import { SiteHeader } from "@/components/site-header";
import { demoInverters, demoPvModules } from "@/data/demo-catalog";
import { evaluateSizing } from "@/domain/sizing/engine";
import { listPublishedEquipmentOptions } from "@/lib/server/datasheet-repository";
import { resolveInverter, resolvePvModule } from "@/lib/server/equipment-resolver";

export const metadata: Metadata = {
  title: "Compatibility Checker",
  description: "ตรวจ PV–Inverter compatibility และ Candidate String Layout",
};

function toDemoOption(item: { id: string; manufacturer: string; model: string }): CheckerEquipmentOption {
  return {
    isDemo: true,
    label: `${item.manufacturer} · ${item.model}`,
    revisionLabel: "Demo",
    value: item.id,
  };
}

function pickSelection(
  options: CheckerEquipmentOption[],
  requestedId: string | undefined,
) {
  return options.find((option) => option.value === requestedId)?.value ?? options[0].value;
}

export default async function CheckerPage({
  searchParams,
}: {
  searchParams: Promise<{ inverterId?: string; pvModuleId?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const published = await listPublishedEquipmentOptions();

  const toOption = (item: (typeof published)[number]): CheckerEquipmentOption => ({
    isDemo: false,
    label: item.label,
    revisionLabel: item.revisionLabel,
    value: item.id,
  });

  // A category with published equipment shows only published items; demo data appears
  // only while that category has nothing published yet.
  const publishedPv = published.filter((item) => item.category === "pv_module").map(toOption);
  const publishedInverters = published.filter((item) => item.category === "inverter").map(toOption);
  const pvOptions = publishedPv.length ? publishedPv : demoPvModules.map(toDemoOption);
  const inverterOptions = publishedInverters.length ? publishedInverters : demoInverters.map(toDemoOption);

  const initialPvId = pickSelection(pvOptions, params.pvModuleId);
  const initialInverterId = pickSelection(inverterOptions, params.inverterId);
  const [pvModule, inverter] = await Promise.all([
    resolvePvModule(initialPvId),
    resolveInverter(initialInverterId),
  ]);

  const initialResult = pvModule && inverter
    ? evaluateSizing({
        pvModule,
        inverter,
        assumptions: {
          tcellMinC: -10,
          tcellMaxC: 70,
          currentSafetyFactor: 1.25,
          targetDcPowerWp: 11000,
        },
      }, {
        calculationId: "preview",
        calculatedAt: new Date().toISOString(),
      })
    : null;

  const hasPublished = publishedPv.length > 0 || publishedInverters.length > 0;

  return (
    <main className="app-page">
      <SiteHeader />
      <div className="app-intro">
        <div>
          <p className="eyebrow eyebrow--dark">ENGINEERING WORKSPACE</p>
          <h1>PV–Inverter Compatibility Checker</h1>
        </div>
        <p>
          {hasPublished
            ? "เลือกอุปกรณ์ที่ผ่านการตรวจและ Publish แล้ว ระบบคำนวณจากสเปกใน Datasheet revision ที่ระบุเท่านั้น"
            : "ยังไม่มีอุปกรณ์ที่ Publish ในหมวดนี้ ตัวอย่างด้านล่างเป็นข้อมูลสังเคราะห์สำหรับดูโครงเท่านั้น และจงใจไม่ออกผล Compatible"}
        </p>
      </div>
      {initialResult ? (
        <CheckerWorkspace
          initialInverterId={initialInverterId}
          initialPvModuleId={initialPvId}
          initialResult={initialResult}
          inverterOptions={inverterOptions}
          pvOptions={pvOptions}
        />
      ) : (
        <p className="app-intro" role="alert">
          อุปกรณ์ที่เลือกไม่มีสเปกที่ Publish ครบ กรุณากลับไปเลือกจาก Library
        </p>
      )}
    </main>
  );
}
