import { demoInverters, demoPvModules } from "@/data/demo-catalog";
import type { CheckerEquipmentOption } from "@/components/checker-workspace";
import { evaluateSizing } from "@/domain/sizing/engine";
import { listPublishedCatalogItems } from "@/lib/server/datasheet-repository";
import { resolveInverter, resolvePvModule } from "@/lib/server/equipment-resolver";

export const DEFAULT_ASSUMPTIONS = {
  tcellMinC: -10,
  tcellMaxC: 70,
  currentSafetyFactor: 1.25,
  targetDcPowerWp: 11000,
};

function toDemoOption(item: { id: string; manufacturer: string; model: string }): CheckerEquipmentOption {
  return {
    datasheetPath: null,
    imageAlt: null,
    imageUrl: null,
    isDemo: true,
    manufacturer: item.manufacturer,
    model: item.model,
    revisionLabel: "Demo",
    value: item.id,
  };
}

// A category with published equipment shows only published items; demo data appears
// only while that category has nothing published yet.
export async function loadCheckerData() {
  const published = (await listPublishedCatalogItems()) ?? [];
  const toOption = (item: (typeof published)[number]): CheckerEquipmentOption => ({
    datasheetPath: item.downloadPath,
    imageAlt: item.imageAlt,
    imageUrl: item.imageAssetId ? `/api/v1/product-media/${item.imageAssetId}` : null,
    isDemo: false,
    manufacturer: item.manufacturer,
    model: item.exactModel,
    revisionLabel: item.revisionLabel,
    value: item.id,
  });

  const publishedPv = published.filter((item) => item.category === "pv_module").map(toOption);
  const publishedInverters = published.filter((item) => item.category === "inverter").map(toOption);
  const pvOptions = publishedPv.length ? publishedPv : demoPvModules.map(toDemoOption);
  const inverterOptions = publishedInverters.length ? publishedInverters : demoInverters.map(toDemoOption);

  const [pvModule, inverter] = await Promise.all([
    resolvePvModule(pvOptions[0].value),
    resolveInverter(inverterOptions[0].value),
  ]);

  const initialResult =
    pvModule && inverter
      ? evaluateSizing(
          { pvModule, inverter, assumptions: DEFAULT_ASSUMPTIONS },
          { calculationId: "preview", calculatedAt: new Date().toISOString() },
        )
      : null;

  return {
    hasPublished: publishedPv.length > 0 || publishedInverters.length > 0,
    initialInverterId: inverterOptions[0].value,
    initialPvModuleId: pvOptions[0].value,
    initialResult,
    inverterOptions,
    pvOptions,
  };
}
