"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LocateFixed, LoaderCircle, ShieldCheck } from "lucide-react";
import {
  registerCommunityInterestAction,
  type CommunityInterestActionState,
} from "@/app/community-buy/join/actions";

interface CommunityInterestFormProps {
  initialInvestmentScore: number | null;
  initialPackagePriceThb: number | null;
  initialSystemSizeKw: number | null;
}
const initialState: CommunityInterestActionState = { message: "", status: "idle" };

export function CommunityInterestForm({
  initialInvestmentScore,
  initialPackagePriceThb,
  initialSystemSizeKw,
}: CommunityInterestFormProps) {
  const [actionState, formAction, pending] = useActionState(
    registerCommunityInterestAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [propertyType, setPropertyType] = useState("detached_home");
  const [decisionRole, setDecisionRole] = useState("owner");
  const [installationWindow, setInstallationWindow] = useState("3_6_months");
  const [systemSizeKw, setSystemSizeKw] = useState(String(initialSystemSizeKw ?? 5));
  const [locationState, setLocationState] = useState<"idle" | "loading" | "ready" | "denied">("idle");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationState("denied");
      return;
    }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocationState("ready");
      },
      () => setLocationState("denied"),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  function goToNextStep() {
    const currentSection = formRef.current?.querySelector<HTMLElement>(
      `.community-form__step:not([hidden])`,
    );
    const fields = currentSection?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input, select",
    );
    const firstInvalid = fields ? Array.from(fields).find((field) => !field.checkValidity()) : null;
    if (firstInvalid) {
      firstInvalid.reportValidity();
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  }

  if (actionState.status === "success") {
    return (
      <section className="community-success" aria-live="polite">
        <span className="community-success__icon"><Check aria-hidden="true" /></span>
        <p className="eyebrow eyebrow--dark">REGISTRATION RECEIVED</p>
        <h1>เก็บความสนใจของคุณไว้แล้ว</h1>
        <p>
          หมายเลขอ้างอิง <strong>{actionState.referenceCode}</strong> รายการนี้ยังไม่มีข้อผูกมัด
          และยังไม่ถูกส่งให้ EPC จนกว่าจะมีการยืนยันในขั้นถัดไป
        </p>
        <Link className="button button--ink" href="/">
          กลับหน้าหลัก
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <form action={formAction} className="community-form" ref={formRef}>
      <input name="investmentScore" type="hidden" value={initialInvestmentScore ?? ""} />
      <input name="packagePriceThb" type="hidden" value={initialPackagePriceThb ?? ""} />
      <input name="latitude" type="hidden" value={latitude} />
      <input name="longitude" type="hidden" value={longitude} />
      <label className="community-form__honeypot" aria-hidden="true">
        Website
        <input autoComplete="off" name="companyWebsite" tabIndex={-1} />
      </label>

      <header className="community-form__progress">
        <div>
          <p>ขั้นตอน {step} / 3</p>
          <strong>{["บ้านและความต้องการ", "พื้นที่สำหรับจับคู่", "ข้อมูลติดต่อและความยินยอม"][step - 1]}</strong>
        </div>
        <ol aria-label="ความคืบหน้าการลงทะเบียน">
          {[1, 2, 3].map((item) => (
            <li key={item} data-active={item <= step} aria-current={item === step ? "step" : undefined}>
              {item}
            </li>
          ))}
        </ol>
      </header>

      <section className="community-form__step" hidden={step !== 1}>
        <p className="eyebrow eyebrow--dark">01 · YOUR SOLAR PLAN</p>
        <h2>คุณกำลังวางแผนติด Solar แบบไหน</h2>
        <div className="community-form__grid">
          <label>
            <span>ประเภทสถานที่</span>
            <select name="propertyType" value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>
              <option value="detached_home">บ้านเดี่ยว</option>
              <option value="townhome">ทาวน์โฮม / อาคารแถว</option>
              <option value="commercial">ร้านค้า / ธุรกิจขนาดเล็ก</option>
              <option value="other">อื่น ๆ</option>
            </select>
          </label>
          <label>
            <span>บทบาทในการตัดสินใจ</span>
            <select name="decisionRole" value={decisionRole} onChange={(event) => setDecisionRole(event.target.value)}>
              <option value="owner">เจ้าของสถานที่</option>
              <option value="authorized">ได้รับมอบหมายให้ตัดสินใจ</option>
              <option value="exploring">กำลังหาข้อมูลให้ครอบครัว/องค์กร</option>
            </select>
          </label>
          <label>
            <span>ขนาดระบบที่สนใจ</span>
            <select name="selectedSystemSizeKw" value={systemSizeKw} onChange={(event) => setSystemSizeKw(event.target.value)}>
              {[3, 5, 8, 10].map((size) => <option key={size} value={size}>{size} kW</option>)}
            </select>
            {initialSystemSizeKw ? <small>นำมาจากผลประเมินล่าสุดของคุณ</small> : null}
          </label>
          <label>
            <span>ช่วงเวลาที่อยากติดตั้ง</span>
            <select name="installationWindow" value={installationWindow} onChange={(event) => setInstallationWindow(event.target.value)}>
              <option value="0_3_months">ภายใน 3 เดือน</option>
              <option value="3_6_months">3–6 เดือน</option>
              <option value="6_12_months">6–12 เดือน</option>
              <option value="exploring">ยังไม่กำหนด กำลังเปรียบเทียบ</option>
            </select>
          </label>
        </div>
      </section>

      <section className="community-form__step" hidden={step !== 2}>
        <p className="eyebrow eyebrow--dark">02 · PRIVATE LOCATION</p>
        <h2>พื้นที่ไหนที่คุณต้องการให้เรารวม Demand</h2>
        <p className="community-form__lead">
          ใช้พื้นที่เพื่อค้นหากลุ่มใกล้เคียงเท่านั้น หน้า Public จะแสดงเป็นจำนวนรวม ไม่แสดงบ้านหรือพิกัดของคุณ
        </p>
        <div className="community-form__grid">
          <label><span>จังหวัด</span><input name="province" placeholder="เช่น เชียงใหม่" required /></label>
          <label><span>อำเภอ / เขต</span><input name="district" placeholder="เช่น เมืองเชียงใหม่" required /></label>
          <label><span>ตำบล / แขวง</span><input name="subdistrict" placeholder="เช่น ศรีภูมิ" required /></label>
          <label><span>รหัสไปรษณีย์</span><input inputMode="numeric" maxLength={5} name="postalCode" pattern="[0-9]{5}" placeholder="50000" required /></label>
        </div>
        <fieldset className="community-radius">
          <legend>ระยะที่ยอมรับให้จับคู่</legend>
          {[10, 15, 20].map((radius) => (
            <label key={radius}>
              <input defaultChecked={radius === 15} name="preferredRadiusKm" type="radio" value={radius} />
              <strong>{radius} km</strong>
              <span>{radius === 10 ? "ใกล้ที่สุด" : radius === 15 ? "สมดุลจำนวนและระยะทาง" : "เพิ่มโอกาสรวมกลุ่ม"}</span>
            </label>
          ))}
        </fieldset>
        <button className="community-location-button" disabled={locationState === "loading"} onClick={requestLocation} type="button">
          {locationState === "loading" ? <LoaderCircle className="spin" aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}
          {locationState === "ready" ? "บันทึกตำแหน่งโดยประมาณแล้ว" : "ใช้ตำแหน่งปัจจุบัน (ไม่บังคับ)"}
        </button>
        {locationState === "denied" ? <p className="community-location-note">ไม่เป็นไร คุณสามารถลงทะเบียนด้วยจังหวัดและอำเภอได้</p> : null}
      </section>

      <section className="community-form__step" hidden={step !== 3}>
        <p className="eyebrow eyebrow--dark">03 · CONTACT & CONSENT</p>
        <h2>ให้ EasySolar แจ้งเมื่อพื้นที่ของคุณเริ่มรวมกลุ่มได้</h2>
        <div className="community-form__grid">
          <label><span>ชื่อที่ใช้ติดต่อ</span><input autoComplete="name" name="fullName" required /></label>
          <label><span>อีเมล</span><input autoComplete="email" name="email" required type="email" /></label>
          <label className="community-form__wide"><span>เบอร์โทร (ไม่บังคับ)</span><input autoComplete="tel" inputMode="tel" name="phone" /></label>
        </div>
        <div className="community-consents">
          <label>
            <input name="consentDemandMatching" required type="checkbox" />
            <span>ยินยอมให้ EasySolar ใช้ข้อมูลพื้นที่และความต้องการเพื่อจัดกลุ่ม Demand ตามเงื่อนไขด้านบน</span>
          </label>
          <label>
            <input name="consentNotifications" type="checkbox" />
            <span>ต้องการรับความคืบหน้าและข้อเสนอของกลุ่มทางอีเมล</span>
          </label>
        </div>
        <div className="community-privacy-note">
          <ShieldCheck aria-hidden="true" />
          <p>ข้อมูลติดต่อและพิกัดเก็บในส่วน Private ไม่แสดงต่อสมาชิกอื่น และยังไม่ส่งให้ EPC ในขั้นตอนนี้</p>
        </div>
      </section>

      {actionState.status === "error" ? <p className="community-form__error" role="alert">{actionState.message}</p> : null}

      <footer className="community-form__actions">
        {step > 1 ? (
          <button className="text-link" onClick={() => setStep((current) => current - 1)} type="button">
            <ArrowLeft size={18} aria-hidden="true" />ย้อนกลับ
          </button>
        ) : <span />}
        {step < 3 ? (
          <button className="button button--ink" onClick={goToNextStep} type="button">
            ถัดไป<ArrowRight size={18} aria-hidden="true" />
          </button>
        ) : (
          <button className="button button--sun" disabled={pending} type="submit">
            {pending ? "กำลังบันทึก..." : "ลงทะเบียนความสนใจ"}<ArrowRight size={18} aria-hidden="true" />
          </button>
        )}
      </footer>
    </form>
  );
}
