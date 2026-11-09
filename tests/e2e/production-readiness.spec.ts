import { expect, test } from "@playwright/test";

const viewports = [
  { height: 844, name: "mobile", width: 390 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 1000, name: "desktop", width: 1440 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.name} reflows without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("จับคู่แผงโซลาร์");
    await expect(page.locator("#calculator")).toBeVisible();
    await expect(page.getByText("ข้อมูลยังไม่พอยืนยัน", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "ส่งให้ทีมวิศวกรตรวจทาน" })).toHaveCount(0);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    const undersizedTargets = await page.locator("a:visible, button:visible, summary:visible, input:visible").evaluateAll(
      (elements) => elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { height: rect.height, label: element.getAttribute("aria-label") ?? element.textContent?.trim(), width: rect.width };
        })
        .filter((target) => target.height < 24 || target.width < 24),
    );
    expect(undersizedTargets).toEqual([]);

    await page.keyboard.press("Tab");
    const focusStyle = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      const style = getComputedStyle(active);
      return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle).not.toBeNull();
    expect(
      (focusStyle?.outlineStyle !== "none" && focusStyle?.outlineWidth !== "0px") ||
        focusStyle?.boxShadow !== "none",
    ).toBe(true);
  });
}

test("formula uses datasheet percent units and incomplete data blocks ordering", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("βVmp% ÷ 100", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("ยังไม่เปิดการสั่งซื้อชุดนี้")).toBeVisible();
  await expect(page.getByText("Datasheet แผงยังไม่ผ่านการตรวจสอบ", { exact: true })).toBeVisible();
});

test("production responses include security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["strict-transport-security"]).toContain("max-age=");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
});
