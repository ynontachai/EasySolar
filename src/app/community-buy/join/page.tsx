import type { Metadata } from "next";
import { CommunityInterestForm } from "@/components/community-interest-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "ลงทะเบียน EasySolar Community Buy",
  description: "แจ้งความสนใจติด Solar ตามพื้นที่ เพื่อรวม Demand และเตรียมต่อรอง Package กับ EPC",
};

function parseOptionalNumber(value: string | string[] | undefined, min: number, max: number) {
  const single = Array.isArray(value) ? value[0] : value;
  const parsed = Number(single);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}
export default async function CommunityBuyJoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <main className="community-page community-page--form">
      <SiteHeader />
      <section className="community-form-shell">
        <aside>
          <p className="eyebrow eyebrow--dark">COMMUNITY BUY · PILOT</p>
          <h1>รวมความต้องการ โดยไม่เปิดเผยบ้านของคุณ</h1>
          <p>
            ใช้เวลาประมาณ 2 นาที ข้อมูลนี้ช่วยให้เรามองเห็น Demand ในระดับตำบล อำเภอ และรัศมี
            ก่อนเปิดการต่อรองกับ EPC
          </p>
          <dl>
            <div><dt>ตอนนี้</dt><dd>เก็บความสนใจและพื้นที่</dd></div>
            <div><dt>ขั้นถัดไป</dt><dd>ยืนยันตัวตนและแจ้งเมื่อกลุ่มพร้อม</dd></div>
            <div><dt>ยังไม่เกิดขึ้น</dt><dd>ไม่มีการขายหรือส่งข้อมูลให้ EPC</dd></div>
          </dl>
        </aside>
        <CommunityInterestForm
          initialInvestmentScore={parseOptionalNumber(params.investmentScore, 0, 100)}
          initialPackagePriceThb={parseOptionalNumber(params.packagePriceThb, 1, 100_000_000)}
          initialSystemSizeKw={parseOptionalNumber(params.systemSizeKw, 1, 1000)}
        />
      </section>
    </main>
  );
}
