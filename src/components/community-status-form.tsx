"use client";

import { useActionState } from "react";
import {
  updateCommunityStatusAction,
  type CommunityStatusActionState,
} from "@/app/admin/(protected)/community/actions";
import type { CommunityInterestStatus } from "@/lib/server/community-admin-repository";

const initialState: CommunityStatusActionState = { message: "", status: "idle" };
const statusOptions: Array<{ label: string; value: CommunityInterestStatus }> = [
  { label: "รอตรวจสอบ", value: "pending" },
  { label: "กำลังดำเนินการ", value: "active" },
  { label: "ยกเลิกความสนใจ", value: "withdrawn" },
  { label: "เปลี่ยนเป็นลูกค้าแล้ว", value: "converted" },
];

export function CommunityStatusForm({
  currentStatus,
  interestId,
}: {
  currentStatus: CommunityInterestStatus;
  interestId: string;
}) {
  const [state, formAction, pending] = useActionState(updateCommunityStatusAction, initialState);

  return (
    <form action={formAction} className="admin-community-status-form">
      <input name="interestId" type="hidden" value={interestId} />
      <label>
        <span>สถานะรายการ</span>
        <select defaultValue={currentStatus} name="status">
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <button className="button button--ink" disabled={pending} type="submit">
        {pending ? "กำลังบันทึก..." : "บันทึกสถานะ"}
      </button>
      {state.message ? (
        <p className={state.status === "error" ? "admin-form-error" : "admin-form-success"} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
