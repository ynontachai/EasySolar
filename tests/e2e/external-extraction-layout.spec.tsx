import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ExternalExtractionImportPanel,
  ImportPreflightPreview,
} from "@/components/external-extraction-import-panel";

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
const markup = renderToStaticMarkup(
  <AppRouterContext.Provider value={router}>
    <ExternalExtractionImportPanel
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
const preflightMarkup = renderToStaticMarkup(
  <section className="datasheet-intake">
    <form className="datasheet-intake__form">
      <section className="extraction-batch" aria-labelledby="sample-batch-title">
        <div className="extraction-batch__head">
          <div>
            <p className="eyebrow eyebrow--dark">BATCH PAIRING</p>
            <h3 id="sample-batch-title">คู่ PDF–JSON</h3>
          </div>
          <dl>
            <div><dt>พร้อมจับคู่</dt><dd>12</dd></div>
            <div><dt>ต้องแก้</dt><dd>1</dd></div>
            <div><dt>สำเร็จ</dt><dd>0</dd></div>
          </dl>
        </div>
        <div className="extraction-batch__list">
          <article data-status="invalid">
            <div className="extraction-batch__files">
              <span>LONG-RESPONSIVE-DATASHEET-FILENAME-S6-GR1P5K-S.pdf</span>
              <small>LONG-RESPONSIVE-EXTRACTION-FILENAME-S6-GR1P5K-S.json</small>
            </div>
            <div className="extraction-batch__models">
              <strong>Solis</strong>
              <small>S6-GR1P5K-S-LONG-RESPONSIVE-MODEL-NAME</small>
            </div>
            <div className="extraction-batch__metrics"><span>1 Models</span></div>
            <div className="extraction-batch__result">
              <span>จับคู่ไม่ได้</span>
              <small>ไม่พบ JSON ที่อ้างถึง PDF นี้</small>
            </div>
          </article>
        </div>
        <div className="extraction-batch__action">
          <span>ตรวจ Manufacturer, Model, Market และ Revision ทุกคู่ก่อนสร้าง Draft</span>
          <button className="button button--outline" type="button">ตรวจรายการ 12 PDF</button>
        </div>
      </section>
      <ImportPreflightPreview
        preflight={{
          canImport: false,
          manufacturer: {
            inputName: "Huawei",
            matchedName: "Huawei",
            status: "EXISTING",
          },
          market: "TH",
          models: [
            {
              exactModel: "SUN2000-10KTL-M1-LONG-RESPONSIVE-MODEL-NAME",
              message: "มี Revision Rev. 2026-11 อยู่แล้ว",
              status: "REVISION_EXISTS",
            },
          ],
          revisionLabel: "Rev. 2026-11",
          summary: { blocked: 1, newModels: 0, newRevisions: 0 },
        }}
      />
    </form>
  </section>,
);

const viewports = [
  { height: 844, name: "mobile", width: 390 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 1000, name: "desktop", width: 1440 },
] as const;

for (const viewport of viewports) {
  test(`external extraction import reflows at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.setContent(`<style>${css}</style><main class="admin-page">${markup}${preflightMarkup}</main>`);

    await expect(page.getByRole("heading", { name: "นำเข้า PDF หลายไฟล์จาก JSON" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Prompt v1" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "คู่ PDF–JSON" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ผลตรวจก่อนสร้าง Draft" })).toBeVisible();
    await expect(page.getByText("Revision ซ้ำ", { exact: true })).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    const undersizedTargets = await page
      .locator("a:visible, button:visible, input:visible")
      .evaluateAll((elements) =>
        elements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              height: rect.height,
              label: element.getAttribute("aria-label") ?? element.textContent?.trim(),
              width: rect.width,
            };
          })
          .filter((target) => target.height < 24 || target.width < 24),
      );
    expect(undersizedTargets).toEqual([]);
  });
}
