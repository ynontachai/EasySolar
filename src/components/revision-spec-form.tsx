"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, Plus, Trash2 } from "lucide-react";
import {
  enterSpecAction,
  type ReviewActionState,
} from "@/app/admin/(protected)/equipment/review-actions";
import type { RevisionSpecTarget } from "@/lib/server/review-repository";

const initialState: ReviewActionState = { message: "", status: "idle" };
const MAX_TRACKERS = 12;

const pvCriticalFields = [
  { label: "Pmax (Wp)", name: "pmaxWp" },
  { label: "Voc (V)", name: "vocV" },
  { label: "Vmp (V)", name: "vmpV" },
  { label: "Isc (A)", name: "iscA" },
  { label: "Imp (A)", name: "impA" },
  { label: "Max system voltage (V)", name: "maxSystemVoltageV" },
];

const pvOptionalFields = [
  { label: "βVoc (%/°C)", name: "betaVocPercentPerC" },
  { label: "βVmp (%/°C)", name: "betaVmpPercentPerC" },
  { label: "Bifaciality (0–1)", name: "bifacialityFactor" },
];

const inverterCriticalFields = [
  { label: "Rated AC (kW)", name: "ratedAcKw" },
  { label: "Max DC voltage (V)", name: "maxDcVoltageV" },
];

const inverterOptionalFields = [
  { label: "Max DC power (Wp)", name: "maxDcPowerWp" },
  { label: "Max recommended PV (Wp)", name: "maxRecommendedPvWp" },
  { label: "Startup voltage (V)", name: "startupVoltageV" },
];

const trackerFields = [
  { label: "จำนวน input", name: "inputCount" },
  { label: "MPPT min V", name: "mpptMinV" },
  { label: "MPPT max V", name: "mpptMaxV" },
  { label: "Max operating current (A)", name: "maxOperatingCurrentA" },
  { label: "Max Isc (A)", name: "maxShortCircuitCurrentA" },
];

type Tracker = { id: number; values: Record<string, string> };

function ValueInput({
  defaultValue,
  label,
  name,
}: {
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input defaultValue={defaultValue} inputMode="decimal" name={name} type="text" />
    </label>
  );
}

// A value with the datasheet page it was read from. Each critical value must cite a page.
function ValueWithPage({
  defaultValue,
  label,
  name,
  values,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  values: Record<string, string>;
}) {
  return (
    <div className="spec-form__row">
      <ValueInput defaultValue={defaultValue} label={label} name={name} />
      <label>
        <span>หน้า</span>
        <input
          defaultValue={values[`sourcePages.${name}`]}
          maxLength={40}
          name={`sourcePages.${name}`}
          type="text"
        />
      </label>
    </div>
  );
}

export function RevisionSpecForm({ target }: { target: RevisionSpecTarget }) {
  const [state, action, isPending] = useActionState(enterSpecAction, initialState);
  const isPv = target.category === "pv_module";
  const { values } = target;

  const initialTrackers = target.trackers.length
    ? target.trackers.map((tracker, index) => ({ id: index, values: tracker }))
    : [{ id: 0, values: {} }];
  const [trackers, setTrackers] = useState<Tracker[]>(initialTrackers);
  const nextTrackerId = useRef(initialTrackers.length);

  function addTracker() {
    const id = nextTrackerId.current++;
    setTrackers((current) => [...current, { id, values: {} }]);
  }

  function removeTracker(id: number) {
    setTrackers((current) => current.filter((tracker) => tracker.id !== id));
  }

  return (
    <form action={action} className="admin-sku-form spec-form">
      <input name="revisionId" type="hidden" value={target.revisionId} />
      <input name="category" type="hidden" value={target.category} />

      <div className="admin-sku-form__head">
        <div>
          <p className="eyebrow">{isPv ? "PV Module" : "Inverter"}</p>
          <h2>ค่าจาก Datasheet</h2>
          <p>
            กรอกค่าตามหน้า Datasheet ทุกค่าที่มี * และระบุหน้าอ้างอิง ผู้ที่กรอกสเปกจะยืนยันเองไม่ได้
          </p>
        </div>
      </div>

      {isPv ? (
        <>
          <fieldset className="spec-form__section">
            <legend>ค่าหลัก (ต้องมีหน้าอ้างอิง)</legend>
            {pvCriticalFields.map((field) => (
              <ValueWithPage
                defaultValue={values[field.name]}
                key={field.name}
                label={`${field.label} *`}
                name={field.name}
                values={values}
              />
            ))}
          </fieldset>

          <fieldset className="spec-form__section">
            <legend>ค่าเพิ่มเติม</legend>
            {pvOptionalFields.map((field) => (
              <ValueInput
                defaultValue={values[field.name]}
                key={field.name}
                label={field.label}
                name={field.name}
              />
            ))}
          </fieldset>
        </>
      ) : (
        <>
          <fieldset className="spec-form__section">
            <legend>ค่าหลัก (ต้องมีหน้าอ้างอิง)</legend>
            <label>
              <span>ประเภท *</span>
              <select defaultValue={values.inverterType ?? ""} name="inverterType">
                <option value="">เลือกประเภท</option>
                <option value="string">String</option>
                <option value="hybrid">Hybrid</option>
                <option value="micro">Micro</option>
              </select>
            </label>
            {inverterCriticalFields.map((field) => (
              <ValueWithPage
                defaultValue={values[field.name]}
                key={field.name}
                label={`${field.label} *`}
                name={field.name}
                values={values}
              />
            ))}
          </fieldset>

          <fieldset className="spec-form__section">
            <legend>ค่าเพิ่มเติม</legend>
            {inverterOptionalFields.map((field) => (
              <ValueInput
                defaultValue={values[field.name]}
                key={field.name}
                label={field.label}
                name={field.name}
              />
            ))}
          </fieldset>

          <fieldset className="spec-form__section spec-form__section--wide">
            <legend>MPPT (1–{MAX_TRACKERS} ตัว)</legend>
            <div className="spec-form__pages">
              <label>
                <span>หน้า MPPT current *</span>
                <input
                  defaultValue={values["sourcePages.mpptCurrent"]}
                  maxLength={40}
                  name="sourcePages.mpptCurrent"
                  type="text"
                />
              </label>
              <label>
                <span>หน้า MPPT voltage range *</span>
                <input
                  defaultValue={values["sourcePages.mpptRange"]}
                  maxLength={40}
                  name="sourcePages.mpptRange"
                  type="text"
                />
              </label>
            </div>

            {trackers.map((tracker, index) => (
              <div className="spec-form__tracker" key={tracker.id}>
                <div className="spec-form__tracker-head">
                  <strong>MPPT {index + 1}</strong>
                  {trackers.length > 1 ? (
                    <button
                      className="spec-form__remove"
                      onClick={() => removeTracker(tracker.id)}
                      type="button"
                    >
                      <Trash2 size={16} aria-hidden="true" /> ลบ MPPT {index + 1}
                    </button>
                  ) : null}
                </div>
                <div className="spec-form__tracker-grid">
                  {trackerFields.map((field) => (
                    <ValueInput
                      defaultValue={tracker.values[field.name]}
                      key={field.name}
                      label={`${field.label} *`}
                      name={field.name}
                    />
                  ))}
                </div>
              </div>
            ))}

            {trackers.length < MAX_TRACKERS ? (
              <button className="spec-form__add button button--outline" onClick={addTracker} type="button">
                <Plus size={16} aria-hidden="true" /> เพิ่ม MPPT
              </button>
            ) : null}
          </fieldset>
        </>
      )}

      <fieldset className="spec-form__section spec-form__section--wide">
        <legend>แหล่งข้อมูล</legend>
        <label>
          <span>ลิงก์ Datasheet ทางการ (https, ไม่บังคับ)</span>
          <input defaultValue={values.sourceUrl} maxLength={500} name="sourceUrl" type="url" />
        </label>
      </fieldset>

      <div className="admin-sku-form__actions">
        <p data-status={state.status} role={state.status === "error" ? "alert" : "status"}>
          {state.status === "success" ? <CheckCircle2 size={15} aria-hidden="true" /> : null}
          {isPending ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : null}
          {state.message}
        </p>
        <div className="spec-form__submit">
          <Link className="button button--outline" href="/admin/equipment">
            กลับไปคิว
          </Link>
          <button className="button button--sun" disabled={isPending} type="submit">
            บันทึกสเปก
          </button>
        </div>
      </div>
    </form>
  );
}
