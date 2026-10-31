"use client";

import { useActionState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import {
  reviewRevisionAction,
  type ReviewActionState,
} from "@/app/admin/(protected)/equipment/review-actions";
import { criticalFieldsFor, type RevisionState } from "@/domain/catalog/review-workflow";
import type { ReviewQueueRow } from "@/lib/server/review-repository";

const initialState: ReviewActionState = { message: "", status: "idle" };

const stateLabels: Record<RevisionState, string> = {
  draft: "DRAFT · รอกรอกสเปก",
  extracted_unverified: "รอตรวจสอบสเปก",
  published: "PUBLISHED",
  recalled: "RECALLED",
  superseded: "SUPERSEDED",
  verified: "ตรวจแล้ว · รอ Publish",
};

const fieldLabels: Record<string, string> = {
  impA: "Imp",
  iscA: "Isc",
  mpptCurrent: "MPPT current",
  mpptRange: "MPPT voltage range",
  maxDcVoltageV: "Max DC voltage",
  maxSystemVoltageV: "Max system voltage",
  pmaxWp: "Pmax",
  ratedAcKw: "Rated AC",
  vmpV: "Vmp",
  vocV: "Voc",
};

export function ReviewQueueItem({ row }: { row: ReviewQueueRow }) {
  const [state, action, isPending] = useActionState(reviewRevisionAction, initialState);
  const fields = criticalFieldsFor(row.category);
  const hasFile = row.assetState === "available";

  return (
    <form action={action} className="review-item" aria-labelledby={`review-${row.revisionId}`}>
      <input name="revisionId" type="hidden" value={row.revisionId} />
      <div className="review-item__head">
        <div>
          <small>{row.manufacturer} · {row.category === "pv_module" ? "PV Module" : "Inverter"}</small>
          <h3 id={`review-${row.revisionId}`}>{row.exactModel}</h3>
          <p>{row.revisionLabel}</p>
        </div>
        <span className="admin-status">{stateLabels[row.state]}</span>
      </div>

      <ul className="review-item__sources" aria-label="แหล่งข้อมูล">
        <li>{hasFile ? "มี Datasheet ที่สแกนแล้ว" : "ยังไม่มี Datasheet ที่สแกนแล้ว"}</li>
        <li>{row.hasSourceUrl ? "มีลิงก์แหล่งข้อมูลทางการ" : "ไม่มีลิงก์แหล่งข้อมูลทางการ"}</li>
      </ul>

      {row.state === "extracted_unverified" ? (
        <fieldset className="review-item__confirm">
          <legend>ยืนยันค่าเทียบกับ Datasheet</legend>
          {fields.map((field) => (
            <label key={field}>
              <input name="confirmedFields" type="checkbox" value={field} />
              {fieldLabels[field] ?? field}
            </label>
          ))}
          <label className="review-item__wide">
            <span>หมายเหตุ</span>
            <input maxLength={500} name="note" placeholder="ไม่บังคับ" type="text" />
          </label>
        </fieldset>
      ) : null}

      <label className="review-item__wide">
        <span>เหตุผล (ใช้เมื่อส่งกลับหรือ Recall)</span>
        <input maxLength={500} name="reason" placeholder="เช่น หน้า 2 ระบุ Voc ต่างจากที่กรอก" type="text" />
      </label>

      <div className="review-item__actions">
        {row.state === "extracted_unverified" ? (
          <button className="button button--sun" disabled={isPending} name="intent" type="submit" value="verify">
            ยืนยันสเปก
          </button>
        ) : null}
        {row.state === "verified" ? (
          <button className="button button--sun" disabled={isPending} name="intent" type="submit" value="publish">
            Publish
          </button>
        ) : null}
        {row.state === "extracted_unverified" || row.state === "verified" ? (
          <button className="button button--outline" disabled={isPending} name="intent" type="submit" value="reject">
            ส่งกลับแก้ไข
          </button>
        ) : null}
        {row.state === "published" ? (
          <button className="button button--outline" disabled={isPending} name="intent" type="submit" value="recall">
            Recall
          </button>
        ) : null}
        {isPending ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : null}
      </div>

      <p data-status={state.status} role={state.status === "error" ? "alert" : "status"} className="review-item__message">
        {state.status === "success" ? <CheckCircle2 size={15} aria-hidden="true" /> : null}
        {state.message}
      </p>
    </form>
  );
}
