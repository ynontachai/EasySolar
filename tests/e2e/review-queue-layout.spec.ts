import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const markup = `
  <main class="admin-page">
    <section class="review-queue">
      <div class="review-queue__list">
        <form class="review-item">
          <div class="review-item__head">
            <div><small>Trina Solar · PV Module</small><h3>TSM-625NEG19RC.20</h3><p>2026-11-18</p></div>
            <span class="admin-status">ตรวจแล้ว · รอ Publish</span>
          </div>
          <ul class="review-item__sources">
            <li data-tone="warning">อัปโหลดแล้ว · กำลังรอ Malware scan</li>
            <li>ไม่มีลิงก์แหล่งข้อมูลทางการ</li>
          </ul>
          <div class="review-item__actions">
            <button class="button button--sun" disabled type="button">Publish</button>
            <button class="button button--outline" type="button">สั่งสแกนอีกครั้ง</button>
          </div>
          <p class="review-item__publish-blocker">Publish จะเปิดใช้งานเมื่อ Datasheet สแกนผ่าน หรือมีลิงก์แหล่งข้อมูลทางการ</p>
        </form>
      </div>
    </section>
  </main>
`;

for (const viewport of [
  { height: 844, name: "mobile", width: 390 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 1000, name: "desktop", width: 1440 },
] as const) {
  test(`scan status and publish gate reflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.setContent(`<style>${css}</style>${markup}`);

    await expect(page.getByText("อัปโหลดแล้ว · กำลังรอ Malware scan")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "สั่งสแกนอีกครั้ง" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  });
}
