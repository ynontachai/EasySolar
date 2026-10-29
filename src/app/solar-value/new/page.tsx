import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SolarAssessmentForm } from "@/components/solar-assessment-form";

export const metadata: Metadata = {
  title: "เริ่มประเมิน Solar Value",
  description:
    "กรอกบิลย้อนหลัง 3 เดือน พฤติกรรมการอยู่บ้าน การใช้เครื่องปรับอากาศ อัตราค่าไฟ และความต้องการขายไฟคืน",
};

export default function NewSolarAssessmentPage() {
  return (
    <main className="assessment-page">
      <SiteHeader inverse />
      <SolarAssessmentForm />
    </main>
  );
}
