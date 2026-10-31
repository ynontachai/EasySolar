"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LocateFixed, LoaderCircle, ShieldCheck } from "lucide-react";
import {
  registerCommunityInterestAction,
  type CommunityInterestActionState,
} from "@/app/community-buy/join/actions";
import { CommunityLocationMap } from "@/components/community-location-map";
import { ThemeSelect, type ThemeSelectOption } from "@/components/theme-select";

interface AddressOption extends ThemeSelectOption {
  postalCode?: string;
}

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
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [subdistrictId, setSubdistrictId] = useState("");
  const [provinceOptions, setProvinceOptions] = useState<AddressOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<AddressOption[]>([]);
  const [subdistrictOptions, setSubdistrictOptions] = useState<AddressOption[]>([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [stepError, setStepError] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/v1/locations?level=provinces")
      .then((response) => response.json() as Promise<{ options: AddressOption[] }>)
      .then((payload) => { if (active) setProvinceOptions(payload.options); })
      .catch(() => { if (active) setStepError("โหลดรายชื่อจังหวัดไม่สำเร็จ กรุณาลองใหม่"); })
      .finally(() => { if (active) setAddressLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!provinceId) return;
    let active = true;
    fetch(`/api/v1/locations?level=districts&provinceId=${encodeURIComponent(provinceId)}`)
      .then((response) => response.json() as Promise<{ options: AddressOption[] }>)
      .then((payload) => { if (active) setDistrictOptions(payload.options); })
      .catch(() => { if (active) setStepError("โหลดรายชื่ออำเภอ/เขตไม่สำเร็จ กรุณาเลือกจังหวัดอีกครั้ง"); })
      .finally(() => { if (active) setAddressLoading(false); });
    return () => { active = false; };
  }, [provinceId]);

  useEffect(() => {
    if (!districtId) return;
    let active = true;
    fetch(`/api/v1/locations?level=subdistricts&districtId=${encodeURIComponent(districtId)}`)
      .then((response) => response.json() as Promise<{ options: AddressOption[] }>)
      .then((payload) => { if (active) setSubdistrictOptions(payload.options); })
      .catch(() => { if (active) setStepError("โหลดรายชื่อตำบล/แขวงไม่สำเร็จ กรุณาเลือกอำเภออีกครั้ง"); })
      .finally(() => { if (active) setAddressLoading(false); });
    return () => { active = false; };
  }, [districtId]);

  const province = provinceOptions.find((option) => option.value === provinceId)?.label ?? "";
  const district = districtOptions.find((option) => option.value === districtId)?.label ?? "";
  const selectedSubdistrict = subdistrictOptions.find((option) => option.value === subdistrictId);
  const subdistrict = selectedSubdistrict?.label ?? "";
  const postalCode = selectedSubdistrict?.postalCode ?? "";

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
    setStepError("");
    if (step === 2 && (!provinceId || !districtId || !subdistrictId)) {
      setStepError("กรุณาเลือกจังหวัด อำเภอ/เขต และตำบล/แขวงให้ครบ");
      const missingId = !provinceId ? "province" : !districtId ? "district" : "subdistrict";
      document.getElementById(missingId)?.focus();
      return;
    }
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

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
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
          <div className="community-form__field">
            <span>ประเภทสถานที่</span>
            <ThemeSelect name="propertyType" onValueChange={setPropertyType} options={[
              { label: "บ้านเดี่ยว", value: "detached_home" },
              { label: "ทาวน์โฮม / อาคารแถว", value: "townhome" },
              { label: "ร้านค้า / ธุรกิจขนาดเล็ก", value: "commercial" },
              { label: "อื่น ๆ", value: "other" },
            ]} required value={propertyType} />
          </div>
          <div className="community-form__field">
            <span>บทบาทในการตัดสินใจ</span>
            <ThemeSelect name="decisionRole" onValueChange={setDecisionRole} options={[
              { label: "เจ้าของสถานที่", value: "owner" },
              { label: "ได้รับมอบหมายให้ตัดสินใจ", value: "authorized" },
              { label: "กำลังหาข้อมูลให้ครอบครัว/องค์กร", value: "exploring" },
            ]} required value={decisionRole} />
          </div>
          <div className="community-form__field">
            <span>ขนาดระบบที่สนใจ</span>
            <ThemeSelect name="selectedSystemSizeKw" onValueChange={setSystemSizeKw} options={
              [3, 5, 8, 10].map((size) => ({ label: `${size} kW`, value: String(size) }))
            } required value={systemSizeKw} />
            {initialSystemSizeKw ? <small>นำมาจากผลประเมินล่าสุดของคุณ</small> : null}
          </div>
          <div className="community-form__field">
            <span>ช่วงเวลาที่อยากติดตั้ง</span>
            <ThemeSelect name="installationWindow" onValueChange={setInstallationWindow} options={[
              { label: "ภายใน 3 เดือน", value: "0_3_months" },
              { label: "3–6 เดือน", value: "3_6_months" },
              { label: "6–12 เดือน", value: "6_12_months" },
              { label: "ยังไม่กำหนด กำลังเปรียบเทียบ", value: "exploring" },
            ]} required value={installationWindow} />
          </div>
        </div>
      </section>

      <section className="community-form__step" hidden={step !== 2}>
        <p className="eyebrow eyebrow--dark">02 · PRIVATE LOCATION</p>
        <h2>พื้นที่ไหนที่คุณต้องการให้เรารวม Demand</h2>
        <p className="community-form__lead">
          ใช้พื้นที่เพื่อค้นหากลุ่มใกล้เคียงเท่านั้น หน้า Public จะแสดงเป็นจำนวนรวม ไม่แสดงบ้านหรือพิกัดของคุณ
        </p>
        <input name="province" type="hidden" value={province} />
        <input name="district" type="hidden" value={district} />
        <input name="subdistrict" type="hidden" value={subdistrict} />
        <input name="postalCode" type="hidden" value={postalCode} />
        <div className="community-form__grid">
          <div className="community-form__field">
            <span>จังหวัด</span>
            <ThemeSelect disabled={addressLoading && !provinceOptions.length} id="province" onValueChange={(value) => {
              setAddressLoading(true); setProvinceId(value); setDistrictId(""); setDistrictOptions([]); setSubdistrictId(""); setSubdistrictOptions([]); setStepError("");
            }} options={provinceOptions} placeholder="เลือกจังหวัด" required searchable value={provinceId} />
          </div>
          <div className="community-form__field">
            <span>อำเภอ / เขต</span>
            <ThemeSelect disabled={!provinceId || addressLoading} id="district" onValueChange={(value) => {
              setAddressLoading(true); setDistrictId(value); setSubdistrictId(""); setSubdistrictOptions([]); setStepError("");
            }} options={districtOptions} placeholder={provinceId ? "เลือกอำเภอ / เขต" : "เลือกจังหวัดก่อน"} required searchable value={districtId} />
          </div>
          <div className="community-form__field">
            <span>ตำบล / แขวง</span>
            <ThemeSelect disabled={!districtId || addressLoading} id="subdistrict" onValueChange={(value) => {
              setSubdistrictId(value); setStepError("");
            }} options={subdistrictOptions} placeholder={districtId ? "เลือกตำบล / แขวง" : "เลือกอำเภอก่อน"} required searchable value={subdistrictId} />
          </div>
          <label><span>รหัสไปรษณีย์</span><input aria-readonly="true" inputMode="numeric" placeholder="ระบบกรอกให้อัตโนมัติ" readOnly value={postalCode} /></label>
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
        {step === 2 ? <CommunityLocationMap latitude={latitude} longitude={longitude} onLocationChange={(nextLatitude, nextLongitude) => {
          setLatitude(nextLatitude); setLongitude(nextLongitude); setLocationState("ready");
        }} /> : null}
      </section>

      <section className="community-form__step" hidden={step !== 3}>
        <p className="eyebrow eyebrow--dark">03 · CONTACT & CONSENT</p>
        <h2>ให้ EasySolar แจ้งเมื่อพื้นที่ของคุณเริ่มรวมกลุ่มได้</h2>
        <div className="community-form__grid">
          <label><span>ชื่อที่ใช้ติดต่อ</span><input autoComplete="name" name="fullName" required /></label>
          <label><span>อีเมล</span><input autoCapitalize="none" autoComplete="email" inputMode="email" maxLength={254} name="email" onChange={(event) => setEmail(event.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="name@example.com" required spellCheck={false} type="email" value={email} /></label>
          <label className="community-form__wide"><span>เบอร์โทร (ไม่บังคับ)</span><input autoComplete="tel" inputMode="numeric" maxLength={12} name="phone" onChange={(event) => setPhone(formatPhone(event.target.value))} pattern="0[0-9]{2}-[0-9]{3}-[0-9]{3,4}" placeholder="081-234-5678" type="tel" value={phone} /></label>
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

      {stepError ? <p className="community-form__error" role="alert">{stepError}</p> : null}
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
