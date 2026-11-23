import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { InverterZipImportPanel } from "@/components/inverter-zip-import-panel";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const router = {
  back: () => undefined,
  bfcacheId: "test",
  forward: () => undefined,
  prefetch: async () => undefined,
  push: () => undefined,
  refresh: () => undefined,
  replace: () => undefined,
};
const panelMarkup = renderToStaticMarkup(
  <AppRouterContext.Provider value={router}>
    <InverterZipImportPanel
      capabilities={{
        adminAuth: true,
        database: true,
        ready: true,
        scanMode: "trusted-dev",
        storage: true,
      }}
    />
  </AppRouterContext.Provider>,
);
const previewMarkup = renderToStaticMarkup(
  <div className="inverter-zip-preview">
    <div className="inverter-zip-preview__head"><strong>ตรวจรายการก่อนสร้าง Draft</strong><span>0/1 สำเร็จ</span></div>
    <div className="inverter-zip-list">
      <article className="inverter-zip-row" data-status="ready">
        <div className="inverter-zip-row__type"><span>Hybrid</span><small>S6-EH3P10K02-NV-YD-L-VERY-LONG-FILENAME.pdf</small></div>
        <label><span>Exact model</span><input defaultValue="S6-EH3P10K02-NV-YD-L-VERY-LONG-MODEL" /></label>
        <div className="inverter-zip-row__rating"><span>Rated AC ที่คาดจากชื่อรุ่น</span><strong>10 kW</strong></div>
        <div className="inverter-zip-row__status"><span>พร้อมนำเข้า</span></div>
      </article>
    </div>
  </div>,
);

const viewports = [
  { height: 844, name: "mobile", width: 390 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 1000, name: "desktop", width: 1440 },
] as const;

for (const viewport of viewports) {
  test(`inverter ZIP intake reflows at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.setContent(`<style>${css}</style><main class="admin-page">${panelMarkup}${previewMarkup}</main>`);

    await expect(page.getByRole("heading", { name: "นำเข้า Inverter หลายรุ่นจาก ZIP" })).toBeVisible();
    await expect(page.getByText("10 kW", { exact: true })).toBeVisible();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    const undersizedTargets = await page
      .locator("button:visible, input:visible")
      .evaluateAll((elements) => elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { height: rect.height, width: rect.width };
        })
        .filter((target) => target.height < 24 || target.width < 24));
    expect(undersizedTargets).toEqual([]);
  });
}
