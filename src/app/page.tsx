import { connection } from "next/server";
import { CheckerWorkspace } from "@/components/checker-workspace";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadCheckerData } from "@/lib/server/checker-data";

export default async function HomePage() {
  await connection();
  const data = await loadCheckerData();
  const lineOaUrl = process.env.NEXT_PUBLIC_LINE_OA_URL;

  return (
    <main className="landing">
      <SiteHeader />
      <section className="landing-hero">
        <h1>
          จับคู่แผงโซลาร์กับอินเวอร์เตอร์
          <br />
          ให้เป็นเรื่องง่าย <em>แค่คลิก</em>
        </h1>
        <p>
          หมดปัญหานั่งกางสูตรคำนวณให้ปวดหัว
          <br />
          ป้องกันระบบพังด้วยการจับคู่ที่ตรวจสอบได้
          <br />
          พร้อมโหลด Datasheet ได้ทันที
        </p>
      </section>
      <section className="landing-calculator" id="calculator" aria-label="เครื่องคำนวณจับคู่แผงกับอินเวอร์เตอร์">
        {data.initialResult ? (
          <CheckerWorkspace
            initialInverterId={data.initialInverterId}
            initialPvModuleId={data.initialPvModuleId}
            initialResult={data.initialResult}
            inverterOptions={data.inverterOptions}
            lineOaUrl={lineOaUrl}
            pvOptions={data.pvOptions}
          />
        ) : (
          <p role="alert">ยังไม่มีอุปกรณ์ที่พร้อมให้คำนวณ กรุณาลองใหม่ภายหลัง</p>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
