import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { ExternalExtractionImportPanel } from "@/components/external-extraction-import-panel";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const markup = renderToStaticMarkup(
  <ExternalExtractionImportPanel
    capabilities={{
      adminAuth: true,
      database: true,
      ready: true,
      scanMode: "trusted-dev",
      storage: true,
    }}
  />,
);

const viewports = [
  { height: 844, name: "mobile", width: 390 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 1000, name: "desktop", width: 1440 },
] as const;

for (const viewport of viewports) {
  test(`external extraction import reflows at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.setContent(`<style>${css}</style><main class="admin-page">${markup}</main>`);

    await expect(page.getByRole("heading", { name: "นำเข้า PDF หลาย Model จาก JSON" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Prompt v1" })).toBeVisible();

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
