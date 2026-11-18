import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const markup = `
  <main class="admin-specs-page">
    <header class="admin-page-header">
      <div><p class="eyebrow eyebrow--dark">CATALOG · AVAILABILITY</p><h1>Spec Management</h1><p>Control equipment dropdown availability.</p></div>
      <span>1 / 2 Active</span>
    </header>
    <nav class="admin-spec-tabs" aria-label="Spec category"><a aria-current="page">Inverter</a><a>Solar Panel</a></nav>
    <div class="admin-spec-groups">
      <section class="admin-spec-group">
        <header class="admin-spec-group__head">
          <div><span class="admin-spec-group__icon">S</span><div><h2>Example Energy</h2><p>1 / 2 models shown in Dropdown</p></div></div>
          <form><button class="spec-activation-button" data-next-active="false">Deactivate Brand</button></form>
        </header>
        <div class="admin-spec-table-wrap">
          <table class="admin-spec-table">
            <thead><tr><th>Model</th><th>Published revision</th><th>Key spec</th><th>Dropdown status</th><th>Action</th></tr></thead>
            <tbody>
              <tr>
                <td data-label="Model"><strong>INV-10K-HYBRID-LONG-MODEL-NAME</strong><small>Updated today</small></td>
                <td data-label="Published revision">2026-11-18</td>
                <td data-label="Key spec">10 kW · 1,000 Vdc max</td>
                <td data-label="Dropdown status"><span class="admin-spec-status" data-active="true">Active</span></td>
                <td data-label="Action"><form><button class="spec-activation-button" data-next-active="false">Deactivate Model</button></form></td>
              </tr>
              <tr>
                <td data-label="Model"><strong>INV-12K</strong><small>Updated today</small></td>
                <td data-label="Published revision">2026-11-18</td>
                <td data-label="Key spec">12 kW · 1,000 Vdc max</td>
                <td data-label="Dropdown status"><span class="admin-spec-status" data-active="false">Inactive</span></td>
                <td data-label="Action"><form><button class="spec-activation-button" data-next-active="true">Activate Model</button></form></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>
`;

for (const viewport of [
  { height: 844, name: "mobile", width: 390 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 1000, name: "desktop", width: 1440 },
] as const) {
  test(`spec management table reflows at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.setContent(`<style>${css}</style>${markup}`);

    await expect(page.getByRole("button", { name: "Deactivate Brand" })).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Activate Model" })).toBeVisible();
    await expect(page.getByText("Inactive", { exact: true })).toBeVisible();
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )).toBe(false);
  });
}
